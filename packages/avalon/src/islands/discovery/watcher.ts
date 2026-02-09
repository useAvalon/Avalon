/**
 * Island File Watcher
 * 
 * Watches all discovered island directories for file changes and emits
 * change events with affected island information. Supports HMR for
 * nested island directories.
 */

import { resolve, relative, extname, basename } from "node:path";
import type {
  IslandDirectory,
  DiscoveredIsland,
  IslandChangeEvent,
  IslandDiscoveryConfig,
} from "./types.ts";
import { isSupportedIslandExtension } from "./types.ts";
import { discoverIslandDirectories, discoverIslandsInDirectory } from "./scanner.ts";
import { IslandRegistry } from "./registry.ts";

/**
 * Callback type for island change events
 */
export type IslandChangeCallback = (event: IslandChangeEvent) => void;

/**
 * Options for the island watcher
 */
export interface IslandWatcherOptions {
  /** Debounce delay in milliseconds (default: 100) */
  debounceMs?: number;
  /** Whether to emit events for initial discovery (default: false) */
  emitInitial?: boolean;
}

/**
 * Default watcher options
 */
const DEFAULT_WATCHER_OPTIONS: Required<IslandWatcherOptions> = {
  debounceMs: 100,
  emitInitial: false,
};

/**
 * Island File Watcher
 * 
 * Watches all discovered island directories for file changes.
 * Emits change events with affected island information for HMR support.
 */
export class IslandWatcher {
  private _projectRoot: string;
  private _config: IslandDiscoveryConfig;
  private _options: Required<IslandWatcherOptions>;
  private _registry: IslandRegistry;
  private _watchers: Deno.FsWatcher[] = [];
  private _callbacks: Set<IslandChangeCallback> = new Set();
  private _isWatching = false;
  private _debounceTimers: Map<string, number> = new Map();

  constructor(
    projectRoot: string,
    registry: IslandRegistry,
    config: IslandDiscoveryConfig = {},
    options: IslandWatcherOptions = {}
  ) {
    this._projectRoot = projectRoot;
    this._registry = registry;
    this._config = config;
    this._options = { ...DEFAULT_WATCHER_OPTIONS, ...options };
  }

  /**
   * Check if the watcher is currently active
   */
  get isWatching(): boolean {
    return this._isWatching;
  }

  /**
   * Get the number of registered callbacks
   */
  get callbackCount(): number {
    return this._callbacks.size;
  }

  /**
   * Start watching all discovered island directories.
   * 
   * @param callback - Callback to invoke on file changes
   * @returns Cleanup function to stop watching
   */
  async watch(callback: IslandChangeCallback): Promise<() => void> {
    this._callbacks.add(callback);

    // Start watching if not already
    if (!this._isWatching) {
      await this._startWatching();
    }

    // Return cleanup function
    return () => {
      this._callbacks.delete(callback);
      
      // Stop watching if no more callbacks
      if (this._callbacks.size === 0) {
        this.stop();
      }
    };
  }

  /**
   * Stop all file watchers and clear callbacks.
   */
  stop(): void {
    this._isWatching = false;
    
    // Close all watchers
    for (const watcher of this._watchers) {
      try {
        watcher.close();
      } catch {
        // Ignore errors when closing
      }
    }
    this._watchers = [];
    
    // Clear debounce timers
    for (const timerId of this._debounceTimers.values()) {
      clearTimeout(timerId);
    }
    this._debounceTimers.clear();
  }

  /**
   * Start watching all island directories.
   */
  private async _startWatching(): Promise<void> {
    if (this._isWatching) return;
    
    this._isWatching = true;
    const directories = this._registry.directories;

    for (const directory of directories) {
      try {
        await this._watchDirectory(directory);
      } catch (error) {
        console.warn(
          `⚠️ Failed to watch island directory ${directory.relativePath}:`,
          error
        );
      }
    }

    if (directories.length > 0) {
      // Watching island directories for changes
    }
  }

  /**
   * Watch a single island directory for changes.
   */
  private async _watchDirectory(directory: IslandDirectory): Promise<void> {
    try {
      const watcher = Deno.watchFs(directory.path, { recursive: false });
      this._watchers.push(watcher);

      // Process events asynchronously
      this._processWatcherEvents(watcher, directory);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.warn(`⚠️ Island directory not found: ${directory.relativePath}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Process events from a file watcher.
   */
  private async _processWatcherEvents(
    watcher: Deno.FsWatcher,
    directory: IslandDirectory
  ): Promise<void> {
    try {
      for await (const event of watcher) {
        if (!this._isWatching) break;

        for (const path of event.paths) {
          // Only process supported island file extensions
          const ext = extname(path);
          if (!isSupportedIslandExtension(ext)) continue;

          // Debounce events for the same file
          this._debounceEvent(path, event.kind, directory);
        }
      }
    } catch (error) {
      // Watcher was closed or error occurred
      if (this._isWatching) {
        console.warn(`⚠️ Watcher error for ${directory.relativePath}:`, error);
      }
    }
  }

  /**
   * Debounce file change events to avoid duplicate processing.
   */
  private _debounceEvent(
    filePath: string,
    kind: Deno.FsEvent["kind"],
    directory: IslandDirectory
  ): void {
    // Clear existing timer for this file
    const existingTimer = this._debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timerId = setTimeout(() => {
      this._debounceTimers.delete(filePath);
      this._handleFileChange(filePath, kind, directory);
    }, this._options.debounceMs);

    this._debounceTimers.set(filePath, timerId);
  }

  /**
   * Handle a file change event.
   */
  private async _handleFileChange(
    filePath: string,
    kind: Deno.FsEvent["kind"],
    directory: IslandDirectory
  ): Promise<void> {
    const relativePath = relative(this._projectRoot, filePath).replace(/\\/g, "/");
    
    // Map Deno.FsEvent kind to our event type
    let eventType: IslandChangeEvent["type"];
    switch (kind) {
      case "create":
        eventType = "add";
        break;
      case "modify":
        eventType = "change";
        break;
      case "remove":
        eventType = "remove";
        break;
      default:
        // Ignore other event types (access, etc.)
        return;
    }

    // Try to find or create the island info
    let island: DiscoveredIsland | null = null;

    if (eventType === "remove") {
      // For remove events, try to find the island in the registry
      const qualifiedName = this._getQualifiedNameFromPath(filePath, directory);
      island = this._registry.resolve(qualifiedName) || null;
      
      // Remove from registry
      if (island) {
        this._registry.unregister(qualifiedName);
      }
    } else {
      // For add/change events, discover the island
      try {
        const islands = await discoverIslandsInDirectory(directory, this._projectRoot);
        island = islands.find(i => i.filePath === filePath) || null;
        
        // Update registry for new islands
        if (eventType === "add" && island) {
          this._registry.register(island);
        }
      } catch {
        // File might have been deleted between event and processing
        island = null;
      }
    }

    // Create and emit the change event
    const changeEvent: IslandChangeEvent = {
      type: eventType,
      island,
      filePath: relativePath,
      timestamp: Date.now(),
    };

    this._emitEvent(changeEvent);
  }

  /**
   * Get the qualified name for an island from its file path.
   */
  private _getQualifiedNameFromPath(
    filePath: string,
    directory: IslandDirectory
  ): string {
    const fileName = basename(filePath);
    const name = this._extractComponentName(fileName);
    
    if (directory.namespace === "") {
      return name;
    }
    return `${directory.namespace}/${name}`;
  }

  /**
   * Extract component name from file name.
   */
  private _extractComponentName(fileName: string): string {
    // Handle double extensions like .solid.tsx, .react.tsx, .lit.ts
    const frameworkPatterns = [
      ".solid.tsx", ".solid.jsx",
      ".react.tsx", ".react.jsx",
      ".lit.ts", ".lit.js",
      ".preact.tsx", ".preact.jsx",
    ];
    
    for (const pattern of frameworkPatterns) {
      if (fileName.endsWith(pattern)) {
        return fileName.slice(0, -pattern.length);
      }
    }
    
    // Handle single extensions
    const singleExtensions = [".tsx", ".ts", ".jsx", ".js", ".vue", ".svelte"];
    for (const ext of singleExtensions) {
      if (fileName.endsWith(ext)) {
        return fileName.slice(0, -ext.length);
      }
    }
    
    return fileName;
  }

  /**
   * Emit an event to all registered callbacks.
   */
  private _emitEvent(event: IslandChangeEvent): void {
    for (const callback of this._callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error("Error in island change callback:", error);
      }
    }
  }

  /**
   * Refresh the watcher to pick up new directories.
   * Call this after the registry is rebuilt.
   */
  async refresh(): Promise<void> {
    if (!this._isWatching) return;
    
    // Stop existing watchers
    for (const watcher of this._watchers) {
      try {
        watcher.close();
      } catch {
        // Ignore errors
      }
    }
    this._watchers = [];
    
    // Start watching new directories
    const directories = this._registry.directories;
    for (const directory of directories) {
      try {
        await this._watchDirectory(directory);
      } catch (error) {
        console.warn(
          `⚠️ Failed to watch island directory ${directory.relativePath}:`,
          error
        );
      }
    }
  }
}

/**
 * Create an island watcher for the given registry.
 * 
 * @param projectRoot - The root directory of the project
 * @param registry - The island registry to watch
 * @param config - Optional discovery configuration
 * @param options - Optional watcher options
 * @returns The island watcher instance
 */
export function createIslandWatcher(
  projectRoot: string,
  registry: IslandRegistry,
  config: IslandDiscoveryConfig = {},
  options: IslandWatcherOptions = {}
): IslandWatcher {
  return new IslandWatcher(projectRoot, registry, config, options);
}
