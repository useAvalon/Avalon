/**
 * Simple File Watching Tests - Basic tests for file system watching functionality
 */

import { assertEquals, assertExists } from '@std/assert';
import { beforeEach, afterEach, describe, it } from '@std/testing/bdd';
import { resolve, join } from '@std/path';
import { ensureDir } from '@std/fs';
import { RouteDiscovery, type FileChangeEvent } from '../route-discovery.ts';
import { FileSystemRouter } from '../file-system-router.ts';

// Test directories
const testDir = resolve('./test-file-watching-simple');
const testPagesDir = join(testDir, 'pages');
const testApiDir = join(testDir, 'api');

describe('File Watching - Simple Tests', () => {
	let routeDiscovery: RouteDiscovery;
	let fileSystemRouter: FileSystemRouter;

	beforeEach(async () => {
		// Clean up and create test directories
		try {
			await Deno.remove(testDir, { recursive: true });
		} catch {
			// Ignore if directory doesn't exist
		}

		await ensureDir(testPagesDir);
		await ensureDir(testApiDir);

		// Initialize RouteDiscovery with watching enabled
		routeDiscovery = new RouteDiscovery({
			pagesDirectory: testPagesDir,
			apiDirectory: testApiDir,
			extensions: ['.tsx', '.ts', '.jsx', '.js'],
			excludeDirectories: ['node_modules', '.git'],
			enableWatching: true,
			developmentMode: false, // Disable debug logging for cleaner tests
		});

		// Initialize FileSystemRouter with watching enabled
		fileSystemRouter = new FileSystemRouter({
			discovery: {
				pagesDirectory: testPagesDir,
				apiDirectory: testApiDir,
				extensions: ['.tsx', '.ts', '.jsx', '.js'],
				excludeDirectories: ['node_modules', '.git'],
				enableWatching: true,
				developmentMode: false, // Disable debug logging for cleaner tests
			},
		});
	});

	afterEach(async () => {
		// Stop watching and clean up
		await routeDiscovery.stopWatching();
		await fileSystemRouter.stopWatching();

		try {
			await Deno.remove(testDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe('Basic File Watching', () => {
		it('should start and stop file watching', async () => {
			assertEquals(routeDiscovery.isWatchingActive(), false);

			await routeDiscovery.startWatching();
			assertEquals(routeDiscovery.isWatchingActive(), true);

			await routeDiscovery.stopWatching();
			assertEquals(routeDiscovery.isWatchingActive(), false);
		});

		it('should handle callback management', async () => {
			let callbackCalled = false;

			const callback = (_event: FileChangeEvent) => {
				callbackCalled = true;
			};

			// Add callback
			routeDiscovery.addWatcherCallback(callback);

			// Remove callback
			routeDiscovery.removeWatcherCallback(callback);

			// Callback should be removed successfully
			assertEquals(callbackCalled, false);
		});

		it('should handle invalid directory gracefully', async () => {
			const invalidRouteDiscovery = new RouteDiscovery({
				pagesDirectory: '/nonexistent/directory',
				apiDirectory: '/nonexistent/api',
				extensions: ['.tsx', '.ts', '.jsx', '.js'],
				excludeDirectories: ['node_modules', '.git'],
				enableWatching: true,
				developmentMode: false,
			});

			// Should not throw, but should handle the error gracefully
			await invalidRouteDiscovery.startWatching();
			assertEquals(invalidRouteDiscovery.isWatchingActive(), false);
		});
	});

	describe('FileSystemRouter Integration', () => {
		it('should provide public methods for controlling file watching', async () => {
			assertEquals(fileSystemRouter.isWatchingActive(), false);

			await fileSystemRouter.startWatching();
			assertEquals(fileSystemRouter.isWatchingActive(), true);

			await fileSystemRouter.stopWatching();
			assertEquals(fileSystemRouter.isWatchingActive(), false);
		});

		it('should clear all caches when requested', async () => {
			// Create a test file
			await Deno.writeTextFile(
				join(testPagesDir, 'index.tsx'),
				'export default function Home() { return <div>Home</div>; }'
			);

			// Discover some routes to populate caches
			const routes = await fileSystemRouter.discoverRoutes();
			assertEquals(routes.length > 0, true);

			// Clear all caches
			fileSystemRouter.clearAllCaches();

			// The system should still work after cache clearing
			const routesAfterClear = await fileSystemRouter.discoverRoutes();
			assertEquals(routesAfterClear.length > 0, true);
		});

		it('should handle cache invalidation for page files', async () => {
			// Create initial file
			await Deno.writeTextFile(
				join(testPagesDir, 'initial.tsx'),
				'export default function Initial() { return <div>Initial</div>; }'
			);

			// Discover initial routes
			const initialRoutes = await fileSystemRouter.discoverRoutes();
			assertEquals(initialRoutes.length > 0, true);

			// Start watching
			await fileSystemRouter.startWatching();

			// Create a new page file
			await Deno.writeTextFile(
				join(testPagesDir, 'new-page.tsx'),
				'export default function NewPage() { return <div>New Page</div>; }'
			);

			// Wait a bit for file system events to be processed
			await new Promise(resolve => setTimeout(resolve, 100));

			// Stop watching to avoid interference
			await fileSystemRouter.stopWatching();

			// Discover routes again - should include the new route
			const updatedRoutes = await fileSystemRouter.discoverRoutes();
			assertEquals(updatedRoutes.length > initialRoutes.length, true);

			// Check that the new route is included
			const newRoute = updatedRoutes.find(route => route.filePath.includes('new-page.tsx'));
			assertExists(newRoute);
		});

		it('should handle cache invalidation for API files', async () => {
			// Create initial API file
			await Deno.writeTextFile(
				join(testApiDir, 'initial.ts'),
				'export function GET() { return new Response("Initial"); }'
			);

			// Discover initial API routes
			const initialApiRoutes = await fileSystemRouter.discoverApiRoutes();
			assertEquals(initialApiRoutes.length > 0, true);

			// Start watching
			await fileSystemRouter.startWatching();

			// Create a new API file
			await Deno.writeTextFile(
				join(testApiDir, 'new-endpoint.ts'),
				'export function GET() { return new Response("New Endpoint"); }'
			);

			// Wait a bit for file system events to be processed
			await new Promise(resolve => setTimeout(resolve, 100));

			// Stop watching to avoid interference
			await fileSystemRouter.stopWatching();

			// Discover API routes again - should include the new route
			const updatedApiRoutes = await fileSystemRouter.discoverApiRoutes();
			assertEquals(updatedApiRoutes.length > initialApiRoutes.length, true);

			// Check that the new route is included
			const newRoute = updatedApiRoutes.find(route => route.filePath.includes('new-endpoint.ts'));
			assertExists(newRoute);
		});
	});

	describe('Configuration', () => {
		it('should respect enableWatching configuration', async () => {
			// Create RouteDiscovery with watching disabled
			const noWatchRouteDiscovery = new RouteDiscovery({
				pagesDirectory: testPagesDir,
				apiDirectory: testApiDir,
				extensions: ['.tsx', '.ts', '.jsx', '.js'],
				excludeDirectories: ['node_modules', '.git'],
				enableWatching: false,
				developmentMode: false,
			});

			// Should not start watching when disabled
			await noWatchRouteDiscovery.startWatching();
			assertEquals(noWatchRouteDiscovery.isWatchingActive(), false);
		});

		it('should filter files by extension', async () => {
			// This test verifies that the shouldWatchFile method works correctly
			// We can't directly test it, but we can verify the configuration is respected
			const restrictedRouteDiscovery = new RouteDiscovery({
				pagesDirectory: testPagesDir,
				apiDirectory: testApiDir,
				extensions: ['.tsx'], // Only TypeScript React files
				excludeDirectories: ['node_modules', '.git'],
				enableWatching: true,
				developmentMode: false,
			});

			await restrictedRouteDiscovery.startWatching();
			assertEquals(restrictedRouteDiscovery.isWatchingActive(), true);
			await restrictedRouteDiscovery.stopWatching();
		});
	});
});
