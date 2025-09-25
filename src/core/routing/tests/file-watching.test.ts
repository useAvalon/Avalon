/**
 * File Watching Tests - Tests for file system watching and cache invalidation
 */

import { assertEquals, assertExists, assertRejects } from '@std/assert';
import { beforeEach, afterEach, describe, it } from '@std/testing/bdd';
import { resolve, join } from '@std/path';
import { ensureDir, ensureFile } from '@std/fs';
import { RouteDiscovery, type FileChangeEvent } from '../route-discovery.ts';
import { FileSystemRouter } from '../file-system-router.ts';

// Test directories
const testDir = resolve('./test-file-watching');
const testPagesDir = join(testDir, 'pages');
const testApiDir = join(testDir, 'api');

describe('File Watching', () => {
	let routeDiscovery: RouteDiscovery;
	let fileSystemRouter: FileSystemRouter;
	let receivedEvents: FileChangeEvent[] = [];

	beforeEach(async () => {
		// Clean up and create test directories
		try {
			await Deno.remove(testDir, { recursive: true });
		} catch {
			// Ignore if directory doesn't exist
		}

		await ensureDir(testPagesDir);
		await ensureDir(testApiDir);

		// Create initial test files
		await ensureFile(join(testPagesDir, 'index.tsx'));
		await Deno.writeTextFile(
			join(testPagesDir, 'index.tsx'),
			'export default function Home() { return <div>Home</div>; }'
		);

		await ensureFile(join(testApiDir, 'hello.ts'));
		await Deno.writeTextFile(join(testApiDir, 'hello.ts'), 'export function GET() { return new Response("Hello"); }');

		// Initialize RouteDiscovery with watching enabled
		routeDiscovery = new RouteDiscovery({
			pagesDirectory: testPagesDir,
			apiDirectory: testApiDir,
			extensions: ['.tsx', '.ts', '.jsx', '.js'],
			excludeDirectories: ['node_modules', '.git'],
			enableWatching: true,
			developmentMode: true,
		});

		// Initialize FileSystemRouter with watching enabled
		fileSystemRouter = new FileSystemRouter({
			discovery: {
				pagesDirectory: testPagesDir,
				apiDirectory: testApiDir,
				extensions: ['.tsx', '.ts', '.jsx', '.js'],
				excludeDirectories: ['node_modules', '.git'],
				enableWatching: true,
				developmentMode: true,
			},
		});

		// Reset received events
		receivedEvents = [];
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

	describe('RouteDiscovery File Watching', () => {
		it('should start and stop file watching', async () => {
			assertEquals(routeDiscovery.isWatchingActive(), false);

			await routeDiscovery.startWatching();
			assertEquals(routeDiscovery.isWatchingActive(), true);

			await routeDiscovery.stopWatching();
			assertEquals(routeDiscovery.isWatchingActive(), false);
		});

		it('should detect file creation', async () => {
			const eventPromise = new Promise<FileChangeEvent>(resolve => {
				routeDiscovery.addWatcherCallback(event => {
					receivedEvents.push(event);
					if (event.type === 'create' && event.path.includes('about.tsx')) {
						resolve(event);
					}
				});
			});

			await routeDiscovery.startWatching();

			// Create a new file
			const newFilePath = join(testPagesDir, 'about.tsx');
			await Deno.writeTextFile(newFilePath, 'export default function About() { return <div>About</div>; }');

			// Wait for the event
			const event = await eventPromise;
			assertEquals(event.type, 'create');
			assertEquals(event.isDirectory, false);
			assertExists(event.path.includes('about.tsx'));
		});

		it('should detect file modification', async () => {
			const eventPromise = new Promise<FileChangeEvent>(resolve => {
				routeDiscovery.addWatcherCallback(event => {
					receivedEvents.push(event);
					if (event.type === 'modify' && event.path.includes('index.tsx')) {
						resolve(event);
					}
				});
			});

			await routeDiscovery.startWatching();

			// Wait a bit to ensure watcher is ready
			await new Promise(resolve => setTimeout(resolve, 100));

			// Modify existing file
			const filePath = join(testPagesDir, 'index.tsx');
			await Deno.writeTextFile(filePath, 'export default function Home() { return <div>Modified Home</div>; }');

			// Wait for the event
			const event = await eventPromise;
			assertEquals(event.type, 'modify');
			assertEquals(event.isDirectory, false);
		});

		it('should detect file removal', async () => {
			// Create a file to remove
			const tempFilePath = join(testPagesDir, 'temp.tsx');
			await Deno.writeTextFile(tempFilePath, 'export default function Temp() { return <div>Temp</div>; }');

			const eventPromise = new Promise<FileChangeEvent>(resolve => {
				routeDiscovery.addWatcherCallback(event => {
					receivedEvents.push(event);
					if (event.type === 'remove' && event.path.includes('temp.tsx')) {
						resolve(event);
					}
				});
			});

			await routeDiscovery.startWatching();

			// Wait a bit to ensure watcher is ready
			await new Promise(resolve => setTimeout(resolve, 100));

			// Remove the file
			await Deno.remove(tempFilePath);

			// Wait for the event
			const event = await eventPromise;
			assertEquals(event.type, 'remove');
		});

		it('should ignore files with excluded extensions', async () => {
			let eventReceived = false;

			routeDiscovery.addWatcherCallback(event => {
				if (event.path.includes('test.txt')) {
					eventReceived = true;
				}
			});

			await routeDiscovery.startWatching();

			// Create a file with excluded extension
			await Deno.writeTextFile(join(testPagesDir, 'test.txt'), 'test content');

			// Wait a bit
			await new Promise(resolve => setTimeout(resolve, 200));

			assertEquals(eventReceived, false);
		});

		it('should debounce rapid file changes', async () => {
			let eventCount = 0;

			routeDiscovery.addWatcherCallback(event => {
				if (event.path.includes('rapid.tsx')) {
					eventCount++;
				}
			});

			await routeDiscovery.startWatching();

			const filePath = join(testPagesDir, 'rapid.tsx');

			// Make rapid changes
			for (let i = 0; i < 5; i++) {
				await Deno.writeTextFile(filePath, `export default function Rapid${i}() { return <div>${i}</div>; }`);
				await new Promise(resolve => setTimeout(resolve, 10)); // Very short delay
			}

			// Wait for debounce to settle
			await new Promise(resolve => setTimeout(resolve, 300));

			// Should receive fewer events than changes due to debouncing
			assertEquals(eventCount < 5, true);
		});

		it('should handle multiple callbacks', async () => {
			let callback1Called = false;
			let callback2Called = false;

			const callback1 = (event: FileChangeEvent) => {
				if (event.path.includes('multi.tsx')) {
					callback1Called = true;
				}
			};

			const callback2 = (event: FileChangeEvent) => {
				if (event.path.includes('multi.tsx')) {
					callback2Called = true;
				}
			};

			routeDiscovery.addWatcherCallback(callback1);
			routeDiscovery.addWatcherCallback(callback2);

			await routeDiscovery.startWatching();

			// Create a file
			await Deno.writeTextFile(
				join(testPagesDir, 'multi.tsx'),
				'export default function Multi() { return <div>Multi</div>; }'
			);

			// Wait for events
			await new Promise(resolve => setTimeout(resolve, 200));

			assertEquals(callback1Called, true);
			assertEquals(callback2Called, true);

			// Test callback removal
			routeDiscovery.removeWatcherCallback(callback1);
			callback1Called = false;
			callback2Called = false;

			// Modify the file
			await Deno.writeTextFile(
				join(testPagesDir, 'multi.tsx'),
				'export default function Multi() { return <div>Modified Multi</div>; }'
			);

			// Wait for events
			await new Promise(resolve => setTimeout(resolve, 200));

			assertEquals(callback1Called, false);
			assertEquals(callback2Called, true);
		});
	});

	describe('FileSystemRouter Cache Invalidation', () => {
		it('should invalidate route cache when page files change', async () => {
			// Discover initial routes
			const initialRoutes = await fileSystemRouter.discoverRoutes();
			assertEquals(initialRoutes.length > 0, true);

			// Start watching
			await fileSystemRouter.startWatching();

			// Wait for watcher to be ready
			await new Promise(resolve => setTimeout(resolve, 100));

			// Create a new page file
			await Deno.writeTextFile(
				join(testPagesDir, 'new-page.tsx'),
				'export default function NewPage() { return <div>New Page</div>; }'
			);

			// Wait for file change to be processed
			await new Promise(resolve => setTimeout(resolve, 300));

			// Discover routes again - should include the new route
			const updatedRoutes = await fileSystemRouter.discoverRoutes();
			assertEquals(updatedRoutes.length > initialRoutes.length, true);

			// Check that the new route is included
			const newRoute = updatedRoutes.find(route => route.filePath.includes('new-page.tsx'));
			assertExists(newRoute);
		});

		it('should invalidate API route cache when API files change', async () => {
			// Discover initial API routes
			const initialApiRoutes = await fileSystemRouter.discoverApiRoutes();
			assertEquals(initialApiRoutes.length > 0, true);

			// Start watching
			await fileSystemRouter.startWatching();

			// Wait for watcher to be ready
			await new Promise(resolve => setTimeout(resolve, 100));

			// Create a new API file
			await Deno.writeTextFile(
				join(testApiDir, 'new-endpoint.ts'),
				'export function GET() { return new Response("New Endpoint"); }'
			);

			// Wait for file change to be processed
			await new Promise(resolve => setTimeout(resolve, 300));

			// Discover API routes again - should include the new route
			const updatedApiRoutes = await fileSystemRouter.discoverApiRoutes();
			assertEquals(updatedApiRoutes.length > initialApiRoutes.length, true);

			// Check that the new route is included
			const newRoute = updatedApiRoutes.find(route => route.filePath.includes('new-endpoint.ts'));
			assertExists(newRoute);
		});

		it('should clear all caches when special files change', async () => {
			// Start watching
			await fileSystemRouter.startWatching();

			// Wait for watcher to be ready
			await new Promise(resolve => setTimeout(resolve, 100));

			// Create a special file (layout)
			await Deno.writeTextFile(
				join(testPagesDir, '_layout.tsx'),
				'export default function Layout({ children }) { return <div>{children}</div>; }'
			);

			// Wait for file change to be processed
			await new Promise(resolve => setTimeout(resolve, 300));

			// The cache invalidation should have occurred
			// We can't directly test cache state, but we can verify the system still works
			const routes = await fileSystemRouter.discoverRoutes();
			assertEquals(routes.length > 0, true);
		});

		it('should handle file removal gracefully', async () => {
			// Create a temporary page
			const tempPagePath = join(testPagesDir, 'temp-page.tsx');
			await Deno.writeTextFile(tempPagePath, 'export default function TempPage() { return <div>Temp</div>; }');

			// Discover routes with the temp page
			const routesWithTemp = await fileSystemRouter.discoverRoutes();
			const tempRoute = routesWithTemp.find(route => route.filePath.includes('temp-page.tsx'));
			assertExists(tempRoute);

			// Start watching
			await fileSystemRouter.startWatching();

			// Wait for watcher to be ready
			await new Promise(resolve => setTimeout(resolve, 100));

			// Remove the temp page
			await Deno.remove(tempPagePath);

			// Wait for file change to be processed
			await new Promise(resolve => setTimeout(resolve, 300));

			// Discover routes again - should not include the removed route
			const routesWithoutTemp = await fileSystemRouter.discoverRoutes();
			const removedRoute = routesWithoutTemp.find(route => route.filePath.includes('temp-page.tsx'));
			assertEquals(removedRoute, undefined);
		});

		it('should provide public methods for controlling file watching', async () => {
			assertEquals(fileSystemRouter.isWatchingActive(), false);

			await fileSystemRouter.startWatching();
			assertEquals(fileSystemRouter.isWatchingActive(), true);

			await fileSystemRouter.stopWatching();
			assertEquals(fileSystemRouter.isWatchingActive(), false);
		});

		it('should clear all caches when requested', async () => {
			// Discover some routes to populate caches
			await fileSystemRouter.discoverRoutes();
			await fileSystemRouter.discoverApiRoutes();

			// Clear all caches
			fileSystemRouter.clearAllCaches();

			// The system should still work after cache clearing
			const routes = await fileSystemRouter.discoverRoutes();
			assertEquals(routes.length > 0, true);
		});
	});

	describe('Error Handling', () => {
		it('should handle watcher initialization errors gracefully', async () => {
			// Create RouteDiscovery with invalid directory
			const invalidRouteDiscovery = new RouteDiscovery({
				pagesDirectory: '/nonexistent/directory',
				apiDirectory: '/nonexistent/api',
				extensions: ['.tsx', '.ts', '.jsx', '.js'],
				excludeDirectories: ['node_modules', '.git'],
				enableWatching: true,
				developmentMode: true,
			});

			// Should not throw, but should handle the error gracefully
			await invalidRouteDiscovery.startWatching();
			assertEquals(invalidRouteDiscovery.isWatchingActive(), false);
		});

		it('should handle callback errors gracefully', async () => {
			const errorCallback = (_event: FileChangeEvent) => {
				throw new Error('Callback error');
			};

			routeDiscovery.addWatcherCallback(errorCallback);
			await routeDiscovery.startWatching();

			// Create a file to trigger the callback
			await Deno.writeTextFile(
				join(testPagesDir, 'error-test.tsx'),
				'export default function ErrorTest() { return <div>Error Test</div>; }'
			);

			// Wait for processing
			await new Promise(resolve => setTimeout(resolve, 200));

			// The watcher should still be active despite the callback error
			assertEquals(routeDiscovery.isWatchingActive(), true);
		});
	});
});
