/**
 * Central route configuration and assembly
 */

import { createFrameworkRoutes } from './framework-routes.ts';
import { createViteRoutes } from './vite-routes.ts';
import { createStaticRoutes } from './static-routes.ts';
import { createApiRoutes, createAppRoutes } from './app-routes.ts';
import type { Routes } from '@/schemas/index.ts';
import type { IslandManifest } from '../../build/island-manifest.ts';
import type { RenderOptions } from '@/schemas/core.ts';
import type { ComponentRenderOptions } from '../ssr.ts';
import type { EnhancedLayoutResolver } from '../../core/layout/enhanced-layout-resolver.ts';

export interface RouteConfig {
	isDev: boolean;
	viteServerUrl: string;
	apiRoutes: any[];
	routes: Routes;
	mergedDefaultOptions: Partial<RenderOptions>;
	islandManifest: IslandManifest | null;
	renderOptions?: ComponentRenderOptions;
	layoutResolver?: EnhancedLayoutResolver;
}

export function createAllRoutes(config: RouteConfig) {
	const {
		isDev,
		viteServerUrl,
		apiRoutes,
		routes,
		mergedDefaultOptions,
		islandManifest,
		renderOptions = {},
		layoutResolver,
	} = config;

	return [
		// API routes (must be first to catch /api/* before other patterns)
		...createApiRoutes(apiRoutes),

		// Framework routes (Avalon scripts and assets)
		...createFrameworkRoutes(isDev),

		// Vite development routes (only in development)
		...createViteRoutes(isDev, viteServerUrl),

		// User application routes
		...createAppRoutes(routes, mergedDefaultOptions, islandManifest, isDev, renderOptions, layoutResolver),

		// Static asset routes (must be last as they include fallback)
		...createStaticRoutes(isDev),
	];
}

export * from './framework-routes.ts';
export * from './vite-routes.ts';
export * from './static-routes.ts';
export * from './app-routes.ts';
