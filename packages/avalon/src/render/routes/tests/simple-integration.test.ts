/**
 * Simple integration test for file-system routing
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { createFileSystemRoutes } from '../app-routes.ts';
import { FileSystemRouter } from '../../../core/routing/file-system-router.ts';

Deno.test('Simple file-system routing integration', async () => {
	// Test with disabled router
	const disabledRouter = new FileSystemRouter({
		enabled: false,
	});

	const routes = await createFileSystemRoutes(disabledRouter, undefined, {}, null, false);
	assertEquals(routes.length, 0);
});

Deno.test('File-system routing error handling', async () => {
	// Test error handling with invalid directory
	const router = new FileSystemRouter({
		enabled: true,
		discovery: {
			pagesDirectory: 'non-existent-directory',
			developmentMode: false,
			enableWatching: false,
			apiDirectory: 'src/api',
			extensions: ['.tsx', '.ts'],
			excludeDirectories: ['node_modules'],
		},
	});

	// Should not throw in production mode
	const routes = await createFileSystemRoutes(router, undefined, {}, null, false);
	assertEquals(routes.length, 0);
});
