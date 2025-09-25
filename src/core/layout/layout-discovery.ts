import { join, resolve, relative } from 'node:path';
import { existsSync } from '@std/fs';
import { ensureDir } from '@std/fs';
import type {
	LayoutRoute,
	LayoutHandler,
	LayoutDiscoveryOptions,
	LayoutContext,
	LayoutData,
	LayoutProps,
	RouteInfo,
} from '../../schemas/layout.ts';
import type { ComponentType } from 'preact';
import { LayoutDataLoader, type LayoutDataLoadingResult } from './layout-data-loader.ts';
import { LayoutMatcher } from './layout-matcher.ts';

/**
 * Layout file export interface
 */
interface LayoutFileExport {
	default: ComponentType<LayoutProps>;
	layoutLoader?: (ctx: LayoutContext) => Promise<LayoutData>;
}

/**
 * Layout watcher callback type
 */
type LayoutWatcherCallback = (filePath: string, event: 'add' | 'change' | 'unlink') => void;

/**
 * Layout discovery system that scans the file system for _layout.tsx files
 * and builds layout chains based on hierarchical priority.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export class LayoutDiscovery {
	private layoutCache = new Map<string, LayoutHandler>();
	private routeCache = new Map<string, LayoutRoute[]>();
	private directoryCache = new Map<string, string[]>(); // Cache directory contents
	private fileStatsCache = new Map<string, { mtime: number; size: number }>(); // Cache file stats
	private scanPromises = new Map<string, Promise<LayoutRoute[]>>(); // Prevent duplicate scans
	private watchMode = false;
	private baseDirectory: string;
	private filePattern: string;
	private excludeDirectories: string[];
	private fileWatcher?: AsyncIterable<Deno.FsEvent>;
	private watcherAbortController?: AbortController;
	private watcherCallback?: LayoutWatcherCallback;
	private developmentMode: boolean;
	private layoutMatcher: LayoutMatcher;
	private parallelScanLimit = 10; // Limit concurrent directory scans

	constructor(options: LayoutDiscoveryOptions) {
		this.baseDirectory = resolve(options.baseDirectory);
		this.filePattern = options.filePattern || '_layout.tsx';
		this.excludeDirectories = options.excludeDirectories || ['node_modules', '.git', 'dist'];
		this.developmentMode = options.developmentMode || false;
		this.layoutMatcher = new LayoutMatcher({ developmentMode: this.developmentMode });

		if (this.developmentMode) {
			console.log(
				`[LayoutDiscovery] Constructor: baseDirectory=${this.baseDirectory}, filePattern=${this.filePattern}`
			);
		}

		if (options.enableWatching) {
			this.enableWatchMode();
		}
	}

	/**
	 * Discovers all layout files for a given route path
	 * Requirements: 1.1, 1.2, 1.3
	 */
	async discoverLayouts(routePath: string): Promise<LayoutRoute[]> {
		const cacheKey = `layouts-${routePath}`;

		if (this.routeCache.has(cacheKey) && !this.watchMode) {
			return this.routeCache.get(cacheKey)!;
		}

		const routes: LayoutRoute[] = [];

		// Build the path hierarchy from root to the specific route
		const pathSegments = routePath.split('/').filter(Boolean);
		const pathsToCheck: string[] = [''];

		// Add each level of the path hierarchy
		for (let i = 0; i < pathSegments.length; i++) {
			const currentPath = '/' + pathSegments.slice(0, i + 1).join('/');
			pathsToCheck.push(currentPath);
		}

		// Scan each path level for layout files
		for (const pathToCheck of pathsToCheck) {
			await this.scanPathForLayouts(pathToCheck, routes);
		}

		// Sort by priority (lower numbers execute first, root layouts have priority 0)
		routes.sort((a, b) => a.priority - b.priority);

		this.routeCache.set(cacheKey, routes);
		return routes;
	}

	/**
	 * Builds a complete layout chain for a URL
	 * Requirements: 1.1, 1.2, 1.3, 1.4
	 */
	async buildLayoutChain(url: URL): Promise<LayoutHandler[]> {
		const routes = await this.discoverLayouts(url.pathname);
		const layoutChain: LayoutHandler[] = [];

		// Load layout handlers for each discovered route
		for (const route of routes) {
			try {
				const handler = await this.loadLayout(route.layoutPath);
				if (handler) {
					layoutChain.push(handler);
				}
			} catch (error) {
				// Log error but continue with other layouts
				if (this.developmentMode) {
					console.warn(
						`[Layout] Failed to load layout ${route.layoutPath}: ${
							error instanceof Error ? error.message : String(error)
						}`
					);
				}
				// Continue with other layouts
			}
		}

		return layoutChain;
	}

	/**
	 * Builds layout chain with conditional rendering applied
	 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
	 */
	async buildLayoutChainWithConditionalRendering(url: URL, request: Request): Promise<LayoutHandler[]> {
		// First get all potential layouts
		const allHandlers = await this.buildLayoutChain(url);

		// Create route info for conditional rendering
		const routeInfo: RouteInfo = {
			path: url.pathname,
			params: {}, // TODO: Extract params from URL pattern matching
			method: request.method,
			headers: request.headers,
		};

		// Filter layouts based on conditional rendering rules
		const filteredHandlers: LayoutHandler[] = [];

		for (const handler of allHandlers) {
			const shouldApply = this.layoutMatcher.shouldApplyLayout(handler.path, routeInfo);

			if (shouldApply) {
				filteredHandlers.push(handler);
			} else if (this.developmentMode) {
				console.log(
					`[Layout] Skipped layout ${handler.path} for route ${url.pathname} due to conditional rendering rules`
				);
			}
		}

		return filteredHandlers;
	}

	/**
	 * Builds layout chain with data loading
	 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
	 */
	async buildLayoutChainWithData(
		url: URL,
		context: LayoutContext,
		dataLoader?: LayoutDataLoader
	): Promise<{ handlers: LayoutHandler[]; data: LayoutData[]; errors: any[] }> {
		const handlers = await this.buildLayoutChain(url);

		if (!dataLoader) {
			dataLoader = new LayoutDataLoader({
				developmentMode: this.developmentMode,
			});
		}

		// Load data for all layouts
		const loadingResults = await dataLoader.loadLayoutData(handlers, context);

		// Process the results
		const { data, errors } = dataLoader.processLoadingResults(loadingResults, handlers);

		return { handlers, data, errors };
	}

	/**
	 * Builds layout chain with both conditional rendering and data loading
	 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1, 4.2, 4.3, 4.4, 4.5
	 */
	async buildLayoutChainWithConditionalRenderingAndData(
		url: URL,
		context: LayoutContext,
		dataLoader?: LayoutDataLoader
	): Promise<{ handlers: LayoutHandler[]; data: LayoutData[]; errors: any[] }> {
		// First apply conditional rendering
		const filteredHandlers = await this.buildLayoutChainWithConditionalRendering(url, context.request);

		if (!dataLoader) {
			dataLoader = new LayoutDataLoader({
				developmentMode: this.developmentMode,
			});
		}

		// Load data for filtered layouts
		const loadingResults = await dataLoader.loadLayoutData(filteredHandlers, context);

		// Process the results
		const { data, errors } = dataLoader.processLoadingResults(loadingResults, filteredHandlers);

		return { handlers: filteredHandlers, data, errors };
	}

	/**
	 * Scans a specific path for layout files with caching and optimization
	 * Requirements: 1.1, 1.2, 1.3
	 */
	private async scanPathForLayouts(routePath: string, routes: LayoutRoute[]): Promise<void> {
		try {
			// Convert route path to file system path
			const fsPath = this.routePathToFsPath(routePath);
			const layoutFilePath = join(fsPath, this.filePattern);

			if (this.developmentMode) {
				console.log(
					`[Layout] Scanning for layouts: route=${routePath}, fsPath=${fsPath}, layoutFile=${layoutFilePath}`
				);
			}

			// Check if we already have this scan in progress
			const cacheKey = `scan-${routePath}`;
			if (this.scanPromises.has(cacheKey)) {
				const cachedRoutes = await this.scanPromises.get(cacheKey)!;
				routes.push(...cachedRoutes);
				return;
			}

			// Check file existence with caching
			const exists = await this.checkFileExistsWithCache(layoutFilePath);
			if (exists) {
				const route = this.createLayoutRoute(layoutFilePath, routePath);
				if (route) {
					routes.push(route);
				}
			}
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[Layout] Error scanning path ${routePath}: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	}

	/**
	 * Optimized directory scanning with parallel processing and caching
	 */
	private async scanDirectoryOptimized(dirPath: string, depth: number = 0): Promise<LayoutRoute[]> {
		const routes: LayoutRoute[] = [];
		const cacheKey = `dir-${dirPath}-${depth}`;

		// Check directory cache first
		if (this.directoryCache.has(dirPath)) {
			const cachedFiles = this.directoryCache.get(dirPath)!;
			const layoutFiles = cachedFiles.filter(file => file === this.filePattern);

			for (const file of layoutFiles) {
				const filePath = join(dirPath, file);
				const relativePath = relative(this.baseDirectory, dirPath);
				const route = this.createLayoutRoute(filePath, '/' + relativePath.replace(/\\/g, '/'));
				if (route) {
					routes.push(route);
				}
			}
			return routes;
		}

		try {
			// Read directory contents
			const files: string[] = [];
			const subdirs: string[] = [];

			// Separate files and directories
			for await (const entry of Deno.readDir(dirPath)) {
				if (entry.isFile) {
					files.push(entry.name);
				} else if (entry.isDirectory && !this.excludeDirectories.includes(entry.name)) {
					subdirs.push(entry.name);
				}
			}

			// Cache directory contents
			this.directoryCache.set(dirPath, files);

			// Check for layout files in current directory
			if (files.includes(this.filePattern)) {
				const layoutFilePath = join(dirPath, this.filePattern);
				const relativePath = relative(this.baseDirectory, dirPath);
				const route = this.createLayoutRoute(layoutFilePath, '/' + relativePath.replace(/\\/g, '/'));
				if (route) {
					routes.push(route);
				}
			}

			// Recursively scan subdirectories with parallel processing
			if (subdirs.length > 0 && depth < 10) {
				// Prevent infinite recursion
				const scanPromises = subdirs
					.slice(0, this.parallelScanLimit) // Limit concurrent scans
					.map(subdir => this.scanDirectoryOptimized(join(dirPath, subdir), depth + 1));

				const subResults = await Promise.allSettled(scanPromises);
				for (const result of subResults) {
					if (result.status === 'fulfilled') {
						routes.push(...result.value);
					}
				}

				// Process remaining subdirectories if any
				if (subdirs.length > this.parallelScanLimit) {
					const remainingDirs = subdirs.slice(this.parallelScanLimit);
					for (const subdir of remainingDirs) {
						try {
							const subRoutes = await this.scanDirectoryOptimized(join(dirPath, subdir), depth + 1);
							routes.push(...subRoutes);
						} catch (error) {
							if (this.developmentMode) {
								console.warn(`[Layout] Error scanning subdirectory ${subdir}:`, error);
							}
						}
					}
				}
			}
		} catch (error) {
			if (this.developmentMode) {
				console.warn(`[Layout] Error scanning directory ${dirPath}:`, error);
			}
		}

		return routes;
	}

	/**
	 * Check file existence with caching and stat optimization
	 */
	private async checkFileExistsWithCache(filePath: string): Promise<boolean> {
		try {
			// Check if we have cached stats for this file
			const cachedStats = this.fileStatsCache.get(filePath);
			if (cachedStats) {
				// Check if file still exists and hasn't been modified
				try {
					const currentStats = await Deno.stat(filePath);
					if (currentStats.mtime && currentStats.mtime.getTime() === cachedStats.mtime) {
						return true; // File exists and hasn't changed
					}
					// Update cache with new stats
					this.fileStatsCache.set(filePath, {
						mtime: currentStats.mtime?.getTime() || 0,
						size: currentStats.size,
					});
					return true;
				} catch {
					// File no longer exists, remove from cache
					this.fileStatsCache.delete(filePath);
					return false;
				}
			}

			// File not in cache, check existence and cache stats
			try {
				const stats = await Deno.stat(filePath);
				this.fileStatsCache.set(filePath, {
					mtime: stats.mtime?.getTime() || 0,
					size: stats.size,
				});
				return true;
			} catch {
				return false;
			}
		} catch (error) {
			return existsSync(filePath); // Fallback to sync check
		}
	}

	/**
	 * Converts a route path to a file system path
	 * Requirements: 1.1, 1.2
	 */
	private routePathToFsPath(routePath: string): string {
		// Handle root path - look in layouts directory, not pages
		if (routePath === '' || routePath === '/') {
			return this.baseDirectory;
		}

		// Convert route path to layouts directory path
		return join(this.baseDirectory, routePath);
	}

	/**
	 * Creates a layout route configuration from a file path
	 * Requirements: 1.1, 1.2, 1.3, 1.4
	 */
	private createLayoutRoute(filePath: string, routePath: string): LayoutRoute | null {
		try {
			// Calculate depth based on route path segments
			const depth = routePath === '' || routePath === '/' ? 0 : routePath.split('/').filter(Boolean).length;

			// Determine layout type
			const type: 'root' | 'nested' = depth === 0 ? 'root' : 'nested';

			// Create URL pattern for this layout
			// Root layout matches all routes, nested layouts match their path and children
			let patternPath: string;
			if (type === 'root') {
				patternPath = '*';
			} else {
				patternPath = `${routePath}/*`;
			}

			const pattern = new URLPattern({ pathname: patternPath });

			// Priority is based on depth (root = 0, deeper = higher numbers)
			const priority = depth * 10;

			return {
				pattern,
				layoutPath: filePath,
				priority,
				type,
				depth,
			};
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[Layout] Error creating layout route for ${filePath}: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
			}
			return null;
		}
	}

	/**
	 * Loads layout handler from file
	 * Requirements: 1.4
	 */
	private async loadLayout(filePath: string): Promise<LayoutHandler | null> {
		try {
			// Check cache first
			if (this.layoutCache.has(filePath)) {
				return this.layoutCache.get(filePath)!;
			}

			// Dynamic import the layout file
			const layoutModule = (await import(filePath)) as LayoutFileExport;

			if (!layoutModule.default || typeof layoutModule.default !== 'function') {
				const error = new Error(`Layout file does not export a default component`);
				if (this.developmentMode) {
					console.warn(`[Layout] ${error.message}: ${filePath}`);
				}
				return null;
			}

			// Calculate priority based on file path depth
			const relativePath = relative(this.baseDirectory, filePath);
			const pathSegments = relativePath.split('/').filter(Boolean);
			const priority = (pathSegments.length - 2) * 10; // Subtract 2 for 'pages' and '_layout.tsx'

			const handler: LayoutHandler = {
				component: layoutModule.default,
				loader: layoutModule.layoutLoader,
				path: filePath,
				priority: Math.max(0, priority),
			};

			// Cache the handler
			this.layoutCache.set(filePath, handler);

			return handler;
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[Layout] Failed to load layout ${filePath}: ${error instanceof Error ? error.message : String(error)}`
				);
			}
			return null;
		}
	}

	/**
	 * Enables watch mode for hot reloading in development
	 * Requirements: 1.5
	 */
	private enableWatchMode(): void {
		this.watchMode = true;
		this.startFileWatcher();
	}

	/**
	 * Starts file watcher for layout files
	 * Requirements: 1.5
	 */
	private async startFileWatcher(): Promise<void> {
		if (!this.developmentMode) {
			return;
		}

		try {
			// Check if directory exists before trying to watch it
			if (!existsSync(this.baseDirectory)) {
				if (this.developmentMode) {
					console.log(`[Layout] Directory ${this.baseDirectory} does not exist, skipping file watcher`);
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
				console.log(`[Layout] File watcher started for ${this.baseDirectory}`);
			}
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[Layout] Failed to start file watcher for ${this.baseDirectory}: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
			}
			// Don't throw error for file watcher failures in development mode
		}
	}

	/**
	 * Processes file watch events
	 * Requirements: 1.5
	 */
	private async processFileWatchEvents(): Promise<void> {
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
					console.warn(`[Layout] File watcher error: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
		}
	}

	/**
	 * Handles individual file watch events
	 * Requirements: 1.5
	 */
	private async handleFileWatchEvent(kind: string, path: string): Promise<void> {
		// Only process layout files
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
				console.log(`[Layout] File ${eventType}: ${relativePath}`);
			}

			// Handle the layout file change
			await this.reloadLayout(path, eventType);

			// Call the watcher callback if provided
			if (this.watcherCallback) {
				this.watcherCallback(path, eventType);
			}
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[Layout] Error handling file watch event for ${path}: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
			}
		}
	}

	/**
	 * Reloads layout when files change with optimized cache invalidation
	 * Requirements: 1.5
	 */
	private async reloadLayout(filePath: string, eventType: 'add' | 'change' | 'unlink'): Promise<void> {
		try {
			// Intelligent cache invalidation based on file path
			this.clearLayoutCache(filePath);

			// Also invalidate the parent directory cache
			const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
			this.invalidateDirectoryCache(parentDir);

			// For unlink events, we just clear the cache
			if (eventType === 'unlink') {
				if (this.developmentMode) {
					console.log(`[Layout] Removed layout: ${relative(this.baseDirectory, filePath)}`);
				}
				return;
			}

			// For add/change events, try to preload the layout to validate it
			if (eventType === 'add' || eventType === 'change') {
				// Add a small delay to ensure file write is complete
				await new Promise(resolve => setTimeout(resolve, 100));

				// Try to load the layout to validate it
				const handler = await this.loadLayout(filePath);
				if (handler) {
					if (this.developmentMode) {
						const action = eventType === 'add' ? 'Added' : 'Reloaded';
						console.log(`[Layout] ${action} layout: ${relative(this.baseDirectory, filePath)}`);
					}
				}
			}
		} catch (error) {
			if (this.developmentMode) {
				console.warn(
					`[Layout] Failed to reload layout ${filePath}: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	}

	/**
	 * Clears all caches (useful for hot reloading)
	 * Requirements: 1.5
	 */
	clearCache(): void {
		this.layoutCache.clear();
		this.routeCache.clear();
		this.directoryCache.clear();
		this.fileStatsCache.clear();
		this.scanPromises.clear();
	}

	/**
	 * Clears cache for a specific layout file
	 * Requirements: 1.5
	 */
	clearLayoutCache(filePath: string): void {
		this.layoutCache.delete(filePath);
		this.fileStatsCache.delete(filePath);

		// Clear directory cache for the parent directory
		const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
		this.directoryCache.delete(parentDir);

		// Also clear route cache since it might be affected
		this.routeCache.clear();
		this.scanPromises.clear();
	}

	/**
	 * Invalidate caches for a specific directory path
	 */
	invalidateDirectoryCache(dirPath: string): void {
		this.directoryCache.delete(dirPath);

		// Also clear any file stats for files in this directory
		for (const [filePath] of this.fileStatsCache) {
			if (filePath.startsWith(dirPath)) {
				this.fileStatsCache.delete(filePath);
			}
		}

		// Clear related route caches
		for (const [cacheKey] of this.routeCache) {
			if (cacheKey.includes(dirPath)) {
				this.routeCache.delete(cacheKey);
			}
		}

		// Clear scan promises
		for (const [promiseKey] of this.scanPromises) {
			if (promiseKey.includes(dirPath)) {
				this.scanPromises.delete(promiseKey);
			}
		}
	}

	/**
	 * Gets all cached layout routes (for debugging)
	 */
	getCachedRoutes(): LayoutRoute[] {
		return Array.from(this.routeCache.values()).flat();
	}

	/**
	 * Gets layout cache statistics (for debugging)
	 */
	getCacheStats(): {
		layoutCount: number;
		routeCacheCount: number;
		directoryCacheCount: number;
		fileStatsCacheCount: number;
		scanPromisesCount: number;
	} {
		return {
			layoutCount: this.layoutCache.size,
			routeCacheCount: this.routeCache.size,
			directoryCacheCount: this.directoryCache.size,
			fileStatsCacheCount: this.fileStatsCache.size,
			scanPromisesCount: this.scanPromises.size,
		};
	}

	/**
	 * Sets a callback to be called when layout files change
	 * Requirements: 1.5
	 */
	setWatcherCallback(callback: LayoutWatcherCallback): void {
		this.watcherCallback = callback;
	}

	/**
	 * Removes the watcher callback
	 * Requirements: 1.5
	 */
	removeWatcherCallback(): void {
		this.watcherCallback = undefined;
	}

	/**
	 * Stops the file watcher
	 * Requirements: 1.5
	 */
	stopWatcher(): void {
		if (this.watcherAbortController) {
			this.watcherAbortController.abort();
			this.watcherAbortController = undefined;
		}
		this.fileWatcher = undefined;

		if (this.developmentMode) {
			console.log('[Layout] File watcher stopped');
		}
	}

	/**
	 * Restarts the file watcher
	 * Requirements: 1.5
	 */
	async restartWatcher(): Promise<void> {
		this.stopWatcher();
		if (this.watchMode) {
			await this.startFileWatcher();
		}
	}

	/**
	 * Gets the current watch mode status
	 * Requirements: 1.5
	 */
	isWatchModeEnabled(): boolean {
		return this.watchMode;
	}

	/**
	 * Gets the current file watcher status
	 * Requirements: 1.5
	 */
	isWatcherActive(): boolean {
		return (
			this.fileWatcher !== undefined &&
			this.watcherAbortController !== undefined &&
			!this.watcherAbortController.signal.aborted
		);
	}

	/**
	 * Gets the current discovery options
	 */
	getOptions(): LayoutDiscoveryOptions {
		return {
			baseDirectory: this.baseDirectory,
			filePattern: this.filePattern,
			excludeDirectories: this.excludeDirectories,
			enableWatching: this.watchMode,
			developmentMode: this.developmentMode,
		};
	}

	/**
	 * Gets the layout matcher instance for adding custom rules
	 * Requirements: 4.3
	 */
	getLayoutMatcher(): LayoutMatcher {
		return this.layoutMatcher;
	}

	/**
	 * Sets a new layout matcher instance
	 * Requirements: 4.3
	 */
	setLayoutMatcher(matcher: LayoutMatcher): void {
		this.layoutMatcher = matcher;
	}
}
