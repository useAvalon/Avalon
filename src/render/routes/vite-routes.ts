/**
 * Routes for Vite development server proxy
 */

import { proxyToVite } from '../vite-server.ts';

export function createViteRoutes(isDev: boolean, viteServerUrl: string) {
	if (!isDev || !viteServerUrl) {
		return [];
	}

	return [
		// Vite internal routes
		{
			pattern: new URLPattern({ pathname: '/@vite/*' }),
			handler: (req: Request) => proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/@fs/*' }),
			handler: (req: Request) => proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/@id/*' }),
			handler: (req: Request) => proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/node_modules/*' }),
			handler: (req: Request) => proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/@solid-refresh' }),
			handler: (req: Request) => proxyToVite(req, viteServerUrl),
		},
		// Islands - needed for dynamic imports
		{
			pattern: new URLPattern({ pathname: '/islands/*' }),
			handler: (req: Request) => {
				console.log(`🏝️ Proxying island request: ${req.url}`);
				return proxyToVite(req, viteServerUrl);
			},
		},
		// Source files - needed for island dependencies (DEVELOPMENT ONLY)
		{
			pattern: new URLPattern({ pathname: '/src/*' }),
			handler: (req: Request) => {
				console.log(`📦 Proxying src request: ${req.url}`);
				return proxyToVite(req, viteServerUrl);
			},
		},
	];
}
