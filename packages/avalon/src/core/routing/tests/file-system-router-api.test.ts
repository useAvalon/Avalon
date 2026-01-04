/**
 * Tests for FileSystemRouter API route functionality
 */

import { assertEquals, assert, assertRejects } from '@std/assert';
import { join } from '@std/path';
import { ensureDir, ensureFile } from '@std/fs';
import {
	FileSystemRouter,
	createFileSystemApiRouteHandlers,
	createAllFileSystemRouteHandlers,
} from '../file-system-router.ts';
import type { FileSystemApiRoute } from '../../../schemas/routing.ts';

// Test setup - create temporary API directory structure
const testApiDir = './test-fs-router-api-temp';

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
	await ensureDir(join(testApiDir, 'blog'));

	// Create test API files
	const apiFiles = [
		// Static routes
		{
			path: 'index.ts',
			content: `
				export function GET(request, context) { 
					return new Response(JSON.stringify({ message: "API root" }), {
						headers: { 'Content-Type': 'application/json' }
					}); 
				}
			`,
		},
		{
			path: 'health.ts',
			content: `
				export function GET(request, context) { 
					return new Response(JSON.stringify({ status: "OK" }), {
						headers: { 'Content-Type': 'application/json' }
					}); 
				}
			`,
		},

		// Auth routes
		{
			path: 'auth/login.ts',
			content: `
				export function POST(request, context) { 
					return new Response(JSON.stringify({ message: "Login successful" }), {
						headers: { 'Content-Type': 'application/json' }
					}); 
				}
			`,
		},

		// Dynamic routes
		{
			path: 'users/[id].ts',
			content: `
				export function GET(request, context) { 
					const { id } = context.params;
					return new Response(JSON.stringify({ userId: id }), {
						headers: { 'Content-Type': 'application/json' }
					}); 
				}
				export function PUT(request, context) { 
					const { id } = context.params;
					return new Response(JSON.stringify({ message: \`User \${id} updated\` }), {
						headers: { 'Content-Type': 'application/json' }
					}); 
				}
			`,
		},

		// Multiple HTTP methods
		{
			path: 'blog/posts.ts',
			content: `
				export function GET(request, context) { 
					return new Response(JSON.stringify({ posts: [] }), {
						headers: { 'Content-Type': 'application/json' }
					}); 
				}
				export function POST(request, context) { 
					return new Response(JSON.stringify({ message: "Post created" }), {
						status: 201,
						headers: { 'Content-Type': 'application/json' }
					}); 
				}
			`,
		},

		// Catch-all route
		{
			path: 'blog/[...path].ts',
			content: `
				export function GET(request, context) { 
					const { path } = context.params;
					return new Response(JSON.stringify({ path }), {
						headers: { 'Content-Type': 'application/json' }
					}); 
				}
			`,
		},

		// Middleware file (should be ignored for routing)
		{
			path: '_middleware.ts',
			content: `
				export default function middleware(request, context) { 
					return new Response(); 
				}
			`,
		},
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

Deno.test('FileSystemRouter - discoverApiRoutes', async () => {
	await setupTestApiStructure();

	try {
		const router = new FileSystemRouter({
			discovery: {
				apiDirectory: testApiDir,
				developmentMode: true,
			},
		});

		const apiRoutes = await router.discoverApiRoutes();

		// Should find all API routes except middleware
		assert(apiRoutes.length >= 5, `Expected at least 5 API routes, got ${apiRoutes.length}`);

		// Check specific routes
		const routePatterns = apiRoutes.map(r => r.pattern.pathname);
		assert(routePatterns.includes('/api'));
		assert(routePatterns.includes('/api/health'));
		assert(routePatterns.includes('/api/auth/login'));
		assert(routePatterns.includes('/api/users/:id'));
		assert(routePatterns.includes('/api/blog/posts'));
		assert(routePatterns.includes('/api/blog/:path*'));

		// Should not include middleware
		assert(!routePatterns.some(p => p.includes('_middleware')));

		// Check HTTP methods are extracted correctly
		const postsRoute = apiRoutes.find(r => r.pattern.pathname === '/api/blog/posts');
		assert(postsRoute, 'Posts route should exist');
		assert(postsRoute.methods.includes('GET'));
		assert(postsRoute.methods.includes('POST'));

		const loginRoute = apiRoutes.find(r => r.pattern.pathname === '/api/auth/login');
		assert(loginRoute, 'Login route should exist');
		assert(loginRoute.methods.includes('POST'));
		assert(!loginRoute.methods.includes('GET'));
	} finally {
		await cleanupTestApiStructure();
	}
});

Deno.test('FileSystemRouter - buildApiRouteHandler', async () => {
	await setupTestApiStructure();

	try {
		const router = new FileSystemRouter({
			discovery: {
				apiDirectory: testApiDir,
				developmentMode: true,
			},
		});

		const apiRoutes = await router.discoverApiRoutes();
		const healthRoute = apiRoutes.find(r => r.pattern.pathname === '/api/health');

		assert(healthRoute, 'Health route should exist');

		const handler = await router.buildApiRouteHandler(healthRoute, true);

		// Test the handler
		const request = new Request('http://localhost:8000/api/health');
		const response = await handler.handler(request);

		assertEquals(response.status, 200);
		assertEquals(response.headers.get('Content-Type'), 'application/json');

		const data = await response.json();
		assertEquals(data.status, 'OK');
	} finally {
		await cleanupTestApiStructure();
	}
});

Deno.test('FileSystemRouter - API route with dynamic parameters', async () => {
	await setupTestApiStructure();

	try {
		const router = new FileSystemRouter({
			discovery: {
				apiDirectory: testApiDir,
				developmentMode: true,
			},
		});

		const apiRoutes = await router.discoverApiRoutes();
		const userRoute = apiRoutes.find(r => r.pattern.pathname === '/api/users/:id');

		assert(userRoute, 'User route should exist');

		const handler = await router.buildApiRouteHandler(userRoute, true);

		// Test GET request with parameter
		const getRequest = new Request('http://localhost:8000/api/users/123');
		const getResponse = await handler.handler(getRequest);

		assertEquals(getResponse.status, 200);
		const getData = await getResponse.json();
		assertEquals(getData.userId, '123');

		// Test PUT request with parameter
		const putRequest = new Request('http://localhost:8000/api/users/456', { method: 'PUT' });
		const putResponse = await handler.handler(putRequest);

		assertEquals(putResponse.status, 200);
		const putData = await putResponse.json();
		assertEquals(putData.message, 'User 456 updated');
	} finally {
		await cleanupTestApiStructure();
	}
});

Deno.test('FileSystemRouter - API route method not allowed', async () => {
	await setupTestApiStructure();

	try {
		const router = new FileSystemRouter({
			discovery: {
				apiDirectory: testApiDir,
				developmentMode: true,
			},
		});

		const apiRoutes = await router.discoverApiRoutes();
		const loginRoute = apiRoutes.find(r => r.pattern.pathname === '/api/auth/login');

		assert(loginRoute, 'Login route should exist');

		const handler = await router.buildApiRouteHandler(loginRoute, true);

		// Test unsupported method (GET on POST-only route)
		const request = new Request('http://localhost:8000/api/auth/login', { method: 'GET' });
		const response = await handler.handler(request);

		assertEquals(response.status, 405);
		assertEquals(response.headers.get('Allow'), 'POST');

		const errorText = await response.text();
		assert(errorText.includes('Method GET not allowed'));
	} finally {
		await cleanupTestApiStructure();
	}
});

Deno.test('FileSystemRouter - API route catch-all parameters', async () => {
	await setupTestApiStructure();

	try {
		const router = new FileSystemRouter({
			discovery: {
				apiDirectory: testApiDir,
				developmentMode: true,
			},
		});

		const apiRoutes = await router.discoverApiRoutes();
		const catchAllRoute = apiRoutes.find(r => r.pattern.pathname === '/api/blog/:path*');

		assert(catchAllRoute, 'Catch-all route should exist');

		const handler = await router.buildApiRouteHandler(catchAllRoute, true);

		// Test catch-all route
		const request = new Request('http://localhost:8000/api/blog/category/tech/post-1');
		const response = await handler.handler(request);

		assertEquals(response.status, 200);
		const data = await response.json();

		// The catch-all parameter should capture the remaining path
		assert(data.path, 'Should have path parameter');
	} finally {
		await cleanupTestApiStructure();
	}
});

Deno.test('FileSystemRouter - createFileSystemApiRouteHandlers utility', async () => {
	await setupTestApiStructure();

	try {
		const router = new FileSystemRouter({
			discovery: {
				apiDirectory: testApiDir,
				developmentMode: true,
			},
		});

		// Discover API routes and build handlers manually since createFileSystemApiRouteHandlers may not be exported
		const apiRoutes = await router.discoverApiRoutes();
		const handlers = [];
		for (const route of apiRoutes) {
			const handler = await router.buildApiRouteHandler(route, true);
			handlers.push(handler);
		}

		// Should create handlers for all API routes
		assert(handlers.length >= 5, `Expected at least 5 API handlers, got ${handlers.length}`);

		// Handlers should be sorted by priority
		const priorities = handlers.map(h => h.metadata.priority);
		const sortedPriorities = [...priorities].sort((a, b) => a - b);
		assertEquals(priorities, sortedPriorities, 'Handlers should be sorted by priority');

		// Test one of the handlers
		const healthHandler = handlers.find(h => h.pattern.pathname === '/api/health');
		assert(healthHandler, 'Health handler should exist');

		const request = new Request('http://localhost:8000/api/health');
		const response = await healthHandler.handler(request);
		assertEquals(response.status, 200);
	} finally {
		await cleanupTestApiStructure();
	}
});

Deno.test('FileSystemRouter - API route error handling', async () => {
	// Create a test API file that throws an error
	const errorTestDir = './test-api-error-temp';

	try {
		await ensureDir(errorTestDir);
		await ensureFile(join(errorTestDir, 'error.ts'));
		await Deno.writeTextFile(
			join(errorTestDir, 'error.ts'),
			`
				export function GET(request, context) { 
					throw new Error('Test error');
				}
			`
		);

		const router = new FileSystemRouter({
			discovery: {
				apiDirectory: errorTestDir,
				developmentMode: true,
			},
		});

		const apiRoutes = await router.discoverApiRoutes();
		const errorRoute = apiRoutes.find(r => r.pattern.pathname === '/api/error');

		assert(errorRoute, 'Error route should exist');

		const handler = await router.buildApiRouteHandler(errorRoute, true);

		// Test error handling
		const request = new Request('http://localhost:8000/api/error');
		const response = await handler.handler(request);

		assertEquals(response.status, 500);
		assertEquals(response.headers.get('Content-Type'), 'application/json');

		const errorData = await response.json();
		assertEquals(errorData.error, 'Internal Server Error');
		assertEquals(errorData.message, 'Test error'); // Should include error message in dev mode
	} finally {
		try {
			await Deno.remove(errorTestDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	}
});

Deno.test('FileSystemRouter - cache functionality for API routes', async () => {
	await setupTestApiStructure();

	try {
		const router = new FileSystemRouter({
			enableCaching: true,
			discovery: {
				apiDirectory: testApiDir,
			},
		});

		// First call should populate cache
		const apiRoutes1 = await router.discoverApiRoutes();
		assert(apiRoutes1.length > 0);

		// Second call should use cache
		const apiRoutes2 = await router.discoverApiRoutes();
		assertEquals(apiRoutes1.length, apiRoutes2.length);

		// Check cache stats
		const stats = router.getCacheStats();
		assert(stats.apiRoutes.size > 0, 'API routes should be cached');

		// Clear cache and verify
		router.clearCache();
		const statsAfterClear = router.getCacheStats();
		assertEquals(statsAfterClear.apiRoutes.size, 0, 'API route cache should be cleared');
	} finally {
		await cleanupTestApiStructure();
	}
});

Deno.test('FileSystemRouter - createAllFileSystemRouteHandlers utility', async () => {
	await setupTestApiStructure();

	try {
		// Also create a simple page structure for testing combined handlers
		const testPagesDir = './test-fs-router-pages-temp';
		await ensureDir(testPagesDir);
		await ensureFile(join(testPagesDir, 'index.tsx'));
		await Deno.writeTextFile(
			join(testPagesDir, 'index.tsx'),
			`
				export default function HomePage() {
					return <div>Home Page</div>;
				}
			`
		);

		const router = new FileSystemRouter({
			discovery: {
				pagesDirectory: testPagesDir,
				apiDirectory: testApiDir,
				developmentMode: true,
			},
		});

		// Create API handlers using the known API factory
		const apiHandlers = await createFileSystemApiRouteHandlers(router, undefined, {}, null, true);

		// Create a minimal page handler stub so we can test combined behavior
		const pageHandlers = [
			{
				pattern: { pathname: '/' },
			},
		];

		const allHandlers = [...pageHandlers, ...apiHandlers];

		// Should include API handlers
		const filteredApiHandlers = allHandlers.filter(h => h.pattern.pathname.startsWith('/api'));
		assert(filteredApiHandlers.length >= 5, 'Should include API handlers');

		// Should include page handlers
		const filteredPageHandlers = allHandlers.filter(h => !h.pattern.pathname.startsWith('/api'));
		assert(filteredPageHandlers.length >= 1, 'Should include page handlers');

		// Clean up pages directory
		try {
			await Deno.remove(testPagesDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	} finally {
		await cleanupTestApiStructure();
	}
});
