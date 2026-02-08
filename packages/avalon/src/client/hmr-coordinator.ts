/**
 * HMR Coordinator
 * 
 * Central orchestrator for all HMR operations in Avalon.
 * Integrates with Vite's HMR API and coordinates island updates across frameworks.
 */

/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import {
  type FrameworkHMRAdapter,
  type StateSnapshot,
  AdapterRegistry,
} from './framework-adapter.ts';
import { getCSSHMRHandler } from './css-hmr-handler.ts';

/**
 * Vite HMR types (defined locally to avoid import issues)
 */
export interface HMRPayload {
  type: string;
  updates?: Update[];
  timestamp?: number;
}

export interface ErrorPayload {
  type: 'error';
  err: {
    message: string;
    stack: string;
    id?: string;
    frame?: string;
    plugin?: string;
    pluginCode?: string;
    loc?: {
      file?: string;
      line: number;
      column: number;
    };
  };
}

export interface Update {
  type: 'js-update' | 'css-update';
  path: string;
  acceptedPath: string;
  timestamp: number;
  explicitImportRequired?: boolean;
}

/**
 * HMR update payload from Vite
 */
export interface HMRUpdatePayload extends HMRPayload {
  type: 'update' | 'full-reload' | 'prune' | 'error';
  updates?: ModuleUpdate[];
  timestamp?: number;
  err?: ErrorPayload;
}

/**
 * Individual module update information
 */
export interface ModuleUpdate {
  type: 'js-update' | 'css-update';
  path: string;
  acceptedPath: string;
  timestamp: number;
}

// Re-export types for backward compatibility
export type { FrameworkHMRAdapter, StateSnapshot } from './framework-adapter.ts';

/**
 * HMR Coordinator class
 * Manages HMR lifecycle and coordinates updates across islands
 */
export class HMRCoordinator {
  private registry: AdapterRegistry = new AdapterRegistry();
  private stateSnapshots: Map<string, StateSnapshot> = new Map();
  private updateQueue: Set<string> = new Set();
  private isProcessing = false;

  /**
   * Initialize the HMR coordinator
   * Sets up Vite HMR listeners and accepts updates
   */
  initialize(): void {
    console.log('🔧 Initializing HMR Coordinator...');
    
    // @ts-ignore - Vite HMR is available in browser context
    if (!import.meta.hot) {
      console.warn('⚠️ HMR not available - running in production mode');
      return;
    }

    console.log('✓ Vite HMR API detected');

    // Accept updates to this module
    // @ts-ignore - Vite HMR API
    import.meta.hot.accept();
    console.log('✓ HMR self-acceptance enabled');

    // Listen for Vite HMR events
    // @ts-ignore - Vite HMR event types
    import.meta.hot.on('vite:beforeUpdate', (payload: HMRPayload) => {
      console.log('📥 Received vite:beforeUpdate event', payload);
      this.handleUpdate(payload as HMRUpdatePayload);
    });
    console.log('✓ Registered vite:beforeUpdate listener');

    // Handle full page reloads
    // @ts-ignore - Vite HMR event types
    import.meta.hot.on('vite:beforeFullReload', () => {
      console.log('🔄 Full page reload requested');
      this.handleBeforeFullReload();
    });
    console.log('✓ Registered vite:beforeFullReload listener');

    // Handle errors
    // @ts-ignore - Vite HMR event types
    import.meta.hot.on('vite:error', (payload: ErrorPayload) => {
      console.error('❌ HMR error received:', payload);
      this.handleError(payload);
    });
    console.log('✓ Registered vite:error listener');

    // Listen for CSS module update events that require island re-render
    document.addEventListener('hmr-update-required', (event: Event) => {
      const customEvent = event as CustomEvent;
      const { src, reason } = customEvent.detail;
      console.log('🎨 CSS module update required:', { src, reason });
      
      if (reason === 'css-module-update') {
        // Queue the island for update
        this.updateQueue.add(this.normalizePath(src));
        
        // Process the queue if not already processing
        if (!this.isProcessing) {
          this.processUpdateQueue().catch(error => {
            console.error('Failed to process CSS module update:', error);
          });
        }
      }
    });
    console.log('✓ Registered CSS module update listener');

    console.log('✅ HMR Coordinator initialized successfully');
  }

  /**
   * Register a framework-specific HMR adapter
   */
  registerAdapter(framework: string, adapter: FrameworkHMRAdapter): void {
    console.log(`📝 Registering HMR adapter for ${framework}`);
    this.registry.register(framework, adapter);
    console.log(`✓ ${framework} adapter registered successfully`);
  }
  
  /**
   * Get the adapter registry
   * Useful for testing and debugging
   */
  getRegistry(): AdapterRegistry {
    return this.registry;
  }

  /**
   * Handle HMR update event from Vite
   */
  async handleUpdate(payload: HMRUpdatePayload): Promise<void> {
    console.log('🔄 handleUpdate called with payload:', payload);
    
    if (payload.type !== 'update' || !payload.updates) {
      console.log('⏭️ Skipping non-update payload or payload without updates');
      return;
    }

    console.log(`📦 Processing ${payload.updates.length} update(s)`);

    // Separate CSS and JS updates
    const cssUpdates: ModuleUpdate[] = [];
    const jsUpdates: ModuleUpdate[] = [];

    for (const update of payload.updates) {
      if (update.type === 'css-update') {
        cssUpdates.push(update);
      } else {
        jsUpdates.push(update);
      }
    }

    console.log(`🎨 CSS updates: ${cssUpdates.length}, 📜 JS updates: ${jsUpdates.length}`);

    // Handle CSS updates immediately
    if (cssUpdates.length > 0) {
      const cssHandler = getCSSHMRHandler();
      for (const cssUpdate of cssUpdates) {
        try {
          console.log('🎨 Processing CSS update:', cssUpdate.path);
          cssHandler.handleCSSUpdate(cssUpdate);
        } catch (error) {
          console.error('CSS HMR failed:', error);
          // Continue with other updates even if CSS update fails
        }
      }
    }

    // Queue JS updates for processing
    for (const update of jsUpdates) {
      const normalizedPath = this.normalizePath(update.path || update.acceptedPath);
      console.log('📜 Checking JS update:', normalizedPath);
      
      // Check if this is an island component
      if (this.isIslandModule(normalizedPath)) {
        this.updateQueue.add(normalizedPath);
      } else {
        console.log('⏭️ Not an island module, skipping:', normalizedPath);
      }
    }

    // Process queued updates
    if (!this.isProcessing && this.updateQueue.size > 0) {
      console.log(`⚙️ Processing ${this.updateQueue.size} queued update(s)`);
      await this.processUpdateQueue();
    } else if (this.updateQueue.size > 0) {
      console.log('⏳ Updates queued, but already processing');
    } else {
      console.log('✓ No island updates to process');
    }
  }

  /**
   * Process queued HMR updates
   */
  private async processUpdateQueue(): Promise<void> {
    if (this.updateQueue.size === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get all queued paths
      const paths = Array.from(this.updateQueue);
      this.updateQueue.clear();

      // Find all affected islands
      const affectedIslands = new Map<string, HTMLElement[]>();
      
      for (const path of paths) {
        const islands = this.findAffectedIslands(path);
        if (islands.length > 0) {
          affectedIslands.set(path, islands);
        }
      }

      // Update all affected islands
      for (const [path, islands] of affectedIslands) {
        console.log(`🔄 HMR: Updating ${islands.length} island(s) for ${path}`);
        
        for (const island of islands) {
          try {
            await this.updateIsland(island);
          } catch (error) {
            console.error(`Failed to update island:`, error);
            // Continue with other islands even if one fails
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Find all islands affected by a module update
   */
  findAffectedIslands(modulePath: string): HTMLElement[] {
    console.log('🔍 Finding affected islands for:', modulePath);
    const islands: HTMLElement[] = [];
    const normalizedPath = this.normalizePath(modulePath);
    console.log('🔍 Normalized path:', normalizedPath);

    // Find islands with matching data-src attribute
    const allIslands = document.querySelectorAll<HTMLElement>('[data-src]');
    console.log(`🔍 Found ${allIslands.length} total island(s) in DOM`);
    
    for (const island of allIslands) {
      const src = island.getAttribute('data-src');
      if (!src) continue;

      const normalizedSrc = this.normalizePath(src);
      
      // Check for exact match or partial match (for nested paths)
      // Both paths are now normalized without /src/ prefix, so they should match
      const isMatch = 
        normalizedSrc === normalizedPath ||
        normalizedSrc.endsWith(normalizedPath) ||
        normalizedPath.endsWith(normalizedSrc) ||
        // Also check if the file names match (for cases where paths differ)
        normalizedSrc.split('/').pop() === normalizedPath.split('/').pop();
      
      if (isMatch) {
        console.log('✓ Found matching island:', { 
          src, 
          normalizedSrc, 
          framework: island.getAttribute('data-framework'),
          matchReason: normalizedSrc === normalizedPath ? 'exact' : 
                      normalizedSrc.endsWith(normalizedPath) ? 'src-ends-with-path' :
                      normalizedPath.endsWith(normalizedSrc) ? 'path-ends-with-src' : 'filename'
        });
        islands.push(island);
      }
    }

    console.log(`🔍 Found ${islands.length} affected island(s)`);
    return islands;
  }

  /**
   * Update a single island component
   */
  async updateIsland(island: HTMLElement): Promise<void> {
    const framework = island.getAttribute('data-framework');
    const src = island.getAttribute('data-src');
    const propsAttr = island.getAttribute('data-props');

    console.log('🔄 Updating island:', { framework, src });

    if (!framework || !src) {
      console.warn('⚠️ Island missing framework or src attribute', island);
      return;
    }

    const adapter = this.registry.get(framework.toLowerCase());
    if (!adapter) {
      console.warn(`⚠️ No HMR adapter registered for framework: ${framework}`);
      return;
    }

    console.log(`✓ Found adapter for ${framework}`);

    try {
      // Parse props
      const props = propsAttr ? JSON.parse(propsAttr) : {};
      console.log('📦 Island props:', props);

      // Preserve state before update
      console.log('💾 Preserving state...');
      const state = adapter.preserveState(island);
      if (state) {
        const islandId = this.getIslandId(island);
        this.stateSnapshots.set(islandId, state);
        console.log('✓ State preserved:', islandId);
      } else {
        console.log('ℹ️ No state to preserve');
      }

      // Mark as not hydrated to allow re-hydration
      island.removeAttribute('data-hydrated');
      island.removeAttribute('data-hydration-status');
      console.log('✓ Cleared hydration markers');

      // Clear any error indicators
      const errorIndicator = island.querySelector('.hydration-error-indicator, .hmr-error-indicator');
      if (errorIndicator) {
        errorIndicator.remove();
        console.log('✓ Cleared error indicators');
      }

      // Import the fresh module with cache busting
      const timestamp = Date.now();
      const freshSrc = src.includes('?') 
        ? `${src}&t=${timestamp}` 
        : `${src}?t=${timestamp}`;

      console.log('📥 Importing fresh module:', freshSrc);
      const componentModule = await import(/* @vite-ignore */ freshSrc);
      let Component = componentModule.default;

      // Fallback to named exports if no default
      if (!Component) {
        console.log('ℹ️ No default export, checking named exports...');
        const exports = Object.keys(componentModule).filter(key => key !== 'default');
        for (const exportName of exports) {
          const exportValue = componentModule[exportName];
          if (typeof exportValue === 'function' && exportValue.prototype) {
            Component = exportValue;
            console.log(`✓ Found component in named export: ${exportName}`);
            break;
          }
        }
      }

      if (!Component) {
        throw new Error(`Component ${src} has no default export`);
      }

      console.log('✓ Component loaded successfully');

      // Update the component using the adapter
      console.log('🔄 Calling adapter.update()...');
      await adapter.update(island, Component, props);
      console.log('✓ Adapter update complete');

      // Restore state after update
      if (state) {
        console.log('♻️ Restoring state...');
        adapter.restoreState(island, state);
        const islandId = this.getIslandId(island);
        this.stateSnapshots.delete(islandId);
        console.log('✓ State restored');
      }

      // Mark as hydrated
      island.setAttribute('data-hydrated', 'true');
      console.log('✓ Marked as hydrated');

      // Dispatch success event
      island.dispatchEvent(new CustomEvent('hmr-update', {
        detail: {
          framework,
          src,
          timestamp: Date.now(),
          success: true,
        },
        bubbles: true,
      }));

      console.log(`✅ HMR: Successfully updated ${framework} island ${src}`);
    } catch (error) {
      console.error(`❌ HMR failed for ${framework} island ${src}:`, error);
      
      // Handle error using adapter
      adapter.handleError(island, error as Error);

      // Dispatch error event
      island.dispatchEvent(new CustomEvent('hmr-error', {
        detail: {
          framework,
          src,
          error: (error as Error).message,
          timestamp: Date.now(),
        },
        bubbles: true,
      }));

      throw error;
    }
  }

  /**
   * Handle before full reload event
   * Preserves state for restoration after reload
   */
  private handleBeforeFullReload(): void {
    const islands = document.querySelectorAll<HTMLElement>('[data-hydrated="true"]');
    const states: Record<string, StateSnapshot> = {};

    for (const island of islands) {
      const framework = island.getAttribute('data-framework');
      const src = island.getAttribute('data-src');
      
      if (!framework || !src) continue;

      const adapter = this.registry.get(framework.toLowerCase());
      if (!adapter) continue;

      const state = adapter.preserveState(island);
      if (state) {
        states[src] = state;
      }
    }

    // Store in sessionStorage for restoration after reload
    try {
      sessionStorage.setItem('__avalon_hmr_states__', JSON.stringify(states));
    } catch (error) {
      console.warn('Failed to save HMR states:', error);
    }
  }

  /**
   * Handle HMR error
   */
  private handleError(payload: ErrorPayload): void {
    const error = new Error(payload.err.message);
    error.stack = payload.err.stack;
    
    console.error('HMR Error:', error);
    
    // Show error overlay if available
    if (typeof window !== 'undefined') {
      import('./hmr-error-overlay.js').then(({ showHMRErrorOverlay }) => {
        showHMRErrorOverlay({
          framework: 'unknown',
          src: 'unknown',
          error,
          filePath: payload.err.id || payload.err.loc?.file || 'unknown',
          line: payload.err.loc?.line,
          column: payload.err.loc?.column,
        });
      }).catch(() => {
        // Fallback to console if overlay fails
        console.error('Failed to show error overlay');
      });
    }
  }

  /**
   * Normalize a module path for comparison
   */
  private normalizePath(path: string): string {
    let normalized = path
      .replace(/\\/g, '/')
      .replace(/^\//, '')
      .replace(/\?.*$/, '')
      .replace(/#.*$/, '');
    
    // Handle Vite's path variations:
    // Vite might send: /islands/Counter.tsx
    // But data-src has: /src/islands/Counter.tsx
    // So we need to normalize both to the same format
    
    // Remove /src/ prefix if present for comparison
    normalized = normalized.replace(/^src\//, '');
    
    return normalized;
  }

  /**
   * Check if a module path is an island component
   */
  private isIslandModule(path: string): boolean {
    return path.includes('/islands/') || path.includes('\\islands\\');
  }

  /**
   * Get a unique identifier for an island
   */
  private getIslandId(island: HTMLElement): string {
    const src = island.getAttribute('data-src') || '';
    const framework = island.getAttribute('data-framework') || '';
    const index = Array.from(document.querySelectorAll(`[data-src="${src}"]`)).indexOf(island);
    return `${framework}:${src}:${index}`;
  }
}

/**
 * Global HMR coordinator instance
 */
let coordinatorInstance: HMRCoordinator | null = null;

/**
 * Get or create the global HMR coordinator instance
 */
export function getHMRCoordinator(): HMRCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new HMRCoordinator();
  }
  return coordinatorInstance;
}

/**
 * Initialize HMR support
 * Should be called once during application startup
 */
export function initializeHMR(): void {
  // @ts-ignore - Vite HMR is available in browser context
  if (!import.meta.hot) {
    return;
  }

  const coordinator = getHMRCoordinator();
  coordinator.initialize();
}
