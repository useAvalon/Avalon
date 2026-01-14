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
import { type FileSystemRouter, createFileSystemRouteHandlers } from '../../core/routing/file-system-router.ts';
import type { RouteHandler } from '../../schemas/routing.ts';
import type { ApiRoute } from '../../schemas/api.ts';

export function createApiRoutes(apiRoutes: ApiRoute[]) {
	return [
		{
			pattern: new URLPattern({ pathname: '/api/*' }),
			handler: async (req: Request, middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) => {
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
		handler: async (_req: Request, middlewareContext?: MiddlewareContext, layoutContext?: LayoutContext) => {
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

/**
 * Creates file-system based routes using the FileSystemRouter
 * @param fileSystemRouter - FileSystemRouter instance
 * @param layoutResolver - Layout resolver for layout-aware rendering
 * @param mergedDefaultOptions - Default render options
 * @param islandManifest - Island manifest for production builds
 * @param isDev - Development mode flag
 * @returns Promise<RouteHandler[]> Array of file-system route handlers
 */
export async function createFileSystemRoutes(
	fileSystemRouter: FileSystemRouter,
	layoutResolver?: EnhancedLayoutResolver,
	mergedDefaultOptions: Partial<RenderOptions> = {},
	islandManifest: IslandManifest | null = null,
	isDev: boolean = false,
	quietMode: boolean = false,
	streamingEnabled: boolean = true
): Promise<RouteHandler[]> {
	try {
		// Use the utility function from FileSystemRouter to create handlers
		const handlers = await createFileSystemRouteHandlers(
			fileSystemRouter,
			layoutResolver,
			mergedDefaultOptions,
			islandManifest,
			isDev,
			streamingEnabled
		);

		if (isDev && handlers.length > 0 && !quietMode) {
			console.log(`📁 Discovered ${handlers.length} file-system routes`);
		}

		return handlers;
	} catch (error) {
		console.error('Failed to create file-system routes:', error);

		// In development, we want to see the error
		if (isDev) {
			throw error;
		}

		// In production, return empty array to allow fallback to manual routes
		return [];
	}
}
