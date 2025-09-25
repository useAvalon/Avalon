/**
 * Special File Handler - Handles 404 and error pages
 */

import type { RouteHandler, ResolvedMetadata, RouteParams, LoaderContext } from '../../../schemas/routing.ts';
import type { EnhancedLayoutResolver } from '../../layout/enhanced-layout-resolver.ts';
import type { MiddlewareContext } from '../../../schemas/middleware.ts';
import type { LayoutContext } from '../../../types/layout.ts';
import type { IslandManifest } from '../../../build/island-manifest.ts';
import type { RenderOptions } from '../../../schemas/core.ts';
import { renderToHtml, renderToHtmlWithLayouts, type ComponentRenderOptions } from '../../../render/ssr.ts';
import { PageLoader } from '../page-loader.ts';
import { MetadataResolver } from '../metadata-resolver.ts';
import type { SpecialFileType } from '../file-system-router.types.ts';

/**
 * Handles special files like 404 and error pages
 */
export class SpecialFileHandler {
	constructor(
		private pageLoader: PageLoader,
		private metadataResolver: MetadataResolver,
		private developmentMode: boolean = false
	) {}

	/**
	 * Get a special file handler (404 or error page)
	 */
	async getSpecialFileHandler(
		fileType: SpecialFileType,
		routePath: string = '/',
		layoutResolver?: EnhancedLayoutResolver,
		renderOptions: Partial<RenderOptions> = {},
		islandManifest: IslandManifest | null = null,
		isDev: boolean = false
	): Promise<RouteHandler> {
		try {
			// Try to load custom special file
			const specialFile = await this.pageLoader.loadSpecialFile(fileType, routePath);

			// If no custom file found, use fallback
			const fileToUse = specialFile || this.pageLoader.getFallbackSpecialFile(fileType);

			// Create route handler for the special file
			const handler = async (
				request: Request,
				middlewareContext?: MiddlewareContext,
				layoutContext?: LayoutContext,
				error?: Error
			): Promise<Response> => {
				try {
					const url = new URL(request.url);

					// Create loader context
					const loaderContext: LoaderContext = {
						request,
						url,
						params: {},
						query: url.searchParams,
						state: middlewareContext?.state || new Map(),
					};

					// For error pages, include error information in data
					let data: unknown;
					if (fileType === 'error' && error) {
						data = { error };
					}

					// Execute page loader if present
					if (fileToUse.module?.loader) {
						const loaderData = await fileToUse.module.loader(loaderContext);
						data = data ? { ...data, ...loaderData } : loaderData;
					}

					// Resolve metadata for this route (use root path for special files)
					const metadata = await this.resolveMetadata('/', fileToUse.module?.generateMetadata, {});

					// Create route configuration for rendering
					const routeConfig = {
						component: () => {
							const Component = fileToUse.module!.default;
							const props = {
								params: {},
								query: url.searchParams,
								data,
							};
							return Component(props);
						},
						layoutConfig: this.pageLoader.extractLayoutConfig(fileToUse.module!),
						metadata,
						data,
					};

					// Prepare render options
					const viteHmrPort = isDev ? 8003 : undefined;
					const extendedRenderOptions = {
						...renderOptions,
						...(islandManifest && { islandManifest }),
					};

					const contextualRenderOptions: ComponentRenderOptions = {};
					if (middlewareContext) {
						(contextualRenderOptions as any).middlewareContext = middlewareContext;
					}

					// Render the page
					let htmlContent: string;
					if (layoutResolver && layoutContext) {
						// Use layout-aware rendering
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
						htmlContent = await renderToHtml(routeConfig, extendedRenderOptions, viteHmrPort, contextualRenderOptions);
					}

					// Create response with appropriate status code
					const status = fileType === '404' ? 404 : 500;
					const headers = new Headers({
						'Content-Type': 'text/html; charset=utf-8',
						'Cache-Control': isDev ? 'no-cache' : 'public, max-age=300', // Shorter cache for error pages
					});

					// Add metadata headers
					if (metadata.canonical) {
						headers.set('Link', `<${metadata.canonical}>; rel="canonical"`);
					}

					return new Response(htmlContent, { status, headers });
				} catch (renderError) {
					console.error(`Error rendering ${fileType} page:`, renderError);

					// Return basic error response if rendering fails
					const errorToUse = error || (renderError instanceof Error ? renderError : new Error(String(renderError)));
					const basicErrorHtml = this.createBasicErrorHtml(fileType, errorToUse);
					return new Response(basicErrorHtml, {
						status: fileType === '404' ? 404 : 500,
						headers: { 'Content-Type': 'text/html; charset=utf-8' },
					});
				}
			};

			// Create the complete route handler
			const routeHandler: RouteHandler = {
				pattern: new URLPattern({ pathname: '*' }), // Special files match any pattern
				handler,
				metadata: {
					filePath: fileToUse.filePath,
					routeType: 'static',
					priority: fileType === '404' ? 1000 : 999, // Very low priority
					dynamicSegments: [],
				},
			};

			return routeHandler;
		} catch (error) {
			console.error(`Failed to create ${fileType} handler:`, error);

			// Return a basic fallback handler
			return this.createBasicSpecialFileHandler(fileType, isDev);
		}
	}

	/**
	 * Create a basic special file handler as a last resort fallback
	 */
	private createBasicSpecialFileHandler(fileType: SpecialFileType, isDev: boolean): RouteHandler {
		const handler = async (
			request: Request,
			_context?: any,
			_layoutContext?: any,
			error?: Error
		): Promise<Response> => {
			const basicHtml = this.createBasicErrorHtml(fileType, error);
			return new Response(basicHtml, {
				status: fileType === '404' ? 404 : 500,
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			});
		};

		return {
			pattern: new URLPattern({ pathname: '*' }),
			handler,
			metadata: {
				filePath: `internal:basic-${fileType}`,
				routeType: 'static',
				priority: 1001, // Lowest priority
				dynamicSegments: [],
			},
		};
	}

	/**
	 * Create basic HTML for error pages when all else fails
	 */
	private createBasicErrorHtml(fileType: SpecialFileType, error?: Error): string {
		const title = fileType === '404' ? '404 - Page Not Found' : 'Error';
		const heading = fileType === '404' ? 'Page Not Found' : 'Something went wrong';
		const message =
			fileType === '404'
				? "The page you're looking for doesn't exist or has been moved."
				: 'An error occurred while processing your request.';

		const errorDetails =
			error && this.developmentMode
				? `<details style="margin-top: 1rem; padding: 1rem; background: #f5f5f5; border-radius: 5px;">
				<summary style="cursor: pointer; font-weight: bold;">Error Details (Development Mode)</summary>
				<p style="margin: 0.5rem 0; color: #d32f2f;"><strong>Error:</strong> ${error.message}</p>
				${
					error.stack
						? `<pre style="background: #fff; padding: 1rem; border-radius: 3px; overflow: auto; font-size: 0.8rem; border: 1px solid #ddd;">${error.stack}</pre>`
						: ''
				}
			</details>`
				: '';

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title}</title>
	<style>
		body {
			font-family: system-ui, -apple-system, sans-serif;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			min-height: 100vh;
			margin: 0;
			padding: 2rem;
			text-align: center;
			background: #f9f9f9;
		}
		.container {
			max-width: 600px;
			background: white;
			padding: 2rem;
			border-radius: 8px;
			box-shadow: 0 2px 10px rgba(0,0,0,0.1);
		}
		h1 { font-size: 3rem; margin: 0; color: ${fileType === '404' ? '#666' : '#d32f2f'}; }
		h2 { font-size: 1.5rem; margin: 1rem 0; color: #888; }
		p { color: #666; line-height: 1.5; }
		a, button {
			display: inline-block;
			margin-top: 2rem;
			padding: 0.75rem 1.5rem;
			background: #007acc;
			color: white;
			text-decoration: none;
			border: none;
			border-radius: 5px;
			font-size: 1rem;
			cursor: pointer;
		}
		a:hover, button:hover { background: #005a9e; }
	</style>
</head>
<body>
	<div class="container">
		<h1>${fileType === '404' ? '404' : '⚠️'}</h1>
		<h2>${heading}</h2>
		<p>${message}</p>
		${errorDetails}
		${fileType === '404' ? '<a href="/">Go Home</a>' : '<button onclick="window.location.reload()">Refresh Page</button>'}
	</div>
</body>
</html>`;
	}

	/**
	 * Resolves complete metadata for a route
	 */
	private async resolveMetadata(
		routePath: string,
		generateMetadata?: (params: RouteParams) => Promise<any>,
		params: RouteParams = {}
	): Promise<ResolvedMetadata> {
		try {
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
}
