/**
 * Vite development server setup and proxy utilities
 */

import type { ViteDevServer } from 'vite';
import { VITE_DEV_PORT, VITE_HMR_PORT } from './constants.ts';
import process from "node:process";

export interface ViteServerSetup {
	viteDevServer: ViteDevServer | null;
	viteServerUrl: string;
}

export async function setupViteServer(isDev: boolean): Promise<ViteServerSetup> {
	if (!isDev) {
		return { viteDevServer: null, viteServerUrl: '' };
	}

	try {
		const { createServer } = await import('vite');
		const { dirname } = await import('@std/path');
		const cwd = globalThis.Deno?.cwd() || process.cwd();
		// Allow both current directory and parent directory (for integration files)
		const parentDir = dirname(cwd);
		const viteDevServer = await createServer({
			configFile: 'vite.config.ts',
			server: {
				middlewareMode: false,
				port: VITE_DEV_PORT,
				strictPort: true,
				cors: {
					origin: true,
					credentials: true,
					methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
					allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
				},
				hmr: { port: VITE_HMR_PORT },
				// Add proper headers for development
				headers: {
					'Cache-Control': 'no-cache',
				},
				// Allow access to parent directory (where integration files are located)
				fs: {
					allow: [cwd, parentDir],
				},
			},
			// Ensure proper base URL for dependency resolution
			base: '/',
			// Optimize dependency pre-bundling for better performance
			optimizeDeps: {
				include: [
					'preact',
					'preact/hooks',
					'preact/jsx-runtime',
					'preact/jsx-dev-runtime',
					'solid-js',
					'solid-js/web',
					'solid-js/store',
					'vue',
					'svelte',
					'svelte/internal',
					'svelte/store',
				],
				// Force re-optimization in development for consistency
				force: true,
			},
			root: cwd,
		});

		await viteDevServer.listen();
		const viteServerUrl = `http://localhost:${VITE_DEV_PORT}`;

		// Make Vite server available globally for SSR
		// deno-lint-ignore no-explicit-any
		(globalThis as any).__viteDevServer = viteDevServer;

		console.log(`✅ Vite dev server started on ${viteServerUrl}`);
		console.log(`🔥 HMR WebSocket: ws://localhost:${VITE_HMR_PORT}`);

		return { viteDevServer, viteServerUrl };
	} catch (error) {
		console.error('❌ Failed to start Vite dev server. This is required for development:', error);
		console.log('💡 Make sure you have vite.config.ts and @deno/vite-plugin installed');
		throw error;
	}
}

export async function proxyToVite(req: Request, viteUrl: string): Promise<Response> {
	try {
		const url = new URL(req.url);
		
		// Handle CORS preflight requests
		if (req.method === 'OPTIONS') {
			return new Response(null, {
				status: 200,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
					'Access-Control-Max-Age': '86400',
				},
			});
		}

		const viteRequestUrl = `${viteUrl}${url.pathname}${url.search}`;

		const response = await fetch(viteRequestUrl, {
			method: req.method,
			headers: req.headers,
			body: req.body,
		});

		// Create new headers with proper CORS support
		const responseHeaders = new Headers(response.headers);
		
		// Ensure CORS headers are set for cross-port requests
		responseHeaders.set('Access-Control-Allow-Origin', '*');
		responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
		
		// Set proper caching headers for different types of Vite resources
		if (url.pathname.startsWith('/.vite/deps/')) {
			// Vite dependencies are immutable and can be cached aggressively
			responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
			responseHeaders.set('ETag', `"vite-dep-${Date.now()}"`);
		} else if (url.pathname.startsWith('/@vite/')) {
			// Vite client and HMR resources should not be cached
			responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
			responseHeaders.set('Pragma', 'no-cache');
			responseHeaders.set('Expires', '0');
		} else if (url.pathname.startsWith('/src/')) {
			// Source files should not be cached during development
			responseHeaders.set('Cache-Control', 'no-cache, must-revalidate');
		} else {
			// Default to no-cache for other resources
			responseHeaders.set('Cache-Control', 'no-cache');
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders,
		});
	} catch (error) {
		console.error('Vite proxy error:', error);
		return new Response('Vite proxy failed', { status: 502 });
	}
}
