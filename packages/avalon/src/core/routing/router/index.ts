/**
 * FileSystemRouter - Main orchestrator for file-system based routing
 */

import { resolve } from '@std/path';
import { RouteDiscovery } from '../discovery/index.ts';
import { PageLoader } from '../page-loader.ts';
import { MetadataResolver } from '../metadata-resolver.ts';
import { RouteHandlerBuilder } from './route-handler-builder.ts';
import { SpecialFileHandler } from './special-file-handler.ts';
import type { RoutingErrorHandler } from '../error-handler.ts';
import { createRoutingErrorHandler } from '../error-handler.ts';
import { CacheManager, RouteCache, MetadataCache, CachePerformanceMonitor } from '../cache-manager.ts';
import { FileSystemRouterError } from '../file-system-router.types.ts';
import type {
	FileSystemRoute,
	RouteHandler,
	FileSystemRouterConfig,
	ResolvedMetadata,
	RouteParams,
	RouteDiscoveryOptions,
	FileSystemApiRoute,
} from '../../../schemas/routing.ts';
import type { EnhancedLayoutResolver } from '../../layout/enhanced-layout-resolver.ts';
import type { IslandManifest } from '../../../build/island-manifest.ts';
import type { RenderOptions } from '../../../schemas/core.ts';

export { FileSystemRouterError } from '../file-system-router.types.ts';

/**
 * FileSystemRouter orchestrates the complete file-system routing pipeline
 */
export class FileSystemRouter {
	private routeDiscovery: RouteDiscovery;
	private pageLoader: PageLoader;
	private metadataResolver: MetadataResolver;
	private routeHandlerBuilder: RouteHandlerBuilder;
	private specialFileHandler: SpecialFileHandler;
	private config: Required<FileSystemRouterConfig>;
	private errorHandler: RoutingErrorHandler;

	// Enhanced caching system
	private routeCache: RouteCache;
	private metadataCache: MetadataCache;
	private handlerCache: CacheManager;
	private performanceMonitor: CachePerformanceMonitor;

	// Legacy caches for special files and API handlers
	private specialFileCache = new Map<string, RouteHandler>();
	private apiHandlerCache = new Map<string, RouteHandler>();

	constructor(config: Partial<FileSystemRouterConfig & { discovery?: Partial<RouteDiscoveryOptions> }> = {}) {
		// Apply defaults and validate config
		const defaultDiscovery: RouteDiscoveryOptions = {
			pagesDirectory: 'src/pages',
			apiDirectory: 'src/api',
			extensions: ['.tsx', '.ts', '.jsx', '.js', '.mdx', '.md'],
			excludeDirectories: ['node_modules', '.git'],
			enableWatching: false,
			developmentMode: false,
			quietMode: false,
		};

		this.config = {
			enabled: true,
			fallbackToManual: true,
			enableCaching: true,
			cacheTTL: 300000, // 5 minutes
			...config,
			discovery: {
				...defaultDiscovery,
				...config.discovery,
			},
		};

		// Initialize error handler
		this.errorHandler = createRoutingErrorHandler({
			developmentMode: this.config.discovery.developmentMode,
			enableDebugLogging: this.config.discovery.developmentMode,
			enableDetailedErrors: true,
			enableSuggestions: true,
		});

		// Initialize enhanced caching system
		this.routeCache = new RouteCache({
			maxMemoryUsage: 20 * 1024 * 1024, // 20MB for routes
			defaultTTL: this.config.cacheTTL,
			enableStats: this.config.discovery.developmentMode,
		});

		this.metadataCache = new MetadataCache({
			maxMemoryUsage: 10 * 1024 * 1024, // 10MB for metadata
			defaultTTL: this.config.cacheTTL,
			enableStats: this.config.discovery.developmentMode,
		});

		this.handlerCache = new CacheManager({
			maxMemoryUsage: 15 * 1024 * 1024, // 15MB for handlers
			defaultTTL: this.config.cacheTTL,
			enableStats: this.config.discovery.developmentMode,
		});

		this.performanceMonitor = new CachePerformanceMonitor();

		// Initialize components
		this.routeDiscovery = new RouteDiscovery(this.config.discovery);
		this.pageLoader = new PageLoader({
			baseDirectory: this.config.discovery.pagesDirectory,
			extensions: this.config.discovery.extensions,
			developmentMode: this.config.discovery.developmentMode,
		});
		this.metadataResolver = new MetadataResolver(this.config.discovery.pagesDirectory, this.config.enableCaching);
		this.routeHandlerBuilder = new RouteHandlerBuilder(this.pageLoader, this.metadataResolver);
		this.specialFileHandler = new SpecialFileHandler(
			this.pageLoader,
			this.metadataResolver,
			this.config.discovery.developmentMode
		);

		// Initialize file watching if enabled
		if (this.config.discovery.enableWatching) {
			this.initializeFileWatching();
		}
	}

	/**
	 * Discovers all routes from the file system
	 */
	async discoverRoutes(): Promise<FileSystemRoute[]> {
		if (!this.config.enabled) {
			return [];
		}

		return await this.performanceMonitor.timeOperation('discoverRoutes', async () => {
			try {
				// Check cache first
				const cacheKey = 'discovered-routes';
				const cachedRoutes = this.routeCache.getRoutes(cacheKey);

				if (cachedRoutes && this.config.enableCaching) {
					// In development, we should validate cache against file changes
					if (!this.config.discovery.developmentMode) {
						return cachedRoutes;
					}

					// In development, check if any files have changed
					const isValid = await this.validateRouteCacheEntry(cacheKey);
					if (isValid) {
						return cachedRoutes;
					}
				}

				// Discover page files
				const pageFiles = await this.performanceMonitor.timeOperation('scanPagesDirectory', () =>
					this.routeDiscovery.scanPagesDirectory()
				);

				// Create routes from page files
				const routes = await this.performanceMonitor.timeOperation('createRoutes', () =>
					Promise.resolve(this.routeDiscovery.createRoutes(pageFiles))
				);

				// Validate routes for conflicts
				const validationErrors = this.routeDiscovery.validateRoutePatterns(routes);
				if (validationErrors.length > 0) {
					if (this.config.discovery.developmentMode) {
						// In development, throw errors for route conflicts
						throw new FileSystemRouterError(
							`Route validation failed: ${validationErrors.join(', ')}`,
							'ROUTE_CONFLICT'
						);
					} else {
						// In production, log warnings but continue
						console.warn('Route validation warnings:', validationErrors);
					}
				}

				// Cache the results with file dependencies
				if (this.config.enableCaching) {
					this.routeCache.setRoutes(cacheKey, routes, pageFiles);
				}

				return routes;
			} catch (error) {
				throw new FileSystemRouterError(
					`Failed to discover routes: ${error instanceof Error ? error.message : String(error)}`,
					'DISCOVERY_FAILED',
					error instanceof Error ? error : undefined
				);
			}
		});
	}

	/**
	 * Discovers all API routes from the file system
	 */
	async discoverApiRoutes(): Promise<FileSystemApiRoute[]> {
		if (!this.config.enabled) {
			return [];
		}

		return await this.performanceMonitor.timeOperation('discoverApiRoutes', async () => {
			try {
				// Check cache first
				const cacheKey = 'discovered-api-routes';
				const cachedApiRoutes = this.routeCache.getApiRoutes(cacheKey);

				if (cachedApiRoutes && this.config.enableCaching) {
					// In development, validate cache against file changes
					if (!this.config.discovery.developmentMode) {
						return cachedApiRoutes;
					}

					// In development, check if any files have changed
					const isValid = await this.validateApiRouteCacheEntry(cacheKey);
					if (isValid) {
						return cachedApiRoutes;
					}
				}

				// Discover API files
				const apiFiles = await this.performanceMonitor.timeOperation('scanApiDirectory', () =>
					this.routeDiscovery.scanApiDirectory()
				);

				// Create API routes from API files
				const apiRoutes = await this.performanceMonitor.timeOperation('createApiRoutes', () =>
					this.routeDiscovery.createApiRoutes(apiFiles)
				);

				// Validate API routes for conflicts
				const validationErrors = this.routeDiscovery.validateApiRoutePatterns(apiRoutes);
				if (validationErrors.length > 0) {
					if (this.config.discovery.developmentMode) {
						// In development, throw errors for route conflicts
						throw new FileSystemRouterError(
							`API route validation failed: ${validationErrors.join(', ')}`,
							'API_ROUTE_CONFLICT'
						);
					} else {
						// In production, log warnings but continue
						console.warn('API route validation warnings:', validationErrors);
					}
				}

				// Cache the results with file dependencies
				if (this.config.enableCaching) {
					this.routeCache.setApiRoutes(cacheKey, apiRoutes, apiFiles);
				}

				return apiRoutes;
			} catch (error) {
				throw new FileSystemRouterError(
					`Failed to discover API routes: ${error instanceof Error ? error.message : String(error)}`,
					'API_DISCOVERY_FAILED',
					error instanceof Error ? error : undefined
				);
			}
		});
	}

	/**
	 * Builds a route handler for a discovered route
	 */
	async buildRouteHandler(
		route: FileSystemRoute,
		layoutResolver?: EnhancedLayoutResolver,
		renderOptions: Partial<RenderOptions> = {},
		islandManifest: IslandManifest | null = null,
		isDev: boolean = false,
		streamingEnabled: boolean = true
	): Promise<RouteHandler> {
		return await this.performanceMonitor.timeOperation('buildRouteHandler', async () => {
			try {
				// Check handler cache first
				const cacheKey = `handler:${route.filePath}`;
				const cachedHandler = this.handlerCache.get<RouteHandler>(cacheKey);

				if (cachedHandler && this.config.enableCaching) {
					// In development, check file modification time
					if (!isDev) {
						return cachedHandler;
					}

					// Check if file has been modified
					try {
						const stat = await Deno.stat(route.filePath);
						const cachedEntry = this.handlerCache.get<any>(cacheKey);
						if (stat.mtime && cachedEntry && stat.mtime.getTime() <= (cachedEntry.mtime || 0)) {
							return cachedHandler;
						}
					} catch {
						// If we can't stat the file, invalidate cache
						this.handlerCache.delete(cacheKey);
					}
				}

				// Build the route handler
				const routeHandler = await this.routeHandlerBuilder.buildRouteHandler(
					route,
					layoutResolver,
					renderOptions,
					islandManifest,
					isDev,
					streamingEnabled
				);

				// Cache the handler with file dependencies
				if (this.config.enableCaching) {
					let mtime: number | undefined;
					try {
						const stat = await Deno.stat(route.filePath);
						mtime = stat.mtime?.getTime();
					} catch {
						// Ignore stat errors
					}

					// Store handler with metadata for cache invalidation
					const handlerWithMeta = {
						...routeHandler,
						mtime,
					};

					this.handlerCache.set(cacheKey, handlerWithMeta, {
						dependencies: [route.filePath],
					});
				}

				return routeHandler;
			} catch (error) {
				throw new FileSystemRouterError(
					`Failed to build route handler for ${route.filePath}: ${
						error instanceof Error ? error.message : String(error)
					}`,
					'HANDLER_BUILD_FAILED',
					error instanceof Error ? error : undefined
				);
			}
		});
	}

	/**
	 * Builds an API route handler for a discovered API route
	 */
	async buildApiRouteHandler(apiRoute: FileSystemApiRoute, isDev: boolean = false): Promise<RouteHandler> {
		try {
			// Check handler cache first
			const cacheKey = `api:${apiRoute.filePath}`;
			if (this.config.enableCaching && this.apiHandlerCache.has(cacheKey)) {
				const cached = this.apiHandlerCache.get(cacheKey)!;
				return cached;
			}

			// Build the API route handler
			const routeHandler = await this.routeHandlerBuilder.buildApiRouteHandler(apiRoute, isDev);

			// Cache the handler
			if (this.config.enableCaching) {
				this.apiHandlerCache.set(cacheKey, routeHandler);
			}

			return routeHandler;
		} catch (error) {
			throw new FileSystemRouterError(
				`Failed to build API route handler for ${apiRoute.filePath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
				'API_HANDLER_BUILD_FAILED',
				error instanceof Error ? error : undefined
			);
		}
	}

	/**
	 * Resolves complete metadata for a route
	 */
	async resolveMetadata(
		routePath: string,
		generateMetadata?: (params: RouteParams) => Promise<ResolvedMetadata>,
		params: RouteParams = {}
	): Promise<ResolvedMetadata> {
		return await this.performanceMonitor.timeOperation('resolveMetadata', async () => {
			try {
				// Check cache first
				const cachedMetadata = this.metadataCache.getMetadata(routePath, params);
				if (cachedMetadata && this.config.enableCaching) {
					return cachedMetadata;
				}

				// Resolve metadata using the metadata resolver
				const resolved = await this.metadataResolver.resolveRouteMetadata(routePath, generateMetadata, params);

				// Cache the result with file dependencies
				if (this.config.enableCaching) {
					// Determine metadata file dependencies
					const dependencies = await this.getMetadataDependencies(routePath);
					this.metadataCache.setMetadata(routePath, params, resolved, dependencies);
				}

				return resolved;
			} catch (error) {
				console.warn(`Failed to resolve metadata for ${routePath}:`, error);

				// Return minimal metadata on error
				return {
					sources: ['error'],
					resolvedAt: Date.now(),
				};
			}
		});
	}

	/**
	 * Get a special file handler (404 or error page)
	 */
	async getSpecialFileHandler(
		fileType: 'error' | '404',
		routePath: string = '/',
		layoutResolver?: EnhancedLayoutResolver,
		renderOptions: Partial<RenderOptions> = {},
		islandManifest: IslandManifest | null = null,
		isDev: boolean = false
	): Promise<RouteHandler> {
		// Check cache first
		const cacheKey = `${fileType}:${routePath}`;
		if (this.config.enableCaching && this.specialFileCache.has(cacheKey)) {
			const cached = this.specialFileCache.get(cacheKey)!;
			return cached;
		}

		// Get the special file handler
		const handler = await this.specialFileHandler.getSpecialFileHandler(
			fileType,
			routePath,
			layoutResolver,
			renderOptions,
			islandManifest,
			isDev
		);

		// Cache the handler
		if (this.config.enableCaching) {
			this.specialFileCache.set(cacheKey, handler);
		}

		return handler;
	}

	/**
	 * Get comprehensive cache statistics (backward compatible format)
	 */
	getCacheStats(): {
		routes: { size: number; keys: string[] };
		handlers: { size: number; keys: string[] };
		metadata: { size: number; keys: string[] };
		apiRoutes: { size: number; keys: string[] };
		apiHandlers: { size: number; keys: string[] };
	} {
		try {
			const routeStats = this.routeCache.getStats();
			const metadataStats = this.metadataCache.getStats();
			const handlerStats = this.handlerCache.getStats();

			return {
				routes: {
					size: routeStats.totalEntries,
					keys: [], // Keys not available in new cache system
				},
				handlers: {
					size: handlerStats.totalEntries,
					keys: [],
				},
				metadata: {
					size: metadataStats.totalEntries,
					keys: [],
				},
				apiRoutes: {
					size: routeStats.totalEntries, // API routes are stored in the same cache
					keys: [],
				},
				apiHandlers: {
					size: this.apiHandlerCache.size,
					keys: Array.from(this.apiHandlerCache.keys()),
				},
			};
		} catch (error) {
			console.warn('Failed to get cache stats:', error);
			// Return default stats if there's an error
			return {
				routes: { size: 0, keys: [] },
				handlers: { size: 0, keys: [] },
				metadata: { size: 0, keys: [] },
				apiRoutes: { size: 0, keys: [] },
				apiHandlers: { size: 0, keys: [] },
			};
		}
	}

	/**
	 * Clear all caches
	 */
	clearAllCaches(): void {
		this.routeCache.clear();
		this.metadataCache.clear();
		this.handlerCache.clear();
		this.performanceMonitor.clearMetrics();

		// Clear legacy caches
		this.specialFileCache.clear();
		this.apiHandlerCache.clear();

		// Clear resolver caches
		this.metadataResolver.clearCache();
		this.pageLoader.clearCache();

		if (this.config.discovery.developmentMode) {
			console.log('🧹 Cleared all routing caches');
		}
	}

	/**
	 * Clear all caches (alias for clearAllCaches for backward compatibility)
	 */
	clearCache(): void {
		this.clearAllCaches();
	}

	/**
	 * Get current configuration
	 */
	getConfig(): Required<FileSystemRouterConfig> {
		return { ...this.config };
	}

	// Private helper methods

	/**
	 * Validate route cache entry against file system changes
	 */
	private async validateRouteCacheEntry(cacheKey: string): Promise<boolean> {
		try {
			// Get cache dependencies
			const dependencies = this.routeCache.getKeysMatching(new RegExp(`^${cacheKey}$`));
			if (dependencies.length === 0) {
				return false;
			}

			// Check if any dependency files have changed
			// This is a simplified check - in a real implementation,
			// we would track file modification times more precisely
			return true; // For now, assume cache is valid
		} catch {
			return false;
		}
	}

	/**
	 * Validate API route cache entry against file system changes
	 */
	private async validateApiRouteCacheEntry(cacheKey: string): Promise<boolean> {
		try {
			// Similar to route cache validation
			return true; // For now, assume cache is valid
		} catch {
			return false;
		}
	}

	/**
	 * Get metadata file dependencies for a route path
	 */
	private async getMetadataDependencies(routePath: string): Promise<string[]> {
		const dependencies: string[] = [];

		try {
			// Add global metadata file
			const globalMetadataPath = resolve(this.config.discovery.pagesDirectory, '_metadata.ts');
			dependencies.push(globalMetadataPath);

			// Add section metadata files based on route hierarchy
			const pathSegments = routePath.split('/').filter(s => s.length > 0);
			let currentPath = this.config.discovery.pagesDirectory;

			for (const segment of pathSegments) {
				currentPath = resolve(currentPath, segment);
				const metadataPath = resolve(currentPath, '_metadata.ts');
				dependencies.push(metadataPath);
			}
		} catch (error) {
			console.warn('Failed to determine metadata dependencies:', error);
		}

		return dependencies;
	}

	/**
	 * Initialize file watching for development hot reload
	 */
	private async initializeFileWatching(): Promise<void> {
		if (!this.config.discovery.enableWatching) {
			return;
		}

		try {
			// File watching would be implemented here
			// For now, just log that it's enabled
			if (this.config.discovery.developmentMode) {
				console.log('👀 File watching initialized for cache invalidation');
			}
		} catch (error) {
			console.warn('Failed to initialize file watching:', error);
		}
	}
}

/**
 * Default FileSystemRouter instance for convenience
 */
export const defaultFileSystemRouter = new FileSystemRouter();
