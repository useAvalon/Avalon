/**
 * Route Handler Builder - Creates route handlers from discovered routes
 */

import { resolve } from '@std/path';
import type {
	FileSystemRoute,
	FileSystemApiRoute,
	RouteHandler,
	ResolvedMetadata,
	RouteParams,
	LoaderContext,
	FileSystemApiModule,
} from '../../../schemas/routing.ts';
import type { EnhancedLayoutResolver } from '../../layout/enhanced-layout-resolver.ts';
import type { MiddlewareContext } from '../../../schemas/middleware.ts';
import type { LayoutContext } from '../../../types/layout.ts';
import type { IslandManifest } from '../../../build/island-manifest.ts';
import type { RenderOptions } from '../../../schemas/core.ts';
import { renderToHtml, renderToHtmlWithLayouts, type ComponentRenderOptions } from '../../../render/ssr.ts';
import type { PageLoader } from '../page-loader.ts';
import type { MetadataResolver } from '../metadata-resolver.ts';
import { FileSystemRouterError } from '../file-system-router.types.ts';
// Removed MarkdownRouter - MDX files are handled by Vite plugins

/**
 * Builds route handlers from discovered routes
 */
export class RouteHandlerBuilder {
	constructor(private pageLoader: PageLoader, private metadataResolver: MetadataResolver) {}

	/**
	 * Builds a route handler for a discovered route
	 */
	async buildRouteHandler(
		route: FileSystemRoute,
		layoutResolver?: EnhancedLayoutResolver,
		renderOptions: Partial<RenderOptions> = {},
		islandManifest: IslandManifest | null = null,
		isDev: boolean = false
	): Promise<RouteHandler> {
		try {
			// Load the page module for non-markdown files
			const pageModule = await this.pageLoader.loadPageModule(route.filePath);

			// Extract layout configuration
			const layoutConfig = this.pageLoader.extractLayoutConfig(pageModule);

			// Create the route handler function
			const handler = async (
				request: Request,
				middlewareContext?: MiddlewareContext,
				layoutContext?: LayoutContext
			): Promise<Response> => {
				try {
					const url = new URL(request.url);

					// Extract route parameters
					const params = this.extractRouteParams(route, url.pathname);

					// Create loader context
					const loaderContext: LoaderContext = {
						request,
						url,
						params,
						query: url.searchParams,
						state: middlewareContext?.state || new Map(),
					};

					// Execute page loader if present
					let data: unknown;
					if (pageModule.loader) {
						data = await pageModule.loader(loaderContext);
					}

					// Resolve metadata for this route
					const metadata = await this.resolveMetadata(
						url.pathname,
						pageModule.generateMetadata,
						params,
						route.filePath
					);

					// Create route configuration for rendering
					const routeConfig = {
						component: () => {
							const Component = pageModule.default;
							const props = {
								params,
								query: url.searchParams,
								data,
							};
							return Component(props);
						},
						layoutConfig,
						metadata,
						data,
						frontmatter: pageModule.frontmatter,
					};

					// Prepare render options
					const viteHmrPort = isDev ? 8003 : undefined;
					const extendedRenderOptions = {
						...renderOptions,
						...(islandManifest && { islandManifest }),
					};

					const contextualRenderOptions: ComponentRenderOptions = {};

					// Render the page
					let htmlContent: string;
					if (layoutResolver && layoutContext) {
						// Use layout-aware rendering
						if (isDev) {
							console.log(`🎨 Using layout-aware rendering for ${url.pathname}`);
						}
						htmlContent = await renderToHtmlWithLayouts(
							routeConfig,
							layoutResolver,
							layoutContext,
							url.pathname,
							extendedRenderOptions,
							viteHmrPort,
							contextualRenderOptions
						);
					} else {
						// Fall back to standard rendering
						if (isDev) {
							console.log(
								`⚠️ Falling back to standard rendering for ${
									url.pathname
								} (layoutResolver: ${!!layoutResolver}, layoutContext: ${!!layoutContext})`
							);
						}
						htmlContent = await renderToHtml(routeConfig, extendedRenderOptions, viteHmrPort, contextualRenderOptions);
					}

					// Create response with metadata headers
					const headers = new Headers({
						'Content-Type': 'text/html; charset=utf-8',
						'Cache-Control': isDev ? 'no-cache' : 'public, max-age=3600',
					});

					// Add metadata headers
					if (metadata.canonical) {
						headers.set('Link', `<${metadata.canonical}>; rel="canonical"`);
					}

					return new Response(htmlContent, { headers });
				} catch (error) {
					console.error(`Error handling route ${route.filePath}:`, error);
					throw error; // Let the caller handle the error
				}
			};

			// Create the complete route handler
			const routeHandler: RouteHandler = {
				pattern: route.pattern,
				handler,
				metadata: {
					filePath: route.filePath,
					routeType: route.routeType,
					priority: route.priority,
					dynamicSegments: route.dynamicSegments,
				},
			};

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
	}

	/**
	 * Builds an API route handler for a discovered API route
	 */
	async buildApiRouteHandler(apiRoute: FileSystemApiRoute, isDev: boolean = false): Promise<RouteHandler> {
		try {
			// Load the API module
			const absolutePath = resolve(apiRoute.filePath);
			const fileUrl = `file://${absolutePath}`;
			const apiModule = (await import(fileUrl)) as FileSystemApiModule;

			// Create the API route handler function
			const handler = async (request: Request, middlewareContext?: MiddlewareContext): Promise<Response> => {
				try {
					const url = new URL(request.url);
					const method = request.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

					// Check if this route supports the requested method
					if (!apiRoute.methods.includes(method)) {
						// Return 405 Method Not Allowed
						const allowedMethods = apiRoute.methods.join(', ');
						return new Response(`Method ${method} not allowed. Allowed methods: ${allowedMethods}`, {
							status: 405,
							headers: {
								Allow: allowedMethods,
								'Content-Type': 'text/plain',
							},
						});
					}

					// Extract route parameters
					const params = this.extractApiRouteParams(apiRoute, url.pathname);

					// Create loader context for API routes
					const loaderContext: LoaderContext = {
						request,
						url,
						params,
						query: url.searchParams,
						state: middlewareContext?.state || new Map(),
					};

					// Get the appropriate handler function for the HTTP method
					const methodHandler = apiModule[method as keyof FileSystemApiModule];

					if (!methodHandler || typeof methodHandler !== 'function') {
						// This shouldn't happen if route discovery worked correctly
						return new Response(`Handler for ${method} not found`, {
							status: 500,
							headers: { 'Content-Type': 'text/plain' },
						});
					}

					// Execute the API handler
					const response = await methodHandler(request, loaderContext);

					// Ensure we return a Response object
					if (!(response instanceof Response)) {
						console.warn(`API handler ${apiRoute.filePath}:${method} did not return a Response object`);
						return new Response(JSON.stringify(response), {
							headers: { 'Content-Type': 'application/json' },
						});
					}

					return response;
				} catch (error) {
					console.error(`Error handling API route ${apiRoute.filePath}:`, error);

					// Return JSON error response for API routes
					const errorResponse = {
						error: 'Internal Server Error',
						message: isDev && error instanceof Error ? error.message : 'An error occurred',
						...(isDev && error instanceof Error && error.stack && { stack: error.stack }),
					};

					return new Response(JSON.stringify(errorResponse), {
						status: 500,
						headers: { 'Content-Type': 'application/json' },
					});
				}
			};

			// Create the complete route handler
			const routeHandler: RouteHandler = {
				pattern: apiRoute.pattern,
				handler,
				metadata: {
					filePath: apiRoute.filePath,
					routeType: 'static', // API routes are treated as static for priority purposes
					priority: apiRoute.priority,
					dynamicSegments: apiRoute.dynamicSegments,
				},
			};

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
	private async resolveMetadata(
		routePath: string,
		generateMetadata?: (params: RouteParams) => Promise<ResolvedMetadata>,
		params: RouteParams = {},
		_filePath?: string
	): Promise<ResolvedMetadata> {
		try {
			// All files (including MDX) use standard metadata resolution

			return await this.metadataResolver.resolveRouteMetadata(routePath, generateMetadata, params);
		} catch (error) {
			console.warn(`Failed to resolve metadata for ${routePath}:`, error);
			// Return minimal metadata on error
			return {
				sources: ['error'],
				resolvedAt: Date.now(),
			};
		}
	}

	/**
	 * Extracts route parameters from a URL pathname using the route pattern
	 */
	private extractRouteParams(route: FileSystemRoute, pathname: string): RouteParams {
		const params: RouteParams = {};

		try {
			// Use URLPattern to extract parameters
			const result = route.pattern.exec({ pathname });
			if (result && result.pathname.groups) {
				// Copy groups to params, ensuring all values are strings
				for (const [key, value] of Object.entries(result.pathname.groups)) {
					if (value !== undefined) {
						params[key] = String(value);
					}
				}
			}
		} catch (error) {
			console.warn(`Failed to extract route params for ${pathname}:`, error);
		}

		return params;
	}

	/**
	 * Extracts route parameters from a URL pathname using the API route pattern
	 */
	private extractApiRouteParams(apiRoute: FileSystemApiRoute, pathname: string): RouteParams {
		const params: RouteParams = {};

		try {
			// Use URLPattern to extract parameters
			const result = apiRoute.pattern.exec({ pathname });
			if (result && result.pathname.groups) {
				// Copy groups to params, ensuring all values are strings
				for (const [key, value] of Object.entries(result.pathname.groups)) {
					if (value !== undefined) {
						params[key] = String(value);
					}
				}
			}
		} catch (error) {
			console.warn(`Failed to extract API route params for ${pathname}:`, error);
		}

		return params;
	}
}
