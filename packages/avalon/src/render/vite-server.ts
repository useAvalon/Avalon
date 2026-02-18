/**
 * Vite development server setup and proxy utilities
 */

import type { ViteDevServer } from 'vite';
import { VITE_DEV_PORT, VITE_HMR_PORT } from './constants.ts';
import { ServerHMRHandler } from './server-hmr-handler.ts';
import { preloadIntegrationsNative } from '../core/integrations/preloader.ts';
import process from "node:process";

export interface ViteServerSetup {
	viteDevServer: ViteDevServer | null;
	viteServerUrl: string;
	serverHMRHandler?: ServerHMRHandler;
}

export async function setupViteServer(isDev: boolean): Promise<ViteServerSetup> {
	if (!isDev) {
		return { viteDevServer: null, viteServerUrl: '' };
	}

	try {
		// Pre-load integrations BEFORE Vite server starts
		// This ensures they're loaded with native Deno imports, not through Vite's SSR module system
		await preloadIntegrationsNative();

		const { createServer } = await import('vite');
		const { dirname } = await import('node:path');
		const cwd = process.cwd();
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
			// Note: We intentionally do NOT use force: true here because it causes
			// Vite to re-bundle ALL dependencies on every restart, adding ~5-7 seconds
			// to cold start time. By omitting force, Vite reuses cached pre-bundled
			// dependencies from .vite/deps, significantly improving startup performance.
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
			},
			root: cwd,
		});

		await viteDevServer.listen();
		const viteServerUrl = `http://localhost:${VITE_DEV_PORT}`;

		// Make Vite server available globally for SSR
		
		(globalThis as any).__viteDevServer = viteDevServer;

		// Initialize server-side HMR handler
		const serverHMRHandler = new ServerHMRHandler({
			debugLogging: process.env.DEBUG_HMR === 'true',
			errorHandling: {
				keepAlive: true,
				displayInBrowser: true,
			},
		});
		serverHMRHandler.initialize(viteDevServer);

		return { viteDevServer, viteServerUrl, serverHMRHandler };
	} catch (error) {
		console.error('❌ Failed to start Vite dev server. This is required for development:', error);
		console.log('💡 Make sure you have vite.config.ts configured correctly');
		throw error;
	}
}

export async function setupViteServerWithoutHMR(isDev: boolean): Promise<ViteServerSetup> {
	const result = await setupViteServer(isDev);
	return {
		viteDevServer: result.viteDevServer,
		viteServerUrl: result.viteServerUrl,
	};
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
