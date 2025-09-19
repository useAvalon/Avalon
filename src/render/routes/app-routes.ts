/**
 * Routes for user application pages and API endpoints
 */

import { renderToHtml, type ComponentRenderOptions } from '../ssr.ts';
import { handleApiRequest } from '../../functions/api.ts';
import type { Routes, RouteConfig } from '../../schemas/index.ts';
import type { IslandManifest } from '../../build/island-manifest.ts';
import type { RenderOptions } from '../../schemas/core.ts';

export function createApiRoutes(apiRoutes: any[]) {
	return [
		{
			pattern: new URLPattern({ pathname: '/api/*' }),
			handler: async (req: Request) => {
				return await handleApiRequest(req, apiRoutes);
			},
		},
	];
}

export function createAppRoutes(
	routes: Routes,
	mergedDefaultOptions: Partial<RenderOptions>,
	islandManifest: IslandManifest | null,
	isDev: boolean,
	renderOptions: ComponentRenderOptions = {}
) {
	return Object.entries(routes).map(([path, routeConfig]) => ({
		pattern: new URLPattern({ pathname: path }),
		handler: async () => {
			try {
				// Pass Vite HMR port and island manifest to SSR
				const viteHmrPort = isDev ? 8003 : undefined;
				// Create extended options with island manifest
				const extendedOptions = {
					...mergedDefaultOptions,
					...(islandManifest && { islandManifest }),
				};
				const htmlContent = await renderToHtml(routeConfig as RouteConfig, extendedOptions, viteHmrPort, renderOptions);
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
