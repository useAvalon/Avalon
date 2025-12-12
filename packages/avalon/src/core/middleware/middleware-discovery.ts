import { join, resolve, relative } from 'node:path';
import { existsSync } from '@std/fs';
import type {
	MiddlewareRoute,
	MiddlewareHandler,
	MiddlewareDiscoveryOptions,
	MiddlewareFileExport,
	MiddlewareErrorHandler,
	MiddlewareWatcherCallback,
} from '../../schemas/middleware.ts';
import { createDefaultErrorHandler } from './middleware-error-handler.ts';

/**
 * Middleware discovery system that scans the file system for _middleware.ts files
 * and builds middleware chains based on URL patterns.
 *
 * Requirements: 1.1, 2.2, 3.2, 5.3
 */
export class MiddlewareDiscovery {
	private middlewareCache = new Map<string, MiddlewareHandler>();
	private routeCache = new Map<string, MiddlewareRoute[]>();
	private watchMode = false;
	private baseDirectory: string;
	private filePattern: string;
	private excludeDirectories: string[];
	private errorHandler: MiddlewareErrorHandler;
	private fileWatcher?: AsyncIterable<Deno.FsEvent>;
	private watcherAbortController?: AbortController;
	private watcherCallback?: MiddlewareWatcherCallback;
	private developmentMode: boolean;

	constructor(
		options: MiddlewareDiscoveryOptions & { errorHandler?: MiddlewareErrorHandler; developmentMode?: boolean }
	) {
		this.baseDirectory = resolve(options.baseDirectory);
		this.filePattern = options.filePattern || '_middleware.ts';
		this.excludeDirectories = options.excludeDirectories || ['node_modules', '.git', 'dist'];
		this.developmentMode = options.developmentMode || false;
		this.errorHandler = options.errorHandler || createDefaultErrorHandler(this.developmentMode);

		if (options.enableWatching) {
			this.enableWatchMode();
		}
	}

	/**
	 * Discovers all middleware files in the file system
	 * Requirements: 1.1, 5.3
	 */
	async discoverMiddleware(): Promise<MiddlewareRoute[]> {
		const cacheKey = 'all-middleware';

		if (this.routeCache.has(cacheKey) && !this.watchMode) {
			return this.routeCache.get(cacheKey)!;
		}

		const routes: MiddlewareRoute[] = [];

		// Scan for middleware files starting from base directory
		await this.scanDirectory(this.baseDirectory, '', routes);

		// Sort by priority (lower numbers execute first)
		routes.sort((a, b) => a.priority - b.priority);

		this.routeCache.set(cacheKey, routes);
		return routes;
	}

	/**
	 * Builds middleware chain for a specific URL
	 * Requirements: 2.2, 3.2
	 */
	async buildMiddlewareChain(url: URL): Promise<MiddlewareHandler[]> {
		const routes = await this.discoverMiddleware();
		const matchingRoutes: MiddlewareRoute[] = [];

		// Find all middleware routes that match the URL
		for (const route of routes) {
			if (route.pattern.test(url)) {
				// Special logic: pages middleware should not match API routes
				if (route.type === 'pages' && url.pathname.startsWith('/api')) {
					continue;
				}
				// Special logic: API middleware should not match page routes (non-API routes)
				if (route.type === 'api' && !url.pathname.startsWith('/api')) {
					continue;
				}
				matchingRoutes.push(route);
			}
		}

		// Sort by priority to ensure correct execution order
		matchingRoutes.sort((a, b) => a.priority - b.priority);

		// Load middleware handlers
		const middlewareChain: MiddlewareHandler[] = [];

		for (const route of matchingRoutes) {
			try {
				const handler = await this.loadMiddleware(route.middlewarePath);
				if (handler) {
					middlewareChain.push(handler);
				}
			} catch (error) {
				// Log error but continue with other middleware
				if (this.developmentMode) {
					console.warn(
						`[Middleware] Failed to load middleware ${route.middlewarePath}: ${
							error instanceof Error ? error.message : String(error)
						}`
					);
				}
				// Continue with other middleware
			}
		}

		return middlewareChain;
	}

	/**
	 * Recursively scans directory for middleware files
	 * Requirements: 1.1, 2.2, 3.2
	 */
	private async scanDirectory(dirPath: string, relativePath: string, routes: MiddlewareRoute[]) {
		try {
			if (!existsSync(dirPath)) {
				return;
			}

			for await (const entry of Deno.readDir(dirPath)) {
				const fullPath = join(dirPath, entry.name);
				const entryRelativePath = relativePath ? join(relativePath, entry.name) : entry.name;

				// Skip excluded directories
				if (this.excludeDirectories.includes(entry.name)) {
					continue;
				}

				const stats = await Deno.stat(fullPath);

				if (stats.isDirectory) {
					// Recursively scan subdirectories
					await this.scanDirectory(fullPath, entryRelativePath, routes);
				} else if (entry.name === this.filePattern) {
					// Found a middleware file
					const route = this.createMiddlewareRoute(fullPath, relativePath);
					if (route) {
						routes.push(route);
					}
				}
			}
		} catch (error) {
			this.errorHandler.handleDiscoveryError(error as Error, dirPath);
		}
	}

	/**
	 * Creates a middleware route configuration from a file path
	 * Requirements: 1.1, 2.2, 3.2
	 */
	private createMiddlewareRoute(filePath: string, relativePath: string) {
		try {
			const pathParts = relativePath.split('/').filter(Boolean);

			// Determine middleware type and create URL pattern
			let type: 'global' | 'pages' | 'api';
			let pattern: URLPattern;
			let priority: number;

			if (relativePath === '') {
				// Global middleware (src/_middleware.ts)
				type = 'global';
				pattern = new URLPattern({ pathname: '*' });
				priority = 0; // Highest priority
			} else if (pathParts[0] === 'pages') {
				// Page middleware
				type = 'pages';
				const pagePath = pathParts.slice(1).join('/');
				// For pages, the URL pattern should match actual page routes, not /pages/...
				const patternPath = pagePath ? `/${pagePath}/*` : '/*';
				pattern = new URLPattern({ pathname: patternPath });
				priority = 10 + pathParts.length; // Lower priority, deeper = later
			} else if (pathParts[0] === 'api') {
				// API middleware
				type = 'api';
				const apiPath = pathParts.slice(1).join('/');
				const patternPath = apiPath ? `/api/${apiPath}/*` : '/api/*';
				pattern = new URLPattern({ pathname: patternPath });
				priority = 10 + pathParts.length; // Lower priority, deeper = later
			} else {
				// Unknown middleware location, treat as global with lower priority
				type = 'global';
				pattern = new URLPattern({ pathname: '*' });
				priority = 100 + pathParts.length;
			}

			return {
				pattern,
				middlewarePath: filePath,
				priority,
				type,
			};
		} catch (error) {
			this.errorHandler.handleDiscoveryError(error as Error, filePath);
			return null;
		}
	}

	/**
	 * Loads middleware handler from file
	 * Requirements: 5.3
	 */
	private async loadMiddleware(filePath: string) {
		try {
			// Check cache first
			if (this.middlewareCache.has(filePath)) {
				return this.middlewareCache.get(filePath)!;
			}

			// Dynamic import the middleware file
			const middlewareModule = (await import(filePath)) as MiddlewareFileExport;

			if (!middlewareModule.default || typeof middlewareModule.default !== 'function') {
				const error = new Error(`Middleware file does not export a default function`);
				this.errorHandler.handleDiscoveryError(error, filePath);
				return null;
			}

			const handler = middlewareModule.default;

			// Cache the handler
			this.middlewareCache.set(filePath, handler);

			return handler;
		} catch (error) {
			this.errorHandler.handleDiscoveryError(error as Error, filePath);
			return null;
		}
	}

	/**
	 * Enables watch mode for hot reloading in development
	 * Requirements: 5.4
	 */
	private enableWatchMode() {
		this.watchMode = true;
		this.startFileWatcher();
	}

	/**
	 * Starts file watcher for middleware files
	 * Requirements: 5.4
	 */
	private startFileWatcher() {
		if (!this.developmentMode) {
			return;
		}

		try {
			// Check if directory exists before trying to watch it
			if (!existsSync(this.baseDirectory)) {
				if (this.developmentMode) {
					console.log(`[Middleware] Directory ${this.baseDirectory} does not exist, skipping file watcher`);
				}
				return;
			}

			// Create abort controller for stopping the watcher
			this.watcherAbortController = new AbortController();

			// Start watching the base directory recursively
			this.fileWatcher = Deno.watchFs(this.baseDirectory, { recursive: true });

			// Start the watcher loop in the background
			this.processFileWatchEvents();

			if (this.developmentMode) {
				console.log(`[Middleware] File watcher started for ${this.baseDirectory}`);
			}
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[Middleware] Failed to start file watcher for ${this.baseDirectory}: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
			}
			// Don't throw error for file watcher failures in development mode
		}
	}

	/**
	 * Processes file watch events
	 * Requirements: 5.4
	 */
	private async processFileWatchEvents() {
		if (!this.fileWatcher || !this.watcherAbortController) {
			return;
		}

		try {
			for await (const event of this.fileWatcher) {
				// Check if watcher was aborted
				if (this.watcherAbortController.signal.aborted) {
					break;
				}

				// Process each path in the event
				for (const path of event.paths) {
					await this.handleFileWatchEvent(event.kind, path);
				}
			}
		} catch (error) {
			// Only log errors if the watcher wasn't intentionally aborted
			if (this.watcherAbortController && !this.watcherAbortController.signal.aborted) {
				if (this.developmentMode) {
					console.warn(`[Middleware] File watcher error: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}
	}

	/**
	 * Handles individual file watch events
	 * Requirements: 5.4
	 */
	private async handleFileWatchEvent(kind: string, path: string) {
		// Only process middleware files
		if (!path.endsWith(this.filePattern)) {
			return;
		}

		// Skip excluded directories
		const relativePath = relative(this.baseDirectory, path);
		const pathParts = relativePath.split('/');
		if (pathParts.some(part => this.excludeDirectories.includes(part))) {
			return;
		}

		try {
			let eventType: 'add' | 'change' | 'unlink';

			switch (kind) {
				case 'create':
					eventType = 'add';
					break;
				case 'modify':
					eventType = 'change';
					break;
				case 'remove':
					eventType = 'unlink';
					break;
				default:
					return; // Ignore other event types
			}

			// Log the event in development mode
			if (this.developmentMode) {
				console.log(`[Middleware] File ${eventType}: ${relativePath}`);
			}

			// Handle the middleware file change
			await this.reloadMiddleware(path, eventType);

			// Call the watcher callback if provided
			if (this.watcherCallback) {
				this.watcherCallback(path, eventType);
			}
		} catch (error) {
			this.errorHandler.handleDiscoveryError(
				new Error(
					`Error handling file watch event for ${path}: ${error instanceof Error ? error.message : String(error)}`
				),
				path
			);
		}
	}

	/**
	 * Reloads middleware when files change
	 * Requirements: 5.4
	 */
	private async reloadMiddleware(filePath: string, eventType: 'add' | 'change' | 'unlink') {
		try {
			// Clear cache for the specific middleware file
			this.clearMiddlewareCache(filePath);

			// For unlink events, we just clear the cache
			if (eventType === 'unlink') {
				if (this.developmentMode) {
					console.log(`[Middleware] Removed middleware: ${relative(this.baseDirectory, filePath)}`);
				}
				return;
			}

			// For add/change events, try to preload the middleware to validate it
			if (eventType === 'add' || eventType === 'change') {
				// Add a small delay to ensure file write is complete
				await new Promise(resolve => setTimeout(resolve, 100));

				// Try to load the middleware to validate it
				const handler = await this.loadMiddleware(filePath);
				if (handler) {
					if (this.developmentMode) {
						const action = eventType === 'add' ? 'Added' : 'Reloaded';
						console.log(`[Middleware] ${action} middleware: ${relative(this.baseDirectory, filePath)}`);
					}
				}
			}
		} catch (error) {
			this.errorHandler.handleDiscoveryError(
				new Error(`Failed to reload middleware ${filePath}: ${error instanceof Error ? error.message : String(error)}`),
				filePath
			);
		}
	}

	/**
	 * Clears all caches (useful for hot reloading)
	 * Requirements: 5.3
	 */
	clearCache() {
		this.middlewareCache.clear();
		this.routeCache.clear();
	}

	/**
	 * Clears cache for a specific middleware file
	 * Requirements: 5.3
	 */
	clearMiddlewareCache(filePath: string) {
		this.middlewareCache.delete(filePath);
		// Also clear route cache since it might be affected
		this.routeCache.clear();
	}

	/**
	 * Gets all cached middleware routes (for debugging)
	 */
	getCachedRoutes() {
		return Array.from(this.routeCache.values()).flat();
	}

	/**
	 * Gets middleware cache statistics (for debugging)
	 */
	getCacheStats() {
		return {
			middlewareCount: this.middlewareCache.size,
			routeCacheCount: this.routeCache.size,
		};
	}

	/**
	 * Sets a callback to be called when middleware files change
	 * Requirements: 5.4
	 */
	setWatcherCallback(callback: MiddlewareWatcherCallback) {
		this.watcherCallback = callback;
	}

	/**
	 * Removes the watcher callback
	 * Requirements: 5.4
	 */
	removeWatcherCallback() {
		this.watcherCallback = undefined;
	}

	/**
	 * Stops the file watcher
	 * Requirements: 5.4
	 */
	stopWatcher() {
		if (this.watcherAbortController) {
			this.watcherAbortController.abort();
			this.watcherAbortController = undefined;
		}
		this.fileWatcher = undefined;

		if (this.developmentMode) {
			console.log('[Middleware] File watcher stopped');
		}
	}

	/**
	 * Restarts the file watcher
	 * Requirements: 5.4
	 */
	async restartWatcher() {
		this.stopWatcher();
		if (this.watchMode) {
			await this.startFileWatcher();
		}
	}

	/**
	 * Gets the current watch mode status
	 * Requirements: 5.4
	 */
	isWatchModeEnabled() {
		return this.watchMode;
	}

	/**
	 * Gets the current file watcher status
	 * Requirements: 5.4
	 */
	isWatcherActive() {
		return (
			this.fileWatcher !== undefined &&
			this.watcherAbortController !== undefined &&
			!this.watcherAbortController.signal.aborted
		);
	}
}
