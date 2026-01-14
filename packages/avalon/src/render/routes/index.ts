/**
 * Central route configuration and assembly
 */

import { createFrameworkRoutes } from './framework-routes.ts';
import { createViteRoutes } from './vite-routes.ts';
import { createStaticRoutes } from './static-routes.ts';
import { createApiRoutes, createAppRoutes, createFileSystemRoutes } from './app-routes.ts';
import { createHydrationRoutes } from './hydration-routes.ts';
import type { Routes } from '../../schemas/index.ts';
import type { IslandManifest } from '../../build/island-manifest.ts';
import type { RenderOptions } from '../../schemas/core.ts';
import type { ComponentRenderOptions } from '../ssr.ts';
import type { EnhancedLayoutResolver } from '../../core/layout/enhanced-layout-resolver.ts';
import type { FileSystemRouter } from '../../core/routing/file-system-router.ts';
import type { ApiRoute } from '../../schemas/api.ts';
import type { RouteHandler } from '../../schemas/routing.ts';

export interface RouteConfig {
	isDev: boolean;
	viteServerUrl: string;
	apiRoutes: ApiRoute[];
	routes: Routes;
	mergedDefaultOptions: Partial<RenderOptions>;
	islandManifest: IslandManifest | null;
	renderOptions?: ComponentRenderOptions;
	layoutResolver?: EnhancedLayoutResolver;
	fileSystemRouter?: FileSystemRouter;
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
		streamingEnabled = true,
	} = config;

	// Create file-system routes if enabled
	let fileSystemRouteHandlers: RouteHandler[] = [];
	if (fileSystemRouter) {
		try {
			fileSystemRouteHandlers = await createFileSystemRoutes(
				fileSystemRouter,
				layoutResolver,
				mergedDefaultOptions,
				islandManifest,
				isDev,
				quietMode,
				streamingEnabled
			);
		} catch (error) {
			console.error('Failed to create file-system routes:', error);
			if (isDev) {
				console.warn('Falling back to manual routes only');
			}
		}
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

		// File-system routes (before manual routes for precedence)
		...fileSystemRouteHandlers,

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
