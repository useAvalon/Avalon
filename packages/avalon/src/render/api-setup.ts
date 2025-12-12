/**
 * API routes setup and management
 */

import { join } from '@std/path';
import { discoverApiRoutes } from '../functions/api.ts';

export async function setupApiRoutes(isDev: boolean) {
	if (isDev) {
		const routes = await discoverApiRoutes();
		console.log(`Discovered ${routes.length} API routes`);
		routes.forEach(route => {
			console.log(`  ${route.pattern.pathname} -> src/api/${route.filePath}`);
		});
		return routes;
	}

	try {
		const routesModule = await import(join(Deno.cwd(), 'src/routes.ts'));
		const routes = routesModule.routes;
		console.log(`Loaded ${routes.length} static API routes`);
		return routes;
	} catch {
		console.warn('No static routes found. Run: deno task build-routes');
		console.warn('Falling back to auto-discovery...');
		return await discoverApiRoutes();
	}
}
