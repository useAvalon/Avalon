/**
 * Central route configuration and assembly
 * 
 * NOTE: File-system routing is now handled by Nitro's native routing system.
 * The fileSystemRouter option is deprecated and will be ignored.
 */

import { createFrameworkRoutes } from './framework-routes.ts';
import { createViteRoutes } from './vite-routes.ts';
import { createStaticRoutes } from './static-routes.ts';
import { createApiRoutes, createAppRoutes } from './app-routes.ts';
import { createHydrationRoutes } from './hydration-routes.ts';
import type { Routes } from '../../schemas/index.ts';
import type { IslandManifest } from '../../build/island-manifest.ts';
import type { RenderOptions } from '../../schemas/core.ts';
import type { ComponentRenderOptions } from '../ssr.ts';
import type { EnhancedLayoutResolver } from '../../core/layout/enhanced-layout-resolver.ts';
import type { ApiRoute } from '../../schemas/api.ts';

export interface RouteConfig {
	isDev: boolean;
	viteServerUrl: string;
	apiRoutes: ApiRoute[];
	routes: Routes;
	mergedDefaultOptions: Partial<RenderOptions>;
	islandManifest: IslandManifest | null;
	renderOptions?: ComponentRenderOptions;
	layoutResolver?: EnhancedLayoutResolver;
	/** @deprecated File-system routing is now handled by Nitro. This option is ignored. */
	fileSystemRouter?: unknown;
	quietMode?: boolean;
	streamingEnabled?: boolean;
}

export async function createAllRoutes(config: RouteConfig) {
	const {
		isDev,
		viteServerUrl,
		apiRoutes,
		routes,
		mergedDefaultOptions,
		islandManifest,
		renderOptions = {},
		layoutResolver,
		fileSystemRouter,
		quietMode = false,
	} = config;

	// Log deprecation warning if fileSystemRouter is provided
	if (fileSystemRouter && isDev && !quietMode) {
		console.warn('[routes] fileSystemRouter option is deprecated. File-system routing is now handled by Nitro.');
	}

	return [
		// API routes (must be first to catch /api/* before other patterns)
		...createApiRoutes(apiRoutes),

		// Framework routes (Avalon scripts and assets)
		...createFrameworkRoutes(isDev),

		// Hydration routes (framework-specific module serving)
		...createHydrationRoutes(isDev),

		// Vite development routes (only in development)
		...createViteRoutes(isDev, viteServerUrl),

		// User application routes (manual routes)
		...createAppRoutes(routes, mergedDefaultOptions, islandManifest, isDev, renderOptions, layoutResolver),

		// Static asset routes (must be last as they include fallback)
		...createStaticRoutes(isDev),
	];
}

export * from './framework-routes.ts';
export * from './vite-routes.ts';
export * from './static-routes.ts';
export * from './app-routes.ts';
export * from './hydration-routes.ts';
