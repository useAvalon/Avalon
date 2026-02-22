/**
 * Routes for serving Avalon framework scripts and assets
 */

import { readFile } from 'node:fs/promises';

import type { MiddlewareContext } from '../../nitro/middleware-adapter.ts';
import type { LayoutContext } from '../../types/layout.ts';

export function createFrameworkRoutes(isDev: boolean) {
	// In development, let Vite handle /src/client/main.js for HMR support
	// In production, we don't need these routes as the client script is bundled
	if (isDev) {
		return [];
	}

	return [
		// Serve Avalon's pre-built chunks (production only)
		{
			pattern: new URLPattern({ pathname: '/src/client/*.js' }),
			handler: async (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) => {
				try {
					const url = new URL(req.url);
					const filename = url.pathname.split('/').pop();
					if (!filename) throw new Error('Invalid filename');

					const chunkPath = new URL(`../../../dist-avalon/${filename}`, import.meta.url);
					const chunkScript = await readFile(new URL(chunkPath), 'utf-8');
					return new Response(chunkScript, {
						headers: {
							'Content-Type': 'application/javascript; charset=utf-8',
							'Cache-Control': 'public, max-age=86400',
						},
					});
				} catch (error) {
					console.error('Failed to serve Avalon chunk:', error);
					return new Response('Chunk not found', { status: 404 });
				}
			},
		},
	];
}
