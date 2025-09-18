/**
 * Routes for serving static assets (CSS, JS, images, fonts, etc.)
 */

import { join } from '@std/path';
import { serveStaticFile, hasStaticExtension } from '../file-utils.ts';
import { STATIC_FILES_DIR } from '../constants.ts';

export function createStaticRoutes(isDev: boolean) {
	return [
		// Serve islands - needed for dynamic imports in both dev and production
		{
			pattern: new URLPattern({ pathname: '/islands/*' }),
			handler: async (req: Request) => {
				// In development, this is handled by Vite proxy above
				// In production, serve directly from user's islands directory
				if (!isDev) {
					const url = new URL(req.url);
					const path = url.pathname.replace(/^\/islands\//, '');
					console.log(`🏝️ Serving island: ${path}`);
					return await serveStaticFile(path, join(Deno.cwd(), 'islands'));
				}
				return new Response('Island not found', { status: 404 });
			},
		},

		// Serve built island bundles (production)
		{
			pattern: new URLPattern({ pathname: '/dist/islands/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/dist\//, '');
				return await serveStaticFile(path, join(Deno.cwd(), 'dist'));
			},
		},

		// Serve Vite-generated chunks (production)
		{
			pattern: new URLPattern({ pathname: '/chunks/*' }),
			handler: async (req: Request) => {
				if (!isDev) {
					const url = new URL(req.url);
					const path = url.pathname.replace(/^\/chunks\//, '');
					console.log(`📦 Serving chunk: ${path}`);
					return await serveStaticFile(path, join(Deno.cwd(), 'dist/chunks'));
				}
				return new Response('Chunk not found in development', { status: 404 });
			},
		},

		// Serve any other dist assets (for Vite-generated files)
		{
			pattern: new URLPattern({ pathname: '/dist/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/dist\//, '');
				return await serveStaticFile(path, join(Deno.cwd(), 'dist'));
			},
		},

		// CSS files
		{
			pattern: new URLPattern({ pathname: '/css/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/css\//, 'css/');
				return await serveStaticFile(path, STATIC_FILES_DIR);
			},
		},

		// JavaScript files
		{
			pattern: new URLPattern({ pathname: '/js/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/js\//, 'js/');
				return await serveStaticFile(path, STATIC_FILES_DIR);
			},
		},

		// Image files
		{
			pattern: new URLPattern({ pathname: '/images/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/images\//, 'images/');
				return await serveStaticFile(path, STATIC_FILES_DIR);
			},
		},

		// Font files
		{
			pattern: new URLPattern({ pathname: '/fonts/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/fonts\//, 'fonts/');
				console.log(`Font request: ${url.pathname} -> serving from: ${path}`);
				return await serveStaticFile(path, STATIC_FILES_DIR, url.pathname);
			},
		},

		// Assets folder (for videos, other media, etc.)
		{
			pattern: new URLPattern({ pathname: '/assets/*' }),
			handler: async (req: Request) => {
				const url = new URL(req.url);
				const path = url.pathname.replace(/^\/assets\//, 'assets/');
				console.log(`Assets request: ${url.pathname} -> serving from: ${path}`);
				return await serveStaticFile(path, STATIC_FILES_DIR);
			},
		},

		// General static files (for files directly in public/) - MUST be last as fallback
		{
			pattern: new URLPattern({ pathname: '/*' }),
			handler: async (req: Request) => {
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
					console.log(`Static file request: ${url.pathname} -> serving from: ${path}`);
					return await serveStaticFile(path, STATIC_FILES_DIR);
				}

				// Not a static file, return 404
				return new Response('Not Found', { status: 404 });
			},
		},
	];
}
