/**
 * API routes setup and management
 */

import { join } from 'node:path';
import { discoverApiRoutes } from '../functions/api.ts';

export async function setupApiRoutes(isDev: boolean) {
	if (isDev) {
		const routes = await discoverApiRoutes();
		return routes;
	}

	try {
		const routesModule = await import(join(Deno.cwd(), 'src/routes.ts'));
		const routes = routesModule.routes;
		return routes;
	} catch {
		return await discoverApiRoutes();
	}
}
