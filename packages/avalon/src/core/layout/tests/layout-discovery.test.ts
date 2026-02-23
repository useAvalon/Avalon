import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { LayoutDiscovery } from '../layout-discovery.ts';
import type { LayoutDiscoveryOptions } from '../layout-types.ts';

// Test fixtures directory
const TEST_FIXTURES_DIR = resolve('tests/fixtures/layout-discovery');

// Plain JS layout content (no JSX to avoid preact/jsx-dev-runtime at test time)
const ROOT_LAYOUT_CONTENT = `
export default function RootLayout(props) {
	return props.children;
}
export async function layoutLoader(ctx) {
	return { title: 'Root' };
}
`;

const ADMIN_LAYOUT_CONTENT = `
export default function AdminLayout(props) {
	return props.children;
}
`;

async function setupFixtures() {
	if (existsSync(TEST_FIXTURES_DIR)) {
		await rm(TEST_FIXTURES_DIR, { recursive: true });
	}
	await mkdir(TEST_FIXTURES_DIR, { recursive: true });
	// root layout
	await writeFile(join(TEST_FIXTURES_DIR, '_layout.js'), ROOT_LAYOUT_CONTENT);
	// admin layout
	await mkdir(join(TEST_FIXTURES_DIR, 'admin'), { recursive: true });
	await writeFile(join(TEST_FIXTURES_DIR, 'admin', '_layout.js'), ADMIN_LAYOUT_CONTENT);
	// admin/users directory (no layout file)
	await mkdir(join(TEST_FIXTURES_DIR, 'admin', 'users'), { recursive: true });
}

async function cleanupFixtures() {
	if (existsSync(TEST_FIXTURES_DIR)) {
		await rm(TEST_FIXTURES_DIR, { recursive: true });
	}
}

function makeDiscovery(overrides: Partial<LayoutDiscoveryOptions> = {}): LayoutDiscovery {
	return new LayoutDiscovery({
		baseDirectory: TEST_FIXTURES_DIR,
		filePattern: '_layout.js',
		developmentMode: false,
		...overrides,
	});
}

describe('LayoutDiscovery - constructor and options', () => {
	it('should expose options via getOptions()', () => {
		const discovery = makeDiscovery({ developmentMode: true });
		const opts = discovery.getOptions();
		expect(opts.filePattern).toEqual('_layout.js');
		expect(opts.developmentMode).toEqual(true);
	});

	it('should default filePattern to _layout.tsx when not provided', () => {
		const discovery = new LayoutDiscovery({ baseDirectory: TEST_FIXTURES_DIR });
		const opts = discovery.getOptions();
		expect(opts.filePattern).toEqual('_layout.tsx');
	});
});

describe('LayoutDiscovery - discoverLayouts', () => {
	beforeEach(setupFixtures);
	afterEach(cleanupFixtures);

	it('should find root layout for root path', async () => {
		const discovery = makeDiscovery();
		const routes = await discovery.discoverLayouts('/');
		expect(routes.length >= 1).toEqual(true);
		const rootRoute = routes.find(r => r.type === 'root');
		expect(rootRoute).toBeDefined();
	});

	it('should find root and admin layouts for /admin path', async () => {
		const discovery = makeDiscovery();
		const routes = await discovery.discoverLayouts('/admin');
		const types = new Set(routes.map(r => r.type));
		expect(types.has('root')).toEqual(true);
		expect(types.has('nested')).toEqual(true);
	});

	it('should find root and admin layouts for deep /admin/users path', async () => {
		const discovery = makeDiscovery();
		const routes = await discovery.discoverLayouts('/admin/users');
		// admin/users has no layout file, so only root + admin
		expect(routes.length).toEqual(2);
	});

	it('should return empty array for path with no layouts', async () => {
		const discovery = makeDiscovery();
		// Remove root layout to test empty case
		await rm(join(TEST_FIXTURES_DIR, '_layout.js'));
		await rm(join(TEST_FIXTURES_DIR, 'admin', '_layout.js'));
		const routes = await discovery.discoverLayouts('/some/unknown/path');
		expect(routes.length).toEqual(0);
	});

	it('should sort routes by priority (root first)', async () => {
		const discovery = makeDiscovery();
		const routes = await discovery.discoverLayouts('/admin');
		expect(routes[0].priority <= routes.at(-1)!.priority).toEqual(true);
	});

	it('should cache results on repeated calls', async () => {
		const discovery = makeDiscovery();
		const routes1 = await discovery.discoverLayouts('/admin');
		const routes2 = await discovery.discoverLayouts('/admin');
		expect(routes1).toBe(routes2); // same reference from cache
	});

	it('should assign depth 0 to root layout', async () => {
		const discovery = makeDiscovery();
		const routes = await discovery.discoverLayouts('/admin');
		const root = routes.find(r => r.type === 'root');
		expect(root?.depth).toEqual(0);
	});

	it('should assign correct depth to nested layouts', async () => {
		const discovery = makeDiscovery();
		const routes = await discovery.discoverLayouts('/admin');
		const nested = routes.find(r => r.type === 'nested');
		expect(nested?.depth).toEqual(1);
	});
});

describe('LayoutDiscovery - cache management', () => {
	beforeEach(setupFixtures);
	afterEach(cleanupFixtures);

	it('should report cache stats', async () => {
		const discovery = makeDiscovery();
		await discovery.discoverLayouts('/admin');
		const stats = discovery.getCacheStats();
		expect(stats.routeCacheCount >= 1).toEqual(true);
	});

	it('should clear all caches', async () => {
		const discovery = makeDiscovery();
		await discovery.discoverLayouts('/admin');
		discovery.clearCache();
		const stats = discovery.getCacheStats();
		expect(stats.layoutCount).toEqual(0);
		expect(stats.routeCacheCount).toEqual(0);
	});

	it('should clear layout cache for specific file', async () => {
		const discovery = makeDiscovery();
		await discovery.buildLayoutChain(new URL('http://localhost/admin'));
		const filePath = join(TEST_FIXTURES_DIR, '_layout.js');
		discovery.clearLayoutCache(filePath);
		// route cache should also be cleared
		const stats = discovery.getCacheStats();
		expect(stats.routeCacheCount).toEqual(0);
	});
});

describe('LayoutDiscovery - buildLayoutChain', () => {
	beforeEach(setupFixtures);
	afterEach(cleanupFixtures);

	it('should return an array of handlers', async () => {
		const discovery = makeDiscovery();
		const chain = await discovery.buildLayoutChain(new URL('http://localhost/admin'));
		expect(Array.isArray(chain)).toEqual(true);
	});

	it('should load root layout handler for root URL', async () => {
		const discovery = makeDiscovery();
		const chain = await discovery.buildLayoutChain(new URL('http://localhost/'));
		expect(chain.length >= 1).toEqual(true);
		expect(typeof chain[0].component).toEqual('function');
	});

	it('should include loader when layout exports layoutLoader', async () => {
		const discovery = makeDiscovery();
		const chain = await discovery.buildLayoutChain(new URL('http://localhost/'));
		const rootHandler = chain[0];
		expect(rootHandler.loader).toBeDefined();
	});

	it('should not include loader when layout has no layoutLoader export', async () => {
		const discovery = makeDiscovery();
		const chain = await discovery.buildLayoutChain(new URL('http://localhost/admin'));
		const adminHandler = chain.find(h => h.path.includes('admin'));
		expect(adminHandler?.loader).toBeUndefined();
	});
});

describe('LayoutDiscovery - buildLayoutChainWithData', () => {
	beforeEach(setupFixtures);
	afterEach(cleanupFixtures);

	it('should return handlers, data, and errors', async () => {
		const discovery = makeDiscovery();
		const ctx = {
			request: new Request('http://localhost/'),
			params: {},
			query: new URLSearchParams(),
			state: new Map<string, unknown>(),
		};
		const result = await discovery.buildLayoutChainWithData(new URL('http://localhost/'), ctx);
		expect(Array.isArray(result.handlers)).toEqual(true);
		expect(Array.isArray(result.data)).toEqual(true);
		expect(Array.isArray(result.errors)).toEqual(true);
	});

	it('should return data entry for each handler', async () => {
		const discovery = makeDiscovery();
		const ctx = {
			request: new Request('http://localhost/admin'),
			params: {},
			query: new URLSearchParams(),
			state: new Map<string, unknown>(),
		};
		const result = await discovery.buildLayoutChainWithData(new URL('http://localhost/admin'), ctx);
		expect(result.data.length).toEqual(result.handlers.length);
	});

	it('should populate data from layoutLoader', async () => {
		const discovery = makeDiscovery();
		const ctx = {
			request: new Request('http://localhost/'),
			params: {},
			query: new URLSearchParams(),
			state: new Map<string, unknown>(),
		};
		const result = await discovery.buildLayoutChainWithData(new URL('http://localhost/'), ctx);
		const rootData = result.data[0];
		expect(rootData).toBeDefined();
		expect((rootData as Record<string, unknown>).title).toEqual('Root');
	});

	it('should return empty errors array on success', async () => {
		const discovery = makeDiscovery();
		const ctx = {
			request: new Request('http://localhost/'),
			params: {},
			query: new URLSearchParams(),
			state: new Map<string, unknown>(),
		};
		const result = await discovery.buildLayoutChainWithData(new URL('http://localhost/'), ctx);
		expect(result.errors.length).toEqual(0);
	});
});
