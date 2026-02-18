import { describe, it, expect } from 'vitest';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { ensureDir } from '../packages/avalon/src/utils/fs.ts';
import { MiddlewareDiscovery } from '../packages/avalon/src/core/middleware/middleware-discovery.ts';

const testDir = resolve('./test-middleware-temp');
const sampleMiddleware = `export default async function middleware(context, next) { return await next(); }`;

async function setupTestDir(): Promise<MiddlewareDiscovery> {
	if (existsSync(testDir)) {
		await rm(testDir, { recursive: true });
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
		await rm(testDir, { recursive: true });
	}
}

describe('Middleware Discovery', () => {
	it('should discover global middleware', async () => {
		const discovery = await setupTestDir();
		try {
			await writeFile(join(testDir, '_middleware.ts'), sampleMiddleware);
			const routes = await discovery.discoverMiddleware();
			expect(routes.length).toEqual(1);
			expect(routes[0].type).toEqual('global');
			expect(routes[0].priority).toEqual(0);
		} finally {
			await cleanupTestDir();
		}
	});

	it('should discover page middleware', async () => {
		const discovery = await setupTestDir();
		try {
			await ensureDir(join(testDir, 'pages'));
			await writeFile(join(testDir, 'pages', '_middleware.ts'), sampleMiddleware);
			const routes = await discovery.discoverMiddleware();
			expect(routes.length).toEqual(1);
			expect(routes[0].type).toEqual('pages');
			expect(routes[0].priority).toEqual(11);
		} finally {
			await cleanupTestDir();
		}
	});

	it('should discover API middleware', async () => {
		const discovery = await setupTestDir();
		try {
			await ensureDir(join(testDir, 'api'));
			await writeFile(join(testDir, 'api', '_middleware.ts'), sampleMiddleware);
			const routes = await discovery.discoverMiddleware();
			expect(routes.length).toEqual(1);
			expect(routes[0].type).toEqual('api');
			expect(routes[0].priority).toEqual(11);
		} finally {
			await cleanupTestDir();
		}
	});
});

describe('Middleware Chain Building - Hierarchical resolution', () => {
	it('should resolve nested page and API routes', async () => {
		const discovery = await setupTestDir();
		try {
			await ensureDir(join(testDir, 'pages', 'admin'));
			await ensureDir(join(testDir, 'api', 'auth'));

			await writeFile(join(testDir, '_middleware.ts'), sampleMiddleware);
			await writeFile(join(testDir, 'pages', '_middleware.ts'), sampleMiddleware);
			await writeFile(join(testDir, 'pages', 'admin', '_middleware.ts'), sampleMiddleware);
			await writeFile(join(testDir, 'api', '_middleware.ts'), sampleMiddleware);
			await writeFile(join(testDir, 'api', 'auth', '_middleware.ts'), sampleMiddleware);

			// Test nested page route
			const pageUrl = new URL('http://localhost/admin/dashboard');
			const pageChain = await discovery.buildMiddlewareChain(pageUrl);
			expect(pageChain.length).toEqual(3); // global + pages + admin

			// Test nested API route
			const apiUrl = new URL('http://localhost/api/auth/login');
			const apiChain = await discovery.buildMiddlewareChain(apiUrl);
			expect(apiChain.length).toEqual(3); // global + api + auth
		} finally {
			await cleanupTestDir();
		}
	});
});

describe('Middleware Discovery - URL pattern matching', () => {
	it('should match URL patterns correctly', async () => {
		const discovery = await setupTestDir();
		try {
			await writeFile(join(testDir, '_middleware.ts'), sampleMiddleware);
			const routes = await discovery.discoverMiddleware();
			const globalRoute = routes.find(r => r.type === 'global');
			expect(globalRoute).toBeDefined();
			expect(globalRoute!.pattern.test(new URL('http://localhost/'))).toEqual(true);
			expect(globalRoute!.pattern.test(new URL('http://localhost/any/path'))).toEqual(true);
		} finally {
			await cleanupTestDir();
		}
	});
});

describe('Middleware Discovery - Caching functionality', () => {
	it('should cache discovered middleware', async () => {
		const discovery = await setupTestDir();
		try {
			await writeFile(join(testDir, '_middleware.ts'), sampleMiddleware);
			const routes1 = await discovery.discoverMiddleware();
			const routes2 = await discovery.discoverMiddleware();
			expect(routes1.length).toEqual(routes2.length);
			expect(discovery.getCacheStats().routeCacheCount).toEqual(1);

			discovery.clearCache();
			expect(discovery.getCacheStats().routeCacheCount).toEqual(0);
		} finally {
			await cleanupTestDir();
		}
	});
});

describe('Middleware Discovery - Error handling', () => {
	it('should handle middleware without default export', async () => {
		const errorTestDir = resolve('./test-middleware-error-temp');

		if (existsSync(errorTestDir)) {
			await rm(errorTestDir, { recursive: true });
		}
		await ensureDir(errorTestDir);

		const errorDiscovery = new MiddlewareDiscovery({
			baseDirectory: errorTestDir,
			filePattern: '_middleware.ts',
			enableWatching: false,
		});

		try {
			await writeFile(join(errorTestDir, '_middleware.ts'), 'export const notDefault = () => {};');

			const routes = await errorDiscovery.discoverMiddleware();
			expect(routes.length).toEqual(1);

			const chain = await errorDiscovery.buildMiddlewareChain(new URL('http://localhost/'));
			expect(chain.length).toEqual(0);
		} finally {
			if (existsSync(errorTestDir)) {
				await rm(errorTestDir, { recursive: true });
			}
		}
	});
});

describe('Middleware Discovery - Nested middleware structure', () => {
	it('should handle deeply nested middleware', async () => {
		const discovery = await setupTestDir();
		try {
			await ensureDir(join(testDir, 'pages', 'admin', 'users'));
			await ensureDir(join(testDir, 'api', 'v1', 'auth'));

			await writeFile(join(testDir, '_middleware.ts'), sampleMiddleware);
			await writeFile(join(testDir, 'pages', '_middleware.ts'), sampleMiddleware);
			await writeFile(join(testDir, 'pages', 'admin', '_middleware.ts'), sampleMiddleware);
			await writeFile(join(testDir, 'pages', 'admin', 'users', '_middleware.ts'), sampleMiddleware);
			await writeFile(join(testDir, 'api', '_middleware.ts'), sampleMiddleware);
			await writeFile(join(testDir, 'api', 'v1', '_middleware.ts'), sampleMiddleware);
			await writeFile(join(testDir, 'api', 'v1', 'auth', '_middleware.ts'), sampleMiddleware);

			const pageUrl = new URL('http://localhost/admin/users/list');
			const pageChain = await discovery.buildMiddlewareChain(pageUrl);
			expect(pageChain.length).toEqual(4); // global + pages + admin + users

			const apiUrl = new URL('http://localhost/api/v1/auth/login');
			const apiChain = await discovery.buildMiddlewareChain(apiUrl);
			expect(apiChain.length).toEqual(4); // global + api + v1 + auth
		} finally {
			await cleanupTestDir();
		}
	});
});

describe('Middleware Discovery - Route separation (pages vs API)', () => {
	it('should separate page and API middleware chains', async () => {
		const discovery = await setupTestDir();
		try {
			await ensureDir(join(testDir, 'pages'));
			await ensureDir(join(testDir, 'api'));

			await writeFile(join(testDir, '_middleware.ts'), sampleMiddleware);
			await writeFile(join(testDir, 'pages', '_middleware.ts'), sampleMiddleware);
			await writeFile(join(testDir, 'api', '_middleware.ts'), sampleMiddleware);

			const pageUrl = new URL('http://localhost/dashboard');
			const pageChain = await discovery.buildMiddlewareChain(pageUrl);
			expect(pageChain.length).toEqual(2); // global + pages (no API middleware)

			const apiUrl = new URL('http://localhost/api/users');
			const apiChain = await discovery.buildMiddlewareChain(apiUrl);
			expect(apiChain.length).toEqual(2); // global + api (no pages middleware)
		} finally {
			await cleanupTestDir();
		}
	});
});
