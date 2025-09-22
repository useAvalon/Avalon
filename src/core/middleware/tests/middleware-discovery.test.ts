import { assertEquals, assertExists } from 'jsr:@std/assert';
import { join, resolve } from 'node:path';
import { ensureDir } from '@std/fs';
import { existsSync } from '@std/fs';
import { MiddlewareDiscovery } from '../middleware-discovery.ts';

const testDir = resolve('./test-middleware-temp');
const sampleMiddleware = `export default async function middleware(context, next) { return await next(); }`;

async function setupTestDir(): Promise<MiddlewareDiscovery> {
	if (existsSync(testDir)) {
		await Deno.remove(testDir, { recursive: true, force: true });
	}
	await ensureDir(testDir);
	return new MiddlewareDiscovery({
		baseDirectory: testDir,
		filePattern: '_middleware.ts',
		enableWatching: false,
	});
}

async function cleanupTestDir() {
	if (existsSync(testDir)) {
		await Deno.remove(testDir, { recursive: true, force: true });
	}
}

Deno.test('Middleware Discovery - Global middleware discovery', async () => {
	const discovery = await setupTestDir();
	try {
		await Deno.writeTextFile(join(testDir, '_middleware.ts'), sampleMiddleware);
		const routes = await discovery.discoverMiddleware();
		assertEquals(routes.length, 1);
		assertEquals(routes[0].type, 'global');
		assertEquals(routes[0].priority, 0);
	} finally {
		await cleanupTestDir();
	}
});

Deno.test('Middleware Discovery - Page middleware discovery', async () => {
	const discovery = await setupTestDir();
	try {
		await ensureDir(join(testDir, 'pages'), { recursive: true });
		await Deno.writeTextFile(join(testDir, 'pages', '_middleware.ts'), sampleMiddleware);
		const routes = await discovery.discoverMiddleware();
		assertEquals(routes.length, 1);
		assertEquals(routes[0].type, 'pages');
		assertEquals(routes[0].priority, 11);
	} finally {
		await cleanupTestDir();
	}
});

Deno.test('Middleware Discovery - API middleware discovery', async () => {
	const discovery = await setupTestDir();
	try {
		await ensureDir(join(testDir, 'api'), { recursive: true });
		await Deno.writeTextFile(join(testDir, 'api', '_middleware.ts'), sampleMiddleware);
		const routes = await discovery.discoverMiddleware();
		assertEquals(routes.length, 1);
		assertEquals(routes[0].type, 'api');
		assertEquals(routes[0].priority, 11);
	} finally {
		await cleanupTestDir();
	}
});

Deno.test('Middleware Chain Building - Hierarchical resolution', async () => {
	const discovery = await setupTestDir();
	try {
		await ensureDir(join(testDir, 'pages', 'admin'), { recursive: true });
		await ensureDir(join(testDir, 'api', 'auth'), { recursive: true });

		await Deno.writeTextFile(join(testDir, '_middleware.ts'), sampleMiddleware);
		await Deno.writeTextFile(join(testDir, 'pages', '_middleware.ts'), sampleMiddleware);
		await Deno.writeTextFile(join(testDir, 'pages', 'admin', '_middleware.ts'), sampleMiddleware);
		await Deno.writeTextFile(join(testDir, 'api', '_middleware.ts'), sampleMiddleware);
		await Deno.writeTextFile(join(testDir, 'api', 'auth', '_middleware.ts'), sampleMiddleware);

		// Test nested page route
		const pageUrl = new URL('http://localhost/admin/dashboard');
		const pageChain = await discovery.buildMiddlewareChain(pageUrl);
		assertEquals(pageChain.length, 3); // global + pages + admin

		// Test nested API route
		const apiUrl = new URL('http://localhost/api/auth/login');
		const apiChain = await discovery.buildMiddlewareChain(apiUrl);
		assertEquals(apiChain.length, 3); // global + api + auth
	} finally {
		await cleanupTestDir();
	}
});

Deno.test('Middleware Discovery - URL pattern matching', async () => {
	const discovery = await setupTestDir();
	try {
		await Deno.writeTextFile(join(testDir, '_middleware.ts'), sampleMiddleware);
		const routes = await discovery.discoverMiddleware();
		const globalRoute = routes.find(r => r.type === 'global');
		assertExists(globalRoute);
		assertEquals(globalRoute.pattern.test(new URL('http://localhost/')), true);
		assertEquals(globalRoute.pattern.test(new URL('http://localhost/any/path')), true);
	} finally {
		await cleanupTestDir();
	}
});

Deno.test('Middleware Discovery - Caching functionality', async () => {
	const discovery = await setupTestDir();
	try {
		await Deno.writeTextFile(join(testDir, '_middleware.ts'), sampleMiddleware);
		const routes1 = await discovery.discoverMiddleware();
		const routes2 = await discovery.discoverMiddleware();
		assertEquals(routes1.length, routes2.length);
		assertEquals(discovery.getCacheStats().routeCacheCount, 1);

		discovery.clearCache();
		assertEquals(discovery.getCacheStats().routeCacheCount, 0);
	} finally {
		await cleanupTestDir();
	}
});

Deno.test('Middleware Discovery - Error handling', async () => {
	// Use a unique test directory for this test to avoid caching issues
	const errorTestDir = resolve('./test-middleware-error-temp');

	if (existsSync(errorTestDir)) {
		await Deno.remove(errorTestDir, { recursive: true, force: true });
	}
	await ensureDir(errorTestDir, { recursive: true });

	const errorDiscovery = new MiddlewareDiscovery({
		baseDirectory: errorTestDir,
		filePattern: '_middleware.ts',
		enableWatching: false,
	});

	try {
		// Create middleware file without default export
		await Deno.writeTextFile(join(errorTestDir, '_middleware.ts'), 'export const notDefault = () => {};');

		// The discovery should find the route but fail to load the handler
		const routes = await errorDiscovery.discoverMiddleware();
		assertEquals(routes.length, 1); // Route is discovered

		// But the chain should be empty because the handler can't be loaded
		const chain = await errorDiscovery.buildMiddlewareChain(new URL('http://localhost/'));
		assertEquals(chain.length, 0); // Handler loading fails
	} finally {
		if (existsSync(errorTestDir)) {
			await Deno.remove(errorTestDir, { recursive: true, force: true });
		}
	}
});

Deno.test('Middleware Discovery - Nested middleware structure', async () => {
	const discovery = await setupTestDir();
	try {
		// Create complex nested structure
		await ensureDir(join(testDir, 'pages', 'admin', 'users'), { recursive: true });
		await ensureDir(join(testDir, 'api', 'v1', 'auth'), { recursive: true });

		// Create middleware at different levels
		await Deno.writeTextFile(join(testDir, '_middleware.ts'), sampleMiddleware);
		await Deno.writeTextFile(join(testDir, 'pages', '_middleware.ts'), sampleMiddleware);
		await Deno.writeTextFile(join(testDir, 'pages', 'admin', '_middleware.ts'), sampleMiddleware);
		await Deno.writeTextFile(join(testDir, 'pages', 'admin', 'users', '_middleware.ts'), sampleMiddleware);
		await Deno.writeTextFile(join(testDir, 'api', '_middleware.ts'), sampleMiddleware);
		await Deno.writeTextFile(join(testDir, 'api', 'v1', '_middleware.ts'), sampleMiddleware);
		await Deno.writeTextFile(join(testDir, 'api', 'v1', 'auth', '_middleware.ts'), sampleMiddleware);

		// Test deep page route
		const pageUrl = new URL('http://localhost/admin/users/list');
		const pageChain = await discovery.buildMiddlewareChain(pageUrl);
		assertEquals(pageChain.length, 4); // global + pages + admin + users

		// Test deep API route
		const apiUrl = new URL('http://localhost/api/v1/auth/login');
		const apiChain = await discovery.buildMiddlewareChain(apiUrl);
		assertEquals(apiChain.length, 4); // global + api + v1 + auth
	} finally {
		await cleanupTestDir();
	}
});

Deno.test('Middleware Discovery - Route separation (pages vs API)', async () => {
	const discovery = await setupTestDir();
	try {
		await ensureDir(join(testDir, 'pages'), { recursive: true });
		await ensureDir(join(testDir, 'api'), { recursive: true });

		await Deno.writeTextFile(join(testDir, '_middleware.ts'), sampleMiddleware);
		await Deno.writeTextFile(join(testDir, 'pages', '_middleware.ts'), sampleMiddleware);
		await Deno.writeTextFile(join(testDir, 'api', '_middleware.ts'), sampleMiddleware);

		// Page routes should not include API middleware
		const pageUrl = new URL('http://localhost/dashboard');
		const pageChain = await discovery.buildMiddlewareChain(pageUrl);
		assertEquals(pageChain.length, 2); // global + pages (no API middleware)

		// API routes should not include pages middleware
		const apiUrl = new URL('http://localhost/api/users');
		const apiChain = await discovery.buildMiddlewareChain(apiUrl);
		assertEquals(apiChain.length, 2); // global + api (no pages middleware)
	} finally {
		await cleanupTestDir();
	}
});
