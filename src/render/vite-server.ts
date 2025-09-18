/**
 * Vite development server setup and proxy utilities
 */

import type { ViteDevServer } from 'vite';
import { VITE_DEV_PORT, VITE_HMR_PORT } from './constants.ts';

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
		const viteDevServer = await createServer({
			configFile: 'vite.config.ts',
			server: {
				middlewareMode: false,
				port: VITE_DEV_PORT,
				strictPort: true,
				cors: true,
				hmr: { port: VITE_HMR_PORT },
			},
			root: Deno.cwd(),
		});

		await viteDevServer.listen();
		const viteServerUrl = `http://localhost:${VITE_DEV_PORT}`;

		// Make Vite server available globally for SSR
		globalThis.__viteDevServer = viteDevServer;

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
		const viteRequestUrl = `${viteUrl}${url.pathname}${url.search}`;

		const response = await fetch(viteRequestUrl, {
			method: req.method,
			headers: req.headers,
			body: req.body,
		});

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	} catch (error) {
		console.error('Vite proxy error:', error);
		return new Response('Vite proxy failed', { status: 502 });
	}
}
