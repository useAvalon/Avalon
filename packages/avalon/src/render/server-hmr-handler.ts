/**
 * Server-side HMR handler for Avalon
 * Handles module invalidation for pages, layouts, API routes, and middleware
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import type { ViteDevServer, ModuleNode } from 'vite';

export interface ServerHMRHandlerConfig {
  /**
   * Enable debug logging
   */
  debugLogging?: boolean;

  /**
   * Patterns to identify different module types
   */
  patterns?: {
    pages?: RegExp;
    layouts?: RegExp;
    apiRoutes?: RegExp;
    middleware?: RegExp;
  };

  /**
   * Error handling configuration
   */
  errorHandling?: {
    /**
     * Keep server running on syntax errors
     */
    keepAlive?: boolean;

    /**
     * Display errors in browser
     */
    displayInBrowser?: boolean;
  };
}

export interface ModuleInvalidationResult {
  success: boolean;
  invalidatedModules: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Default patterns for identifying module types
 */
const DEFAULT_PATTERNS = {
  pages: /\/pages\/.*\.(tsx?|jsx?|mdx?)$/,
  layouts: /\/_layout\.(tsx?|jsx?)$/,
  apiRoutes: /\/api\/.*\.(ts|js)$/,
  middleware: /\/_middleware\.(ts|js)$/,
};


/**
 * ServerHMRHandler manages server-side module invalidation and hot reloading
 * for pages, layouts, API routes, and middleware without requiring server restarts.
 */
export class ServerHMRHandler {
  private viteServer: ViteDevServer | null = null;
  private config: Required<ServerHMRHandlerConfig>;
  private invalidationCache = new Map<string, number>();
  private errorCache = new Map<string, Error>();

  constructor(config: ServerHMRHandlerConfig = {}) {
    this.config = {
      debugLogging: config.debugLogging ?? false,
      patterns: {
        pages: config.patterns?.pages ?? DEFAULT_PATTERNS.pages,
        layouts: config.patterns?.layouts ?? DEFAULT_PATTERNS.layouts,
        apiRoutes: config.patterns?.apiRoutes ?? DEFAULT_PATTERNS.apiRoutes,
        middleware: config.patterns?.middleware ?? DEFAULT_PATTERNS.middleware,
      },
      errorHandling: {
        keepAlive: config.errorHandling?.keepAlive ?? true,
        displayInBrowser: config.errorHandling?.displayInBrowser ?? true,
      },
    };
  }

  /**
   * Initialize server-side HMR with Vite dev server
   * Requirements: 3.1, 3.2, 3.3, 3.4
   */
  initialize(viteServer: ViteDevServer): void {
    this.viteServer = viteServer;

    console.log('🔥 [ServerHMR] Initialized with Vite dev server');

    // Set up file watcher for server-side modules
    this.setupFileWatcher();
  }

  /**
   * Set up file watcher for server-side module changes
   */
  private setupFileWatcher(): void {
    if (!this.viteServer) {
      throw new Error('Vite server not initialized');
    }

    // Listen to Vite's file change events
    this.viteServer.watcher.on('change', async (filePath: string) => {
      console.log(`👀 [ServerHMR] Watcher detected change: ${filePath}`);
      await this.handleFileChange(filePath);
    });

    // Also listen for add events (new files)
    this.viteServer.watcher.on('add', async (filePath: string) => {
      console.log(`➕ [ServerHMR] Watcher detected new file: ${filePath}`);
      await this.handleFileChange(filePath);
    });

    console.log('[ServerHMR] File watcher set up and listening');
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(filePath: string): Promise<void> {
    try {
      // Normalize path for consistent matching
      const normalizedPath = filePath.replace(/\\/g, '/');

      console.log(`📝 [ServerHMR] Processing file change: ${normalizedPath}`);

      // Debug: Show pattern matching
      const isPage = this.config.patterns?.pages?.test(normalizedPath);
      const isLayout = this.config.patterns?.layouts?.test(normalizedPath);
      const isApiRoute = this.config.patterns?.apiRoutes?.test(normalizedPath);
      const isMiddleware = this.config.patterns?.middleware?.test(normalizedPath);
      
      console.log(`   Pattern matches - page: ${isPage}, layout: ${isLayout}, api: ${isApiRoute}, middleware: ${isMiddleware}`);

      // Determine module type and handle accordingly
      if (isPage) {
        console.log(`📄 [ServerHMR] Detected page change: ${normalizedPath}`);
        await this.handlePageUpdate(normalizedPath);
      } else if (isLayout) {
        console.log(`🎨 [ServerHMR] Detected layout change: ${normalizedPath}`);
        await this.handleLayoutUpdate(normalizedPath);
      } else if (isApiRoute) {
        console.log(`🔌 [ServerHMR] Detected API route change: ${normalizedPath}`);
        await this.handleAPIRouteUpdate(normalizedPath);
      } else if (isMiddleware) {
        console.log(`⚙️ [ServerHMR] Detected middleware change: ${normalizedPath}`);
        await this.handleMiddlewareUpdate(normalizedPath);
      } else {
        console.log(`   [ServerHMR] File type not handled by server HMR (island/component changes handled by Vite)`);
      }
    } catch (error) {
      this.handleError(filePath, error as Error);
    }
  }


  /**
   * Handle page module update
   * Requirements: 3.1
   */
  async handlePageUpdate(modulePath: string): Promise<ModuleInvalidationResult> {
    if (this.config.debugLogging) {
      console.log(`[ServerHMR] Handling page update: ${modulePath}`);
    }

    try {
      // Invalidate the page module
      await this.invalidateModule(modulePath);

      // Clear any cached errors for this module
      this.errorCache.delete(modulePath);

      // Trigger browser refresh to show updated page content
      this.triggerBrowserRefresh(modulePath, 'page');

      return {
        success: true,
        invalidatedModules: [modulePath],
        errors: [],
        warnings: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        invalidatedModules: [],
        errors: [errorMessage],
        warnings: [],
      };
    }
  }

  /**
   * Handle layout module update
   * Requirements: 3.2
   */
  async handleLayoutUpdate(modulePath: string): Promise<ModuleInvalidationResult> {
    if (this.config.debugLogging) {
      console.log(`[ServerHMR] Handling layout update: ${modulePath}`);
    }

    try {
      // Invalidate the layout module
      await this.invalidateModule(modulePath);

      // Find all pages that depend on this layout
      const dependentPages = await this.findDependentModules(modulePath);

      // Invalidate all dependent pages
      for (const pagePath of dependentPages) {
        await this.invalidateModule(pagePath);
      }

      // Clear any cached errors
      this.errorCache.delete(modulePath);

      // Trigger browser refresh to show updated layout
      this.triggerBrowserRefresh(modulePath, 'layout');

      return {
        success: true,
        invalidatedModules: [modulePath, ...dependentPages],
        errors: [],
        warnings: dependentPages.length > 0 
          ? [`Invalidated ${dependentPages.length} dependent pages`]
          : [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        invalidatedModules: [],
        errors: [errorMessage],
        warnings: [],
      };
    }
  }


  /**
   * Handle API route update
   * Requirements: 3.3
   */
  async handleAPIRouteUpdate(modulePath: string): Promise<ModuleInvalidationResult> {
    if (this.config.debugLogging) {
      console.log(`[ServerHMR] Handling API route update: ${modulePath}`);
    }

    try {
      // Invalidate the API route module
      await this.invalidateModule(modulePath);

      // Clear any cached errors
      this.errorCache.delete(modulePath);

      // Send custom event to browser for toast notification (no full reload needed)
      this.sendCustomHMREvent('avalon:api-route-updated', {
        path: modulePath,
        timestamp: Date.now(),
        message: `API route updated: ${modulePath}`,
      });

      return {
        success: true,
        invalidatedModules: [modulePath],
        errors: [],
        warnings: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        invalidatedModules: [],
        errors: [errorMessage],
        warnings: [],
      };
    }
  }

  /**
   * Handle middleware update
   * Requirements: 3.4
   */
  async handleMiddlewareUpdate(modulePath: string): Promise<ModuleInvalidationResult> {
    if (this.config.debugLogging) {
      console.log(`[ServerHMR] Handling middleware update: ${modulePath}`);
    }

    try {
      // Invalidate the middleware module
      await this.invalidateModule(modulePath);

      // Clear any cached errors
      this.errorCache.delete(modulePath);

      // Trigger browser refresh - middleware affects all requests
      this.triggerBrowserRefresh(modulePath, 'middleware');

      return {
        success: true,
        invalidatedModules: [modulePath],
        errors: [],
        warnings: ['Middleware chain will be rebuilt on next request'],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        invalidatedModules: [],
        errors: [errorMessage],
        warnings: [],
      };
    }
  }


  /**
   * Invalidate a module and its dependents in the Vite module graph
   * Requirements: 3.1, 3.3, 3.4
   */
  async invalidateModule(modulePath: string): Promise<void> {
    if (!this.viteServer) {
      throw new Error('Vite server not initialized');
    }

    try {
      // Get the module from Vite's module graph
      const module = await this.viteServer.moduleGraph.getModuleByUrl(modulePath);

      if (module) {
        // Invalidate the module
        this.viteServer.moduleGraph.invalidateModule(module);

        // Track invalidation
        this.invalidationCache.set(modulePath, Date.now());

        if (this.config.debugLogging) {
          console.log(`[ServerHMR] Invalidated module: ${modulePath}`);
        }
      } else {
        // Module not in graph yet, try to resolve it
        const resolvedModule = this.viteServer.moduleGraph.getModuleById(modulePath);
        
        if (resolvedModule) {
          this.viteServer.moduleGraph.invalidateModule(resolvedModule);
          this.invalidationCache.set(modulePath, Date.now());

          if (this.config.debugLogging) {
            console.log(`[ServerHMR] Invalidated resolved module: ${modulePath}`);
          }
        } else {
          if (this.config.debugLogging) {
            console.log(`[ServerHMR] Module not found in graph: ${modulePath}`);
          }
        }
      }
    } catch (error) {
      console.error(`[ServerHMR] Error invalidating module ${modulePath}:`, error);
      throw error;
    }
  }

  /**
   * Find all modules that depend on the given module
   * Requirements: 3.2
   */
  private async findDependentModules(modulePath: string): Promise<string[]> {
    if (!this.viteServer) {
      return [];
    }

    const dependents: string[] = [];
    const module = await this.viteServer.moduleGraph.getModuleByUrl(modulePath);

    if (!module) {
      return dependents;
    }

    // Traverse the module graph to find importers
    const visited = new Set<ModuleNode>();
    const queue: ModuleNode[] = [module];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current)) {
        continue;
      }
      
      visited.add(current);

      // Add importers to the queue
      for (const importer of current.importers) {
        if (importer.url && this.config.patterns?.pages?.test(importer.url)) {
          dependents.push(importer.url);
        }
        queue.push(importer);
      }
    }

    return dependents;
  }


  /**
   * Handle errors during HMR updates
   * Requirements: 3.5
   */
  private handleError(modulePath: string, error: Error): void {
    // Cache the error
    this.errorCache.set(modulePath, error);

    if (this.config.errorHandling.keepAlive) {
      // Log error but keep server running
      console.error(`[ServerHMR] Error in ${modulePath}:`, error);

      if (this.config.errorHandling.displayInBrowser && this.viteServer) {
        // Send error to browser via HMR
        this.viteServer.ws.send('error', {
          type: 'error',
          err: {
            message: error.message,
            stack: error.stack,
            id: modulePath,
            frame: this.extractErrorFrame(error),
            plugin: 'avalon-server-hmr',
            loc: this.extractErrorLocation(error),
          },
        });
      }
    } else {
      // Re-throw error to crash the server
      throw error;
    }
  }

  /**
   * Extract error frame from error stack
   */
  private extractErrorFrame(error: Error): string | undefined {
    if (!error.stack) {
      return undefined;
    }

    // Try to extract the relevant code frame from the stack
    const lines = error.stack.split('\n');
    const relevantLines = lines.slice(0, 5);
    return relevantLines.join('\n');
  }

  /**
   * Extract error location from error
   */
  private extractErrorLocation(error: Error): { file?: string; line?: number; column?: number } | undefined {
    if (!error.stack) {
      return undefined;
    }

    // Try to parse location from stack trace
    const stackLine = error.stack.split('\n')[1];
    if (!stackLine) {
      return undefined;
    }

    // Match patterns like "at file:///path/to/file.ts:10:5"
    const match = stackLine.match(/at\s+(?:.*\s+\()?(.+):(\d+):(\d+)\)?/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
      };
    }

    return undefined;
  }


  /**
   * Trigger browser refresh via Vite's WebSocket
   * Requirements: 3.1, 3.2, 3.4
   */
  private triggerBrowserRefresh(modulePath: string, moduleType: 'page' | 'layout' | 'middleware'): void {
    if (!this.viteServer) {
      console.warn('[ServerHMR] Cannot trigger browser refresh: Vite server not initialized');
      return;
    }

    console.log(`🔄 [ServerHMR] Triggering browser refresh for ${moduleType}: ${modulePath}`);

    // Send full-reload signal to browser
    this.viteServer.ws.send({
      type: 'full-reload',
      path: modulePath,
    });
  }

  /**
   * Send custom HMR event to browser (for API routes that don't need full reload)
   * Requirements: 3.3
   */
  private sendCustomHMREvent(eventType: string, data: Record<string, unknown>): void {
    if (!this.viteServer) {
      console.warn('[ServerHMR] Cannot send custom HMR event: Vite server not initialized');
      return;
    }

    // Send custom event that client can listen to
    this.viteServer.ws.send({
      type: 'custom',
      event: eventType,
      data,
    });
  }

  /**
   * Get cached error for a module
   */
  getCachedError(modulePath: string): Error | undefined {
    return this.errorCache.get(modulePath);
  }

  /**
   * Clear cached error for a module
   */
  clearCachedError(modulePath: string): void {
    this.errorCache.delete(modulePath);
  }

  /**
   * Get invalidation timestamp for a module
   */
  getInvalidationTimestamp(modulePath: string): number | undefined {
    return this.invalidationCache.get(modulePath);
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.invalidationCache.clear();
    this.errorCache.clear();
  }

  /**
   * Get statistics about HMR operations
   */
  getStats(): {
    totalInvalidations: number;
    cachedErrors: number;
    recentInvalidations: Array<{ path: string; timestamp: number }>;
  } {
    const recentInvalidations = Array.from(this.invalidationCache.entries())
      .map(([path, timestamp]) => ({ path, timestamp }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return {
      totalInvalidations: this.invalidationCache.size,
      cachedErrors: this.errorCache.size,
      recentInvalidations,
    };
  }
}
