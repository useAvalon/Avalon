/**
 * Routes for Vite development server proxy
 */

import { proxyToVite } from '../vite-server.ts';
import type { MiddlewareContext } from '../../schemas/middleware.ts';
import type { LayoutContext } from '../../types/layout.ts';

export function createViteRoutes(isDev: boolean, viteServerUrl: string) {
	if (!isDev || !viteServerUrl) {
		return [];
	}

	return [
		// Vite dependency optimization files - CRITICAL for framework hydration
		{
			pattern: new URLPattern({ pathname: '/.vite/deps/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) => {
				return proxyToVite(req, viteServerUrl);
			},
		},
		// Vite internal routes
		{
			pattern: new URLPattern({ pathname: '/@vite/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/@avalon/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) => {
				return proxyToVite(req, viteServerUrl);
			},
		},
		{
			pattern: new URLPattern({ pathname: '/@fs/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/@id/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/node_modules/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/@solid-refresh' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		// Islands - needed for dynamic imports
		{
			pattern: new URLPattern({ pathname: '/islands/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) => {
				return proxyToVite(req, viteServerUrl);
			},
		},
		// Source files - needed for island dependencies (DEVELOPMENT ONLY)
		{
			pattern: new URLPattern({ pathname: '/src/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) => {
				return proxyToVite(req, viteServerUrl);
			},
		},
		// Static assets from public/ - let Vite handle them in development
		{
			pattern: new URLPattern({ pathname: '/fonts/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/images/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/css/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/js/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/assets/*' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		// Catch-all for other static files from public/ (like .css, .json, etc.)
		// This should be last to allow other routes to match first
		{
			pattern: new URLPattern({ pathname: '/*.css' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.json' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.txt' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.xml' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.ico' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.svg' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.png' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.jpg' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.jpeg' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.webp' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.woff' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.woff2' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.ttf' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
		{
			pattern: new URLPattern({ pathname: '/*.otf' }),
			handler: (req: Request, _middlewareContext?: MiddlewareContext, _layoutContext?: LayoutContext) =>
				proxyToVite(req, viteServerUrl),
		},
	];
}
