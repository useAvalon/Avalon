/**
 * Routes for user application pages and API endpoints
 */

import { renderToHtml, renderToHtmlWithLayouts, type ComponentRenderOptions } from '../ssr.ts';
import { handleApiRequest } from '../../functions/api.ts';
import type { Routes, RouteConfig } from '../../schemas/index.ts';
import type { IslandManifest } from '../../build/island-manifest.ts';
import type { RenderOptions } from '../../schemas/core.ts';
import type { MiddlewareContext } from '../../schemas/middleware.ts';
import type { EnhancedLayoutResolver } from '../../core/layout/enhanced-layout-resolver.ts';
import type { LayoutContext } from '../../types/layout.ts';

export function createApiRoutes(apiRoutes: any[]) {
	return [
		{
			pattern: new URLPattern({ pathname: '/api/*' }),
			handler: async (req: Request, middlewareContext?: MiddlewareContext, layoutContext?: LayoutContext) => {
				return await handleApiRequest(req, apiRoutes, middlewareContext);
			},
		},
	];
}

export function createAppRoutes(
	routes: Routes,
	mergedDefaultOptions: Partial<RenderOptions>,
	islandManifest: IslandManifest | null,
	isDev: boolean,
	renderOptions: ComponentRenderOptions = {},
	layoutResolver?: EnhancedLayoutResolver
) {
	return Object.entries(routes).map(([path, routeConfig]) => ({
		pattern: new URLPattern({ pathname: path }),
		handler: async (req: Request, middlewareContext?: MiddlewareContext, layoutContext?: LayoutContext) => {
			try {
				// Pass Vite HMR port and island manifest to SSR
				const viteHmrPort = isDev ? 8003 : undefined;
				// Create extended options with island manifest
				const extendedOptions = {
					...mergedDefaultOptions,
					...(islandManifest && { islandManifest }),
				};

				// Create render options with middleware context if available
				const contextualRenderOptions = {
					...renderOptions,
					...(middlewareContext && { middlewareContext }),
				};

				// Check if layout system is available and should be used
				let htmlContent: string;
				if (layoutResolver && layoutContext) {
					// Use layout-aware rendering
					htmlContent = await renderToHtmlWithLayouts(
						routeConfig as RouteConfig,
						layoutResolver,
						layoutContext,
						path,
						extendedOptions,
						viteHmrPort,
						contextualRenderOptions
					);
				} else {
					// Fall back to standard rendering
					htmlContent = await renderToHtml(
						routeConfig as RouteConfig,
						extendedOptions,
						viteHmrPort,
						contextualRenderOptions
					);
				}

				return new Response(htmlContent, {
					headers: {
						'Content-Type': 'text/html; charset=utf-8',
						'Cache-Control': 'no-cache',
					},
				});
			} catch (error: unknown) {
				console.error('Error handling route:', error);
				return new Response('Internal Server Error', { status: 500 });
			}
		},
	}));
}
