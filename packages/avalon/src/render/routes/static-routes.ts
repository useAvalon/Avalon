/**
 * Routes for serving static assets (CSS, JS, images, fonts, etc.)
 */

import { join } from 'node:path';
import { serveStaticFile, hasStaticExtension } from '../file-utils.ts';
import { STATIC_FILES_DIR } from '../constants.ts';
import type { MiddlewareContext } from '../../schemas/middleware.ts';
import type { LayoutContext } from '../../types/layout.ts';

export function createStaticRoutes(isDev: boolean) {
	// In development, Vite handles all static files from public/
	// In production, we serve them directly
	if (isDev) {
		return [];
	}

	return [
		// Serve islands (production only)
		{
			pattern: new URLPattern({ pathname: '/islands/*' }),
			handler: async (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/islands\//, '');
				return await serveStaticFile(`islands/${path}`, join(Deno.cwd(), 'dist'));
			},
		},

		// Serve built island bundles
		{
			pattern: new URLPattern({ pathname: '/dist/islands/*' }),
			handler: async (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/dist\//, '');
				return await serveStaticFile(path, join(Deno.cwd(), 'dist'));
			},
		},

		// Serve Vite-generated chunks
		{
			pattern: new URLPattern({ pathname: '/chunks/*' }),
			handler: async (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/chunks\//, '');
				return await serveStaticFile(path, join(Deno.cwd(), 'dist/chunks'));
			},
		},

		// Serve any other dist assets (for Vite-generated files)
		{
			pattern: new URLPattern({ pathname: '/dist/*' }),
			handler: async (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/dist\//, '');
				return await serveStaticFile(path, join(Deno.cwd(), 'dist'));
			},
		},

		// Static files from public/ directory - MUST be last as fallback
		{
			pattern: new URLPattern({ pathname: '/*' }),
			handler: async (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) => {
				const url = new URL(req.url);
				const path = url.pathname.substring(1); // Remove leading slash

				// Security: Block potentially malicious requests
				if (
					path.includes('..') ||
					path.includes('\\') ||
					path.startsWith('.well-known') ||
					path.startsWith('.') ||
					path.includes('/.') ||
					path.includes('node_modules') ||
					path.includes('package.json') ||
					path.includes('deno.json') ||
					path.includes('.env')
				) {
					return new Response('Not Found', { status: 404 });
				}

				// Only serve files with common static file extensions
				if (hasStaticExtension(path)) {
					return await serveStaticFile(path, STATIC_FILES_DIR);
				}

				// Not a static file, return 404
				return new Response('Not Found', { status: 404 });
			},
		},
	];
}
