/**
 * Tests for API route discovery functionality
 */

import { assertEquals, assert, assertRejects } from '@std/assert';
import { join } from '@std/path';
import { ensureDir, ensureFile } from '@std/fs';
import { RouteDiscovery, discoverApiRoutes } from '../route-discovery.ts';
import type { FileSystemApiRoute } from '../../../schemas/routing.ts';

// Test setup - create temporary API directory structure
const testApiDir = './test-api-temp';

async function setupTestApiStructure() {
	// Clean up any existing test directory
	try {
		await Deno.remove(testApiDir, { recursive: true });
	} catch {
		// Ignore if directory doesn't exist
	}

	// Create test API structure
	await ensureDir(join(testApiDir, 'auth'));
	await ensureDir(join(testApiDir, 'users', '[id]'));
	await ensureDir(join(testApiDir, 'blog', '[slug]'));
	await ensureDir(join(testApiDir, '_private'));

	// Create test API files
	const apiFiles = [
		// Static routes
		{ path: 'index.ts', content: 'export function GET() { return new Response("API root"); }' },
		{ path: 'health.ts', content: 'export function GET() { return new Response("OK"); }' },

		// Auth routes
		{ path: 'auth/login.ts', content: 'export function POST() { return new Response("Login"); }' },
		{ path: 'auth/logout.ts', content: 'export function POST() { return new Response("Logout"); }' },
		{ path: 'auth/register.ts', content: 'export function POST() { return new Response("Register"); }' },

		// Dynamic routes
		{
			path: 'users/[id].ts',
			content:
				'export function GET() { return new Response("User"); }\nexport function PUT() { return new Response("Update user"); }',
		},
		{ path: 'users/[id]/profile.ts', content: 'export function GET() { return new Response("Profile"); }' },

		// Blog routes with catch-all
		{ path: 'blog/[slug].ts', content: 'export function GET() { return new Response("Blog post"); }' },
		{ path: 'blog/[...path].ts', content: 'export function GET() { return new Response("Blog catch-all"); }' },

		// Multiple HTTP methods
		{
			path: 'posts.ts',
			content:
				'export function GET() { return new Response("Get posts"); }\nexport function POST() { return new Response("Create post"); }',
		},

		// Private file (should be ignored)
		{ path: '_private/secret.ts', content: 'export function GET() { return new Response("Secret"); }' },

		// Middleware file (should be ignored for routing)
		{ path: '_middleware.ts', content: 'export default function middleware() { return new Response(); }' },
		{ path: 'auth/_middleware.ts', content: 'export default function authMiddleware() { return new Response(); }' },
	];

	for (const file of apiFiles) {
		const filePath = join(testApiDir, file.path);
		await ensureFile(filePath);
		await Deno.writeTextFile(filePath, file.content);
	}
}

async function cleanupTestApiStructure() {
	try {
		await Deno.remove(testApiDir, { recursive: true });
	} catch {
		// Ignore cleanup errors
	}
}

Deno.test('API Route Discovery - scanApiDirectory', async () => {
	await setupTestApiStructure();

	try {
		const discovery = new RouteDiscovery({
			apiDirectory: testApiDir,
			developmentMode: true,
		});

		const apiFiles = await discovery.scanApiDirectory();

		// Should find all API files except private ones
		assert(apiFiles.length >= 10, `Expected at least 10 API files, got ${apiFiles.length}`);

		// Check that we found expected files
		const filePaths = apiFiles.map(f => f.relativePath);
		assert(filePaths.includes('index.ts'));
		assert(filePaths.includes('health.ts'));
		assert(filePaths.includes('auth/login.ts'));
		assert(filePaths.includes('users/[id].ts'));
		assert(filePaths.includes('blog/[...path].ts'));

		// Should include middleware files in scan (they're filtered out during route creation)
		assert(filePaths.includes('_middleware.ts'));
		assert(filePaths.includes('auth/_middleware.ts'));

		// Should include private files in scan (they're filtered out during route creation)
		assert(filePaths.includes('_private/secret.ts'));
	} finally {
		await cleanupTestApiStructure();
	}
});

Deno.test('API Route Discovery - createApiRoutePattern', async () => {
	await setupTestApiStructure();

	try {
		const discovery = new RouteDiscovery({
			apiDirectory: testApiDir,
		});

		// Test static API route
		const staticPattern = discovery.createApiRoutePattern('health.ts');
		assertEquals(staticPattern.pathname, '/api/health');

		// Test API index route
		const indexPattern = discovery.createApiRoutePattern('index.ts');
		assertEquals(indexPattern.pathname, '/api');

		// Test nested API route
		const nestedPattern = discovery.createApiRoutePattern('auth/login.ts');
		assertEquals(nestedPattern.pathname, '/api/auth/login');

		// Test dynamic API route
		const dynamicPattern = discovery.createApiRoutePattern('users/[id].ts');
		assertEquals(dynamicPattern.pathname, '/api/users/:id');

		// Test nested dynamic API route
		const nestedDynamicPattern = discovery.createApiRoutePattern('users/[id]/profile.ts');
		assertEquals(nestedDynamicPattern.pathname, '/api/users/:id/profile');

		// Test catch-all API route
		const catchAllPattern = discovery.createApiRoutePattern('blog/[...path].ts');
		assertEquals(catchAllPattern.pathname, '/api/blog/:path*');
	} finally {
		await cleanupTestApiStructure();
	}
});

Deno.test('API Route Discovery - createApiRoutes', async () => {
	await setupTestApiStructure();

	try {
		const discovery = new RouteDiscovery({
			apiDirectory: testApiDir,
			developmentMode: true,
		});

		const apiFiles = await discovery.scanApiDirectory();
		const apiRoutes = await discovery.createApiRoutes(apiFiles);

		// Should create routes for non-private, non-middleware files
		assert(apiRoutes.length >= 8, `Expected at least 8 API routes, got ${apiRoutes.length}`);

		// Check specific routes
		const routePatterns = apiRoutes.map(r => r.pattern.pathname);
		assert(routePatterns.includes('/api'));
		assert(routePatterns.includes('/api/health'));
		assert(routePatterns.includes('/api/auth/login'));
		assert(routePatterns.includes('/api/users/:id'));
		assert(routePatterns.includes('/api/users/:id/profile'));
		assert(routePatterns.includes('/api/blog/:slug'));
		assert(routePatterns.includes('/api/blog/:path*'));

		// Should not include private files or middleware
		assert(!routePatterns.includes('/api/_private/secret'));
		assert(!routePatterns.some(p => p.includes('_middleware')));

		// Check HTTP methods are extracted correctly
		const postsRoute = apiRoutes.find(r => r.pattern.pathname === '/api/posts');
		assert(postsRoute, 'Posts route should exist');
		assert(postsRoute.methods.includes('GET'));
		assert(postsRoute.methods.includes('POST'));

		const loginRoute = apiRoutes.find(r => r.pattern.pathname === '/api/auth/login');
		assert(loginRoute, 'Login route should exist');
		assert(loginRoute.methods.includes('POST'));
		assert(!loginRoute.methods.includes('GET'));

		// Check dynamic segments are extracted
		const userRoute = apiRoutes.find(r => r.pattern.pathname === '/api/users/:id');
		assert(userRoute, 'User route should exist');
		assertEquals(userRoute.dynamicSegments, ['id']);

		const blogCatchAllRoute = apiRoutes.find(r => r.pattern.pathname === '/api/blog/:path*');
		assert(blogCatchAllRoute, 'Blog catch-all route should exist');
		assertEquals(blogCatchAllRoute.dynamicSegments, ['path']);
	} finally {
		await cleanupTestApiStructure();
	}
});

Deno.test('API Route Discovery - priority calculation', async () => {
	await setupTestApiStructure();

	try {
		const discovery = new RouteDiscovery({
			apiDirectory: testApiDir,
		});

		const apiFiles = await discovery.scanApiDirectory();
		const apiRoutes = await discovery.createApiRoutes(apiFiles);

		// Routes should be sorted by priority (lower = higher priority)
		const priorities = apiRoutes.map(r => r.priority);
		const sortedPriorities = [...priorities].sort((a, b) => a - b);
		assertEquals(priorities, sortedPriorities, 'Routes should be sorted by priority');

		// Static routes should have higher priority than dynamic routes
		const staticRoute = apiRoutes.find(r => r.pattern.pathname === '/api/health');
		const dynamicRoute = apiRoutes.find(r => r.pattern.pathname === '/api/users/:id');

		assert(staticRoute && dynamicRoute, 'Both routes should exist');
		assert(staticRoute.priority < dynamicRoute.priority, 'Static routes should have higher priority');

		// More specific routes should have higher priority
		const userRoute = apiRoutes.find(r => r.pattern.pathname === '/api/users/:id');
		const userProfileRoute = apiRoutes.find(r => r.pattern.pathname === '/api/users/:id/profile');

		assert(userRoute && userProfileRoute, 'Both user routes should exist');
		assert(userProfileRoute.priority < userRoute.priority, 'More specific routes should have higher priority');
	} finally {
		await cleanupTestApiStructure();
	}
});

Deno.test('API Route Discovery - conflict detection', async () => {
	// Create a test structure with conflicting routes
	const conflictTestDir = './test-api-conflict-temp';

	try {
		await ensureDir(join(conflictTestDir, 'users'));

		// Create two files that would create the same route pattern
		await ensureFile(join(conflictTestDir, 'users/profile.ts'));
		await Deno.writeTextFile(
			join(conflictTestDir, 'users/profile.ts'),
			'export function GET() { return new Response("Profile 1"); }'
		);

		await ensureFile(join(conflictTestDir, 'users/[id].ts'));
		await Deno.writeTextFile(
			join(conflictTestDir, 'users/[id].ts'),
			'export function GET() { return new Response("User by ID"); }'
		);

		const discovery = new RouteDiscovery({
			apiDirectory: conflictTestDir,
			developmentMode: true,
		});

		const apiFiles = await discovery.scanApiDirectory();
		const apiRoutes = await discovery.createApiRoutes(apiFiles);

		// Should handle the routes without throwing (conflict resolution happens at runtime)
		assert(apiRoutes.length >= 2);

		// Validate route patterns
		const errors = discovery.validateApiRoutePatterns(apiRoutes);
		// No errors expected since different patterns
		assertEquals(errors.length, 0);
	} finally {
		try {
			await Deno.remove(conflictTestDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	}
});

Deno.test('API Route Discovery - utility function', async () => {
	await setupTestApiStructure();

	try {
		const apiRoutes = await discoverApiRoutes({
			apiDirectory: testApiDir,
			developmentMode: true,
		});

		assert(apiRoutes.length >= 8, `Expected at least 8 API routes, got ${apiRoutes.length}`);

		// Check that routes are properly formed
		for (const route of apiRoutes) {
			assert(route.pattern, 'Route should have a pattern');
			assert(route.filePath, 'Route should have a file path');
			assert(route.methods.length > 0, 'Route should have at least one HTTP method');
			assert(typeof route.priority === 'number', 'Route should have a numeric priority');
			assert(Array.isArray(route.dynamicSegments), 'Route should have dynamic segments array');
		}
	} finally {
		await cleanupTestApiStructure();
	}
});

Deno.test('API Route Discovery - nonexistent directory', async () => {
	const discovery = new RouteDiscovery({
		apiDirectory: './nonexistent-api-dir',
	});

	// Should handle nonexistent directory gracefully
	const apiFiles = await discovery.scanApiDirectory();
	assertEquals(apiFiles.length, 0);
});

Deno.test('API Route Discovery - HTTP method extraction', async () => {
	const methodTestDir = './test-api-methods-temp';

	try {
		await ensureDir(methodTestDir);

		// Create API files with different method combinations
		const testFiles = [
			{
				path: 'get-only.ts',
				content: 'export function GET() { return new Response("GET only"); }',
				expectedMethods: ['GET'],
			},
			{
				path: 'post-only.ts',
				content: 'export function POST() { return new Response("POST only"); }',
				expectedMethods: ['POST'],
			},
			{
				path: 'crud.ts',
				content: `
					export function GET() { return new Response("GET"); }
					export function POST() { return new Response("POST"); }
					export function PUT() { return new Response("PUT"); }
					export function DELETE() { return new Response("DELETE"); }
				`,
				expectedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
			},
			{
				path: 'all-methods.ts',
				content: `
					export function GET() { return new Response("GET"); }
					export function POST() { return new Response("POST"); }
					export function PUT() { return new Response("PUT"); }
					export function DELETE() { return new Response("DELETE"); }
					export function PATCH() { return new Response("PATCH"); }
					export function HEAD() { return new Response("HEAD"); }
					export function OPTIONS() { return new Response("OPTIONS"); }
				`,
				expectedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
			},
		];

		for (const testFile of testFiles) {
			await ensureFile(join(methodTestDir, testFile.path));
			await Deno.writeTextFile(join(methodTestDir, testFile.path), testFile.content);
		}

		const discovery = new RouteDiscovery({
			apiDirectory: methodTestDir,
		});

		const apiFiles = await discovery.scanApiDirectory();
		const apiRoutes = await discovery.createApiRoutes(apiFiles);

		// Check each route has the expected methods
		for (const testFile of testFiles) {
			const routePath = `/api/${testFile.path.replace('.ts', '')}`;
			const route = apiRoutes.find(r => r.pattern.pathname === routePath);

			assert(route, `Route for ${testFile.path} should exist`);

			for (const expectedMethod of testFile.expectedMethods) {
				assert(
					route.methods.includes(expectedMethod as any),
					`Route ${routePath} should include method ${expectedMethod}, got: ${route.methods.join(', ')}`
				);
			}

			assertEquals(
				route.methods.length,
				testFile.expectedMethods.length,
				`Route ${routePath} should have exactly ${testFile.expectedMethods.length} methods`
			);
		}
	} finally {
		try {
			await Deno.remove(methodTestDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	}
});
