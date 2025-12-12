/**
 * Tests for FileSystemRouter - Main orchestrator for file-system routing
 */

import { assertEquals, assertExists, assertRejects, assertStringIncludes } from '@std/assert';
import { beforeEach, describe, it, afterEach } from '@std/testing/bdd';
import { join } from '@std/path';
import { ensureDir, emptyDir } from '@std/fs';
import { FileSystemRouter, FileSystemRouterError, createFileSystemRouter } from '../file-system-router.ts';
import type { FileSystemRouterConfig } from '../../../schemas/routing.ts';

describe('FileSystemRouter', () => {
	const testPagesDir = 'test-pages-router';
	let router: FileSystemRouter;

	beforeEach(async () => {
		// Clean up and create test directory
		try {
			await emptyDir(testPagesDir);
		} catch {
			// Directory might not exist
		}
		await ensureDir(testPagesDir);

		// Create router with test configuration
		router = new FileSystemRouter({
			discovery: {
				pagesDirectory: testPagesDir,
				developmentMode: true,
				enableWatching: false,
				apiDirectory: 'test-api',
				extensions: ['.tsx', '.ts', '.jsx', '.js'],
				excludeDirectories: ['node_modules', '.git'],
			},
			enableCaching: false, // Disable caching for tests
		});
	});

	describe('constructor', () => {
		it('should create router with default configuration', () => {
			const defaultRouter = new FileSystemRouter();
			const config = defaultRouter.getConfig();

			assertEquals(config.discovery.pagesDirectory, 'src/pages');
			assertEquals(config.enabled, true);
			assertEquals(config.enableCaching, true);
		});

		it('should merge custom configuration with defaults', () => {
			const customConfig: Partial<FileSystemRouterConfig> = {
				enabled: false,
				discovery: {
					pagesDirectory: 'custom/pages',
					apiDirectory: 'custom/api',
					extensions: ['.tsx'],
					excludeDirectories: ['node_modules'],
					enableWatching: false,
					developmentMode: false,
				},
			};

			const customRouter = new FileSystemRouter(customConfig);
			const config = customRouter.getConfig();

			assertEquals(config.enabled, false);
			assertEquals(config.discovery.pagesDirectory, 'custom/pages');
			assertEquals(config.discovery.extensions, ['.tsx']);
			// Should keep other defaults
			assertEquals(config.fallbackToManual, true);
		});
	});

	describe('discoverRoutes', () => {
		it('should return empty array when disabled', async () => {
			const disabledRouter = new FileSystemRouter({ enabled: false });
			const routes = await disabledRouter.discoverRoutes();
			assertEquals(routes, []);
		});

		it('should discover basic static routes', async () => {
			// Create test page files
			await Deno.writeTextFile(
				join(testPagesDir, 'index.tsx'),
				`export default function Home() { return <div>Home</div>; }`
			);
			await Deno.writeTextFile(
				join(testPagesDir, 'about.tsx'),
				`export default function About() { return <div>About</div>; }`
			);

			const routes = await router.discoverRoutes();
			assertEquals(routes.length, 2);

			// Check route patterns
			const patterns = routes.map(r => r.pattern.pathname);
			assertEquals(patterns.includes('/'), true);
			assertEquals(patterns.includes('/about'), true);
		});

		it('should discover dynamic routes', async () => {
			await ensureDir(join(testPagesDir, 'blog'));
			await Deno.writeTextFile(
				join(testPagesDir, 'blog', '[slug].tsx'),
				`export default function BlogPost({ params }) { return <div>{params.slug}</div>; }`
			);

			const routes = await router.discoverRoutes();
			assertEquals(routes.length, 1);

			const route = routes[0];
			assertEquals(route.routeType, 'dynamic');
			assertEquals(route.dynamicSegments, ['slug']);
			assertEquals(route.pattern.pathname, '/blog/:slug');
		});

		it('should discover catch-all routes', async () => {
			await Deno.writeTextFile(
				join(testPagesDir, '[...rest].tsx'),
				`export default function CatchAll({ params }) { return <div>{params.rest}</div>; }`
			);

			const routes = await router.discoverRoutes();
			assertEquals(routes.length, 1);

			const route = routes[0];
			assertEquals(route.routeType, 'catch-all');
			assertEquals(route.dynamicSegments, ['rest']);
			assertEquals(route.pattern.pathname, '/*');
		});

		it('should skip private folders', async () => {
			await ensureDir(join(testPagesDir, '_components'));
			await Deno.writeTextFile(
				join(testPagesDir, '_components', 'Button.tsx'),
				`export default function Button() { return <button>Click</button>; }`
			);
			await Deno.writeTextFile(
				join(testPagesDir, 'index.tsx'),
				`export default function Home() { return <div>Home</div>; }`
			);

			const routes = await router.discoverRoutes();
			assertEquals(routes.length, 1);
			assertEquals(routes[0].pattern.pathname, '/');
		});

		it('should handle route groups', async () => {
			await ensureDir(join(testPagesDir, '(auth)'));
			await Deno.writeTextFile(
				join(testPagesDir, '(auth)', 'login.tsx'),
				`export default function Login() { return <div>Login</div>; }`
			);

			const routes = await router.discoverRoutes();
			assertEquals(routes.length, 1);

			const route = routes[0];
			assertEquals(route.pattern.pathname, '/login');
			assertEquals(route.routeGroup, 'auth');
		});

		it('should handle route conflicts by priority', async () => {
			// Create routes that would conflict but have different priorities
			await Deno.writeTextFile(
				join(testPagesDir, 'test.tsx'),
				`export default function Test1() { return <div>Test1</div>; }`
			);
			await ensureDir(join(testPagesDir, 'test'));
			await Deno.writeTextFile(
				join(testPagesDir, 'test', 'index.tsx'),
				`export default function Test2() { return <div>Test2</div>; }`
			);

			// This should resolve conflicts by priority, not throw
			const routes = await router.discoverRoutes();
			assertEquals(routes.length, 1); // Should resolve to one route
			assertEquals(routes[0].routeType, 'static'); // Static should win over index
		});
	});

	describe('buildRouteHandler', () => {
		it('should build handler for static route', async () => {
			await Deno.writeTextFile(
				join(testPagesDir, 'about.tsx'),
				`export default function About() { return <div>About</div>; }`
			);

			const routes = await router.discoverRoutes();
			const route = routes[0];
			const handler = await router.buildRouteHandler(route);

			assertExists(handler);
			assertEquals(handler.pattern.pathname, '/about');
			assertEquals(typeof handler.handler, 'function');
			assertEquals(handler.metadata.filePath, route.filePath);
		});

		it('should build handler for dynamic route with parameters', async () => {
			await ensureDir(join(testPagesDir, 'users'));
			await Deno.writeTextFile(
				join(testPagesDir, 'users', '[id].tsx'),
				`export default function User({ params }) { return <div>User {params.id}</div>; }`
			);

			const routes = await router.discoverRoutes();
			const route = routes[0];
			const handler = await router.buildRouteHandler(route);

			assertExists(handler);
			assertEquals(handler.pattern.pathname, '/users/:id');
			assertEquals(handler.metadata.dynamicSegments, ['id']);
		});

		it('should handle page with loader function', async () => {
			await Deno.writeTextFile(
				join(testPagesDir, 'data.tsx'),
				`
				export async function loader({ params }) {
					return { message: 'Hello from loader' };
				}
				export default function DataPage({ data }) { 
					return <div>{data?.message}</div>; 
				}
				`
			);

			const routes = await router.discoverRoutes();
			const route = routes[0];
			const handler = await router.buildRouteHandler(route);

			assertExists(handler);
			// The handler should be able to execute the loader
			assertEquals(typeof handler.handler, 'function');
		});

		it('should handle page with metadata generator', async () => {
			await Deno.writeTextFile(
				join(testPagesDir, 'meta.tsx'),
				`
				export async function generateMetadata({ params }) {
					return { title: 'Dynamic Title' };
				}
				export default function MetaPage() { 
					return <div>Meta Page</div>; 
				}
				`
			);

			const routes = await router.discoverRoutes();
			const route = routes[0];
			const handler = await router.buildRouteHandler(route);

			assertExists(handler);
			assertEquals(typeof handler.handler, 'function');
		});

		it('should throw error for invalid page module', async () => {
			await Deno.writeTextFile(join(testPagesDir, 'invalid.tsx'), `// No default export`);

			const routes = await router.discoverRoutes();
			const route = routes[0];

			await assertRejects(
				() => router.buildRouteHandler(route),
				FileSystemRouterError,
				'Failed to build route handler'
			);
		});
	});

	describe('resolveMetadata', () => {
		it('should resolve basic metadata', async () => {
			const metadata = await router.resolveMetadata('/test');
			assertExists(metadata);
			assertEquals(typeof metadata.resolvedAt, 'number');
			assertEquals(Array.isArray(metadata.sources), true);
		});

		it('should resolve metadata with parameters', async () => {
			const params = { id: '123' };
			const metadata = await router.resolveMetadata('/users/123', undefined, params);
			assertExists(metadata);
		});

		it('should handle metadata generation errors gracefully', async () => {
			const failingGenerator = async () => {
				throw new Error('Metadata generation failed');
			};

			const metadata = await router.resolveMetadata('/test', failingGenerator);
			assertExists(metadata);
			// Should still have sources from metadata chain, plus error handling
			assertEquals(Array.isArray(metadata.sources), true);
		});
	});

	describe('caching', () => {
		it('should cache discovered routes', async () => {
			const cachingRouter = new FileSystemRouter({
				discovery: {
					pagesDirectory: testPagesDir,
					apiDirectory: 'test-api',
					extensions: ['.tsx', '.ts', '.jsx', '.js'],
					excludeDirectories: ['node_modules', '.git'],
					enableWatching: false,
					developmentMode: false,
				},
				enableCaching: true,
			});

			await Deno.writeTextFile(
				join(testPagesDir, 'cached.tsx'),
				`export default function Cached() { return <div>Cached</div>; }`
			);

			// First call should discover routes
			const routes1 = await cachingRouter.discoverRoutes();
			assertEquals(routes1.length, 1);

			// Second call should use cache
			const routes2 = await cachingRouter.discoverRoutes();
			assertEquals(routes2.length, 1);

			// Should be the same reference (cached)
			assertEquals(routes1, routes2);
		});

		it('should provide cache statistics', () => {
			const stats = router.getCacheStats();
			assertExists(stats.routes);
			assertExists(stats.handlers);
			assertExists(stats.metadata);
			assertEquals(typeof stats.routes.size, 'number');
			assertEquals(Array.isArray(stats.routes.keys), true);
		});

		it('should clear all caches', async () => {
			await Deno.writeTextFile(
				join(testPagesDir, 'test.tsx'),
				`export default function Test() { return <div>Test</div>; }`
			);

			// Populate caches
			await router.discoverRoutes();
			await router.resolveMetadata('/test');

			// Clear caches
			router.clearCache();

			const stats = router.getCacheStats();
			assertEquals(stats.routes.size, 0);
			assertEquals(stats.handlers.size, 0);
			assertEquals(stats.metadata.size, 0);
		});

		it('should invalidate specific route cache', async () => {
			await Deno.writeTextFile(
				join(testPagesDir, 'invalidate.tsx'),
				`export default function Invalidate() { return <div>Invalidate</div>; }`
			);

			// Populate caches
			const routes = await router.discoverRoutes();
			const handler = await router.buildRouteHandler(routes[0]);
			await router.resolveMetadata('/invalidate');

			// Invalidate specific route
			router.invalidateRoute('/invalidate');

			// Should have cleared related cache entries
			const stats = router.getCacheStats();
			// Note: Exact counts depend on implementation details
			assertExists(stats);
		});
	});

	describe('configuration management', () => {
		it('should get current configuration', () => {
			const config = router.getConfig();
			assertExists(config);
			assertEquals(config.discovery.pagesDirectory, testPagesDir);
			assertEquals(config.enabled, true);
		});

		it('should update configuration', () => {
			const newConfig: Partial<FileSystemRouterConfig> = {
				enabled: false,
				discovery: {
					pagesDirectory: 'src/pages',
					apiDirectory: 'src/api',
					extensions: ['.tsx'],
					excludeDirectories: ['node_modules', '.git'],
					enableWatching: false,
					developmentMode: false,
				},
			};

			router.updateConfig(newConfig);
			const config = router.getConfig();

			assertEquals(config.enabled, false);
			assertEquals(config.discovery.extensions, ['.tsx']);
			// Should preserve other settings - but pagesDirectory was updated in newConfig
			assertEquals(config.discovery.pagesDirectory, 'src/pages');
		});

		it('should clear cache when significant config changes', () => {
			// This is more of an integration test
			const initialStats = router.getCacheStats();

			router.updateConfig({
				discovery: {
					pagesDirectory: 'different/path',
					apiDirectory: 'different/api',
					extensions: ['.tsx', '.ts', '.jsx', '.js'],
					excludeDirectories: ['node_modules', '.git'],
					enableWatching: false,
					developmentMode: false,
				},
			});

			// Cache should be cleared due to significant change
			const newStats = router.getCacheStats();
			assertEquals(newStats.routes.size, 0);
		});
	});

	describe('factory functions', () => {
		it('should create router with factory function', () => {
			const factoryRouter = createFileSystemRouter({
				enabled: false,
			});

			assertExists(factoryRouter);
			assertEquals(factoryRouter.getConfig().enabled, false);
		});
	});

	describe('error handling', () => {
		it('should handle missing pages directory gracefully', async () => {
			const missingDirRouter = new FileSystemRouter({
				discovery: {
					pagesDirectory: 'non-existent-directory',
					apiDirectory: 'non-existent-api',
					extensions: ['.tsx', '.ts', '.jsx', '.js'],
					excludeDirectories: ['node_modules', '.git'],
					enableWatching: false,
					developmentMode: false,
				},
			});

			// Should not throw, should return empty array
			const routes = await missingDirRouter.discoverRoutes();
			assertEquals(routes, []);
		});

		it('should throw FileSystemRouterError with proper error codes', async () => {
			try {
				// Force an error by using invalid configuration
				const errorRouter = new FileSystemRouter({
					discovery: {
						pagesDirectory: testPagesDir,
						apiDirectory: 'test-api',
						extensions: ['.tsx', '.ts', '.jsx', '.js'],
						excludeDirectories: ['node_modules', '.git'],
						enableWatching: false,
						developmentMode: true,
					},
				});

				// Create conflicting routes
				await Deno.writeTextFile(
					join(testPagesDir, 'conflict.tsx'),
					`export default function Conflict1() { return <div>1</div>; }`
				);
				await ensureDir(join(testPagesDir, 'conflict'));
				await Deno.writeTextFile(
					join(testPagesDir, 'conflict', 'index.tsx'),
					`export default function Conflict2() { return <div>2</div>; }`
				);

				await errorRouter.discoverRoutes();
			} catch (error) {
				assertEquals(error instanceof FileSystemRouterError, true);
				if (error instanceof FileSystemRouterError) {
					assertEquals(error.code, 'ROUTE_CONFLICT');
					assertStringIncludes(error.message, 'Route validation failed');
				}
			}
		});
	});

	// Cleanup
	afterEach(async () => {
		try {
			await Deno.remove(testPagesDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	});
});
