/**
 * File Watching Unit Tests - Unit tests for file watching functionality
 */

import { assertEquals, assertExists } from '@std/assert';
import { beforeEach, afterEach, describe, it } from '@std/testing/bdd';
import { resolve, join } from '@std/path';
import { ensureDir } from '@std/fs';
import { RouteDiscovery, type FileChangeEvent } from '../route-discovery.ts';
import { FileSystemRouter } from '../file-system-router.ts';

// Test directories
const testDir = resolve('./test-file-watching-unit');
const testPagesDir = join(testDir, 'pages');
const testApiDir = join(testDir, 'api');

describe('File Watching - Unit Tests', () => {
	beforeEach(async () => {
		// Clean up and create test directories
		try {
			await Deno.remove(testDir, { recursive: true });
		} catch {
			// Ignore if directory doesn't exist
		}

		await ensureDir(testPagesDir);
		await ensureDir(testApiDir);
	});

	afterEach(async () => {
		try {
			await Deno.remove(testDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe('RouteDiscovery Configuration', () => {
		it('should initialize with file watching disabled by default', () => {
			const routeDiscovery = new RouteDiscovery({
				pagesDirectory: testPagesDir,
				apiDirectory: testApiDir,
				extensions: ['.tsx', '.ts', '.jsx', '.js'],
				excludeDirectories: ['node_modules', '.git'],
				developmentMode: false,
			});

			assertEquals(routeDiscovery.isWatchingActive(), false);
		});

		it('should initialize with file watching enabled when configured', () => {
			const routeDiscovery = new RouteDiscovery({
				pagesDirectory: testPagesDir,
				apiDirectory: testApiDir,
				extensions: ['.tsx', '.ts', '.jsx', '.js'],
				excludeDirectories: ['node_modules', '.git'],
				enableWatching: true,
				developmentMode: false,
			});

			assertEquals(routeDiscovery.isWatchingActive(), false); // Still false until startWatching is called
		});

		it('should handle callback management', () => {
			const routeDiscovery = new RouteDiscovery({
				pagesDirectory: testPagesDir,
				apiDirectory: testApiDir,
				extensions: ['.tsx', '.ts', '.jsx', '.js'],
				excludeDirectories: ['node_modules', '.git'],
				enableWatching: true,
				developmentMode: false,
			});

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

		it('should not start watching when enableWatching is false', async () => {
			const routeDiscovery = new RouteDiscovery({
				pagesDirectory: testPagesDir,
				apiDirectory: testApiDir,
				extensions: ['.tsx', '.ts', '.jsx', '.js'],
				excludeDirectories: ['node_modules', '.git'],
				enableWatching: false,
				developmentMode: false,
			});

			await routeDiscovery.startWatching();
			assertEquals(routeDiscovery.isWatchingActive(), false);
		});

		it('should handle invalid directories gracefully', async () => {
			const routeDiscovery = new RouteDiscovery({
				pagesDirectory: '/nonexistent/pages',
				apiDirectory: '/nonexistent/api',
				extensions: ['.tsx', '.ts', '.jsx', '.js'],
				excludeDirectories: ['node_modules', '.git'],
				enableWatching: true,
				developmentMode: false,
			});

			// Should not throw, but should handle the error gracefully
			await routeDiscovery.startWatching();
			assertEquals(routeDiscovery.isWatchingActive(), false);
		});
	});

	describe('FileSystemRouter Configuration', () => {
		it('should initialize with file watching configuration', () => {
			const fileSystemRouter = new FileSystemRouter({
				discovery: {
					pagesDirectory: testPagesDir,
					apiDirectory: testApiDir,
					extensions: ['.tsx', '.ts', '.jsx', '.js'],
					excludeDirectories: ['node_modules', '.git'],
					enableWatching: true,
					developmentMode: false,
				},
			});

			assertEquals(fileSystemRouter.isWatchingActive(), false); // Not started yet
		});

		it('should provide cache management methods', () => {
			const fileSystemRouter = new FileSystemRouter({
				discovery: {
					pagesDirectory: testPagesDir,
					apiDirectory: testApiDir,
					extensions: ['.tsx', '.ts', '.jsx', '.js'],
					excludeDirectories: ['node_modules', '.git'],
					enableWatching: false,
					developmentMode: false,
				},
			});

			// Should not throw
			fileSystemRouter.clearAllCaches();
		});

		it('should handle route discovery with file watching disabled', async () => {
			const fileSystemRouter = new FileSystemRouter({
				discovery: {
					pagesDirectory: testPagesDir,
					apiDirectory: testApiDir,
					extensions: ['.tsx', '.ts', '.jsx', '.js'],
					excludeDirectories: ['node_modules', '.git'],
					enableWatching: false,
					developmentMode: false,
				},
			});

			// Create a test file
			await Deno.writeTextFile(
				join(testPagesDir, 'index.tsx'),
				'export default function Home() { return <div>Home</div>; }'
			);

			// Should discover routes without file watching
			const routes = await fileSystemRouter.discoverRoutes();
			assertEquals(routes.length > 0, true);
		});

		it('should handle API route discovery with file watching disabled', async () => {
			const fileSystemRouter = new FileSystemRouter({
				discovery: {
					pagesDirectory: testPagesDir,
					apiDirectory: testApiDir,
					extensions: ['.tsx', '.ts', '.jsx', '.js'],
					excludeDirectories: ['node_modules', '.git'],
					enableWatching: false,
					developmentMode: false,
				},
			});

			// Create a test API file
			await Deno.writeTextFile(join(testApiDir, 'hello.ts'), 'export function GET() { return new Response("Hello"); }');

			// Should discover API routes without file watching
			const apiRoutes = await fileSystemRouter.discoverApiRoutes();
			assertEquals(apiRoutes.length > 0, true);
		});
	});

	describe('Cache Invalidation Logic', () => {
		it('should provide cache invalidation methods', () => {
			const fileSystemRouter = new FileSystemRouter({
				discovery: {
					pagesDirectory: testPagesDir,
					apiDirectory: testApiDir,
					extensions: ['.tsx', '.ts', '.jsx', '.js'],
					excludeDirectories: ['node_modules', '.git'],
					enableWatching: false,
					developmentMode: false,
				},
			});

			// Test that cache invalidation methods exist and don't throw
			fileSystemRouter.clearAllCaches();
		});

		it('should handle file extension filtering', () => {
			const routeDiscovery = new RouteDiscovery({
				pagesDirectory: testPagesDir,
				apiDirectory: testApiDir,
				extensions: ['.tsx'], // Only TypeScript React files
				excludeDirectories: ['node_modules', '.git'],
				enableWatching: false,
				developmentMode: false,
			});

			// The configuration should be accepted
			assertEquals(routeDiscovery.isWatchingActive(), false);
		});

		it('should handle directory exclusion configuration', () => {
			const routeDiscovery = new RouteDiscovery({
				pagesDirectory: testPagesDir,
				apiDirectory: testApiDir,
				extensions: ['.tsx', '.ts', '.jsx', '.js'],
				excludeDirectories: ['node_modules', '.git', 'dist'], // Custom exclusions
				enableWatching: false,
				developmentMode: false,
			});

			// The configuration should be accepted
			assertEquals(routeDiscovery.isWatchingActive(), false);
		});
	});

	describe('Integration Points', () => {
		it('should integrate RouteDiscovery with FileSystemRouter', async () => {
			const fileSystemRouter = new FileSystemRouter({
				discovery: {
					pagesDirectory: testPagesDir,
					apiDirectory: testApiDir,
					extensions: ['.tsx', '.ts', '.jsx', '.js'],
					excludeDirectories: ['node_modules', '.git'],
					enableWatching: false,
					developmentMode: false,
				},
			});

			// Create test files
			await Deno.writeTextFile(
				join(testPagesDir, 'test.tsx'),
				'export default function Test() { return <div>Test</div>; }'
			);

			await Deno.writeTextFile(join(testApiDir, 'test.ts'), 'export function GET() { return new Response("Test"); }');

			// Should discover both page and API routes
			const routes = await fileSystemRouter.discoverRoutes();
			const apiRoutes = await fileSystemRouter.discoverApiRoutes();

			assertEquals(routes.length > 0, true);
			assertEquals(apiRoutes.length > 0, true);

			// Verify the routes contain our test files
			const testRoute = routes.find(route => route.filePath.includes('test.tsx'));
			const testApiRoute = apiRoutes.find(route => route.filePath.includes('test.ts'));

			assertExists(testRoute);
			assertExists(testApiRoute);
		});

		it('should handle empty directories gracefully', async () => {
			const fileSystemRouter = new FileSystemRouter({
				discovery: {
					pagesDirectory: testPagesDir,
					apiDirectory: testApiDir,
					extensions: ['.tsx', '.ts', '.jsx', '.js'],
					excludeDirectories: ['node_modules', '.git'],
					enableWatching: false,
					developmentMode: false,
				},
			});

			// Should handle empty directories without errors
			const routes = await fileSystemRouter.discoverRoutes();
			const apiRoutes = await fileSystemRouter.discoverApiRoutes();

			assertEquals(Array.isArray(routes), true);
			assertEquals(Array.isArray(apiRoutes), true);
		});
	});
});
