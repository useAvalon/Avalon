/**
 * Routes for serving Avalon framework scripts and assets
 */

import type { MiddlewareContext } from '../../schemas/middleware.ts';
import type { LayoutContext } from '../../types/layout.ts';

export function createFrameworkRoutes(isDev: boolean) {
	return [
		// Client script serving (always available) - served from Avalon's location
		{
			pattern: new URLPattern({ pathname: '/src/client/main.js' }),
			handler: async (req: Request, middlewareContext?: MiddlewareContext, layoutContext?: LayoutContext) => {
				try {
					// Serve from Avalon's client script, not user's repo
					const clientScriptPath = new URL('../../client/main.js', import.meta.url);
					const clientScript = await Deno.readTextFile(clientScriptPath);
					return new Response(clientScript, {
						headers: {
							'Content-Type': 'application/javascript; charset=utf-8',
							'Cache-Control': 'no-cache',
						},
					});
				} catch (error) {
					console.error('Failed to serve Avalon client script:', error);
					return new Response('Client script not found', { status: 404 });
				}
			},
		},

		// SolidJS hydration script (always available) - pre-bundled from Avalon
		{
			pattern: new URLPattern({ pathname: '/src/client/solid-hydration.js' }),
			handler: async (req: Request, middlewareContext?: MiddlewareContext, layoutContext?: LayoutContext) => {
				try {
					// Always serve pre-bundled script with dependencies resolved
					const bundledScriptPath = new URL('../../../dist-avalon/solid-hydration.js', import.meta.url);
					const bundledScript = await Deno.readTextFile(bundledScriptPath);
					return new Response(bundledScript, {
						headers: {
							'Content-Type': 'application/javascript; charset=utf-8',
							'Cache-Control': isDev ? 'no-cache' : 'public, max-age=86400',
						},
					});
				} catch (error) {
					console.error('Failed to serve Avalon solid-hydration script:', error);
					return new Response('Solid hydration script not found', { status: 404 });
				}
			},
		},

		// Serve Avalon's pre-built chunks (always available - for hydration scripts dependencies)
		{
			pattern: new URLPattern({ pathname: '/src/client/*.js' }),
			handler: async (req: Request, middlewareContext?: MiddlewareContext, layoutContext?: LayoutContext) => {
				try {
					const url = new URL(req.url);
					const filename = url.pathname.split('/').pop();
					if (!filename) throw new Error('Invalid filename');

					// Skip main.js, solid-hydration.js, vue-hydration.js (handled by specific routes above)
					if (['main.js', 'solid-hydration.js', 'vue-hydration.js'].includes(filename)) {
						return new Response('Handled by specific route', { status: 404 });
					}

					console.log(`📦 Serving Avalon chunk: ${filename}`);
					const chunkPath = new URL(`../../../dist-avalon/${filename}`, import.meta.url);
					const chunkScript = await Deno.readTextFile(chunkPath);
					return new Response(chunkScript, {
						headers: {
							'Content-Type': 'application/javascript; charset=utf-8',
							'Cache-Control': isDev ? 'no-cache' : 'public, max-age=86400',
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
