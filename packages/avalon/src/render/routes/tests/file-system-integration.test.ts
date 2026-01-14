/**
 * Integration tests for file-system routing with server architecture
 */

import { assertEquals, assertExists } from '@std/assert';
import { createFileSystemRoutes } from '../app-routes.ts';
import { createAllRoutes } from '../index.ts';
import { FileSystemRouter } from '../../../core/routing/file-system-router.ts';
import { EnhancedLayoutResolver, EnhancedLayoutResolverUtils } from '../../../core/layout/enhanced-layout-resolver.ts';
import { DEFAULT_SERVER_PORT } from '../../constants.ts';

Deno.test('File-system routing integration', async t => {
	await t.step('createFileSystemRoutes should return empty array when no pages exist', async () => {
		const fileSystemRouter = new FileSystemRouter({
			enabled: true,
			discovery: {
				pagesDirectory: 'non-existent-directory',
				developmentMode: false, // Disable development mode to avoid file watchers
				enableWatching: false,
				apiDirectory: 'src/api',
				extensions: ['.tsx', '.ts'],
				excludeDirectories: ['node_modules'],
			},
		});

		const routes = await createFileSystemRoutes(fileSystemRouter, undefined, {}, null, false);

		assertEquals(routes.length, 0);
	});

	await t.step('createFileSystemRoutes should handle router errors gracefully', async () => {
		const fileSystemRouter = new FileSystemRouter({
			enabled: true,
			discovery: {
				pagesDirectory: '/invalid/path/that/does/not/exist',
				developmentMode: false, // Disable development mode to avoid file watchers
				enableWatching: false,
				apiDirectory: 'src/api',
				extensions: ['.tsx', '.ts'],
				excludeDirectories: ['node_modules'],
			},
		});

		// Should not throw in production mode
		const routes = await createFileSystemRoutes(
			fileSystemRouter,
			undefined,
			{},
			null,
			false // production mode
		);

		assertEquals(routes.length, 0);
	});

	await t.step('createAllRoutes should include file-system routes when router is provided', async () => {
		const fileSystemRouter = new FileSystemRouter({
			enabled: true,
			discovery: {
				pagesDirectory: 'non-existent-directory',
				developmentMode: false, // Disable development mode to avoid file watchers
				enableWatching: false,
				apiDirectory: 'src/api',
				extensions: ['.tsx', '.ts'],
				excludeDirectories: ['node_modules'],
			},
		});

		const layoutResolver = new EnhancedLayoutResolver(EnhancedLayoutResolverUtils.createProductionConfig('./src'));

		const allRoutes = await createAllRoutes({
			isDev: false, // Use production mode to avoid file watchers
			viteServerUrl: `http://localhost:${DEFAULT_SERVER_PORT}`,
			apiRoutes: [],
			routes: {},
			mergedDefaultOptions: {},
			islandManifest: null,
			renderOptions: {},
			layoutResolver,
			fileSystemRouter,
		});

		// Should have at least framework routes, vite routes, and static routes
		assertExists(allRoutes);
		assertEquals(Array.isArray(allRoutes), true);
	});

	await t.step('createAllRoutes should work without file-system router', async () => {
		const layoutResolver = new EnhancedLayoutResolver(EnhancedLayoutResolverUtils.createProductionConfig('./src'));

		const allRoutes = await createAllRoutes({
			isDev: false, // Use production mode to avoid file watchers
			viteServerUrl: `http://localhost:${DEFAULT_SERVER_PORT}`,
			apiRoutes: [],
			routes: {},
			mergedDefaultOptions: {},
			islandManifest: null,
			renderOptions: {},
			layoutResolver,
			// No fileSystemRouter provided
		});

		// Should still work without file-system routing
		assertExists(allRoutes);
		assertEquals(Array.isArray(allRoutes), true);
	});

	await t.step('file-system routes should have correct structure', async () => {
		const fileSystemRouter = new FileSystemRouter({
			enabled: true,
			discovery: {
				pagesDirectory: 'examples/pages', // Use existing example pages
				developmentMode: false, // Disable development mode to avoid file watchers
				enableWatching: false,
				apiDirectory: 'src/api',
				extensions: ['.tsx', '.ts'],
				excludeDirectories: ['node_modules'],
			},
		});

		const routes = await createFileSystemRoutes(fileSystemRouter, undefined, {}, null, false);

		// Each route should have the correct structure
		for (const route of routes) {
			assertExists(route.pattern);
			assertExists(route.handler);
			assertExists(route.metadata);
			assertExists(route.metadata.filePath);
			assertExists(route.metadata.routeType);
			assertEquals(typeof route.metadata.priority, 'number');
			assertEquals(Array.isArray(route.metadata.dynamicSegments), true);
		}
	});
});

Deno.test('File-system routing configuration', async t => {
	await t.step('should handle disabled file-system routing', async () => {
		const fileSystemRouter = new FileSystemRouter({
			enabled: false, // Disabled
		});

		const routes = await createFileSystemRoutes(fileSystemRouter, undefined, {}, null, true);

		assertEquals(routes.length, 0);
	});

	await t.step('should respect fallback configuration', async () => {
		const fileSystemRouter = new FileSystemRouter({
			enabled: true,
			fallbackToManual: true,
			discovery: {
				pagesDirectory: '/invalid/path',
				developmentMode: false, // Production mode
				enableWatching: false,
				apiDirectory: 'src/api',
				extensions: ['.tsx', '.ts'],
				excludeDirectories: ['node_modules'],
			},
		});

		// Should not throw due to fallbackToManual: true
		const routes = await createFileSystemRoutes(fileSystemRouter, undefined, {}, null, false);

		assertEquals(routes.length, 0);
	});
});
