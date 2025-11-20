/**
 * FileSystemRouter - Re-export from the new modular structure
 * @deprecated Use the new modular structure in src/core/routing/router/
 */

// Re-export from the new modular structure
export { FileSystemRouter, FileSystemRouterError, defaultFileSystemRouter } from './router/index.ts';

// Import types for the utility function
import type { RouteHandler } from '../../schemas/routing.ts';
import type { EnhancedLayoutResolver } from '../layout/enhanced-layout-resolver.ts';
import type { RenderOptions } from '../../schemas/core.ts';
import type { IslandManifest } from '../../build/island-manifest.ts';
import type { FileSystemRouter } from "./router/index.ts";

/**
 * Utility function to create file-system route handlers
 * This function discovers routes and builds handlers for them
 */
export async function createFileSystemRouteHandlers(
	fileSystemRouter: FileSystemRouter,
	layoutResolver?: EnhancedLayoutResolver,
	mergedDefaultOptions: Partial<RenderOptions> = {},
	islandManifest: IslandManifest | null = null,
	isDev: boolean = false
): Promise<RouteHandler[]> {
	try {
		// Discover all routes from the file system
		const routes = await fileSystemRouter.discoverRoutes();

		// Build handlers for each route
		const handlers: RouteHandler[] = [];

		for (const route of routes) {
			try {
				const handler = await fileSystemRouter.buildRouteHandler(
					route,
					layoutResolver,
					mergedDefaultOptions,
					islandManifest,
					isDev
				);
				handlers.push(handler);
			} catch (error) {
				console.error(`Failed to build handler for route ${route.pattern}:`, error);
				// In development, we might want to throw, but in production continue
				if (isDev) {
					throw error;
				}
			}
		}

		// Also discover and build API route handlers
		try {
			const apiRoutes = await fileSystemRouter.discoverApiRoutes();
			for (const apiRoute of apiRoutes) {
				try {
					const handler = await fileSystemRouter.buildApiRouteHandler(apiRoute, isDev);
					handlers.push(handler);
				} catch (error) {
					console.error(`Failed to build API handler for route ${apiRoute.pattern}:`, error);
					if (isDev) {
						throw error;
					}
				}
			}
		} catch (error) {
			console.warn('Failed to discover API routes:', error);
			// Continue without API routes
		}

		return handlers;
	} catch (error) {
		console.error('Failed to create file-system route handlers:', error);
		if (isDev) {
			throw error;
		}
		return [];
	}
}
