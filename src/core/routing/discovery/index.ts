/**
 * Route Discovery - Main orchestrator for route discovery
 */

import type { FileSystemRoute, FileSystemApiRoute, PageFile, RouteDiscoveryOptions } from '../../../schemas/routing.ts';
import { RoutingErrorHandler, createRoutingErrorHandler } from '../error-handler.ts';
import type { RouteDebugInfo } from '../error-handler.types.ts';
import type { FileChangeEvent, FileWatcherCallback } from '../route-discovery.types.ts';
import { FileSystemScanner } from './scanner.ts';
import { RouteBuilder } from './route-builder.ts';
import { ConflictResolver } from './conflict-resolver.ts';

export type { FileChangeEvent, FileWatcherCallback } from '../route-discovery.types.ts';

/**
 * Main route discovery orchestrator
 */
export class RouteDiscovery {
	private options: RouteDiscoveryOptions;
	private errorHandler: RoutingErrorHandler;
	private scanner: FileSystemScanner;
	private routeBuilder: RouteBuilder;
	private conflictResolver: ConflictResolver;

	// File watching
	private watchers: Deno.FsWatcher[] = [];
	private watcherCallbacks: Set<FileWatcherCallback> = new Set();
	private isWatching = false;
	private watchDebounceMap = new Map<string, number>();
	private readonly DEBOUNCE_DELAY = 100; // ms
	private watcherPromises: Promise<void>[] = [];

	constructor(options: Partial<RouteDiscoveryOptions> = {}) {
		// Apply defaults and parse
		const defaultOptions = {
			pagesDirectory: 'src/pages',
			apiDirectory: 'src/api',
			extensions: ['.tsx', '.ts', '.jsx', '.js', '.md', '.mdx'],
			excludeDirectories: ['node_modules', '.git'],
			enableWatching: false,
			developmentMode: false,
		};
		this.options = { ...defaultOptions, ...options };

		this.errorHandler = createRoutingErrorHandler({
			developmentMode: this.options.developmentMode,
			enableDebugLogging: this.options.developmentMode,
			enableDetailedErrors: true,
			enableSuggestions: true,
		});

		// Initialize components
		this.scanner = new FileSystemScanner(this.options, this.errorHandler);
		this.routeBuilder = new RouteBuilder(this.options, this.errorHandler);
		this.conflictResolver = new ConflictResolver(this.errorHandler);
	}

	/**
	 * Scans the pages directory recursively to find all page files
	 */
	async scanPagesDirectory(): Promise<PageFile[]> {
		return await this.scanner.scanPagesDirectory();
	}

	/**
	 * Scans the API directory recursively to find all API route files
	 */
	async scanApiDirectory(): Promise<PageFile[]> {
		return await this.scanner.scanApiDirectory();
	}

	/**
	 * Converts discovered page files to FileSystemRoute objects
	 */
	createRoutes(pageFiles: PageFile[]): FileSystemRoute[] {
		const routes = this.routeBuilder.createRoutes(pageFiles);

		// Detect and resolve route conflicts
		const resolvedRoutes = this.conflictResolver.detectAndResolveConflicts(routes);

		// Sort routes by priority (lower number = higher priority)
		const sortedRoutes = resolvedRoutes.sort((a, b) => a.priority - b.priority);

		// Log debug info if in development mode
		if (this.options.developmentMode) {
			this.logRouteDetails(sortedRoutes);
		}

		return sortedRoutes;
	}

	/**
	 * Converts discovered API files to FileSystemApiRoute objects
	 */
	async createApiRoutes(apiFiles: PageFile[]): Promise<FileSystemApiRoute[]> {
		const routes = await this.routeBuilder.createApiRoutes(apiFiles);

		// Detect and resolve route conflicts
		const resolvedRoutes = this.conflictResolver.detectAndResolveApiConflicts(routes);

		// Sort routes by priority (lower number = higher priority)
		const sortedRoutes = resolvedRoutes.sort((a, b) => a.priority - b.priority);

		// Log debug info if in development mode
		if (this.options.developmentMode) {
			this.logApiRouteDetails(sortedRoutes);
		}

		return sortedRoutes;
	}

	/**
	 * Validates route patterns for potential conflicts
	 */
	validateRoutePatterns(routes: FileSystemRoute[]): string[] {
		return this.conflictResolver.validateRoutePatterns(routes);
	}

	/**
	 * Validates API route patterns for potential conflicts
	 */
	validateApiRoutePatterns(routes: FileSystemApiRoute[]): string[] {
		return this.conflictResolver.validateApiRoutePatterns(routes);
	}

	/**
	 * Get the error handler instance for external access
	 */
	getErrorHandler(): RoutingErrorHandler {
		return this.errorHandler;
	}

	/**
	 * Clear scan cache for performance optimization
	 */
	clearScanCache(): void {
		this.scanner.clearScanCache();
	}

	/**
	 * Invalidate scan cache for specific directory
	 */
	invalidateScanCache(directory: string): void {
		this.scanner.invalidateScanCache(directory);
	}

	/**
	 * Get scan cache statistics
	 */
	getScanCacheStats() {
		return this.scanner.getScanCacheStats();
	}

	/**
	 * Log detailed route information for debugging
	 */
	private logRouteDetails(routes: FileSystemRoute[]): void {
		console.log('📋 Discovered Routes:');

		const routesByType = routes.reduce((acc, route) => {
			if (!acc[route.routeType]) acc[route.routeType] = [];
			acc[route.routeType].push(route);
			return acc;
		}, {} as Record<string, FileSystemRoute[]>);

		for (const [type, typeRoutes] of Object.entries(routesByType)) {
			console.log(`  ${type.toUpperCase()} routes (${typeRoutes.length}):`);
			for (const route of typeRoutes) {
				const dynamicInfo = route.dynamicSegments.length > 0 ? ` [params: ${route.dynamicSegments.join(', ')}]` : '';
				console.log(`    ${route.pattern.pathname} → ${route.filePath} (priority: ${route.priority})${dynamicInfo}`);
			}
		}
	}

	/**
	 * Log detailed API route information for debugging
	 */
	private logApiRouteDetails(routes: FileSystemApiRoute[]): void {
		console.log('🔌 Discovered API Routes:');

		if (routes.length === 0) {
			console.log('  No API routes found');
			return;
		}

		for (const route of routes) {
			const dynamicInfo = route.dynamicSegments.length > 0 ? ` [params: ${route.dynamicSegments.join(', ')}]` : '';
			console.log(
				`  [${route.methods.join(',')}] ${route.pattern.pathname} → ${route.filePath} (priority: ${
					route.priority
				})${dynamicInfo}`
			);
		}
	}
}
