import { assertEquals, assertExists, assert } from 'jsr:@std/assert';
import { join, resolve } from 'node:path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { LayoutDiscovery } from '../src/core/layout/layout-discovery.ts';
import type { LayoutDiscoveryOptions } from '../src/schemas/layout.ts';

const testDir = resolve('./test-layouts');

async function setupTestDir(): Promise<void> {
	if (existsSync(testDir)) {
		rmSync(testDir, { recursive: true, force: true });
	}
	mkdirSync(testDir, { recursive: true });
}

async function cleanupTestDir(layoutDiscovery?: LayoutDiscovery): Promise<void> {
	if (layoutDiscovery) {
		layoutDiscovery.stopWatcher();
	}
	if (existsSync(testDir)) {
		rmSync(testDir, { recursive: true, force: true });
	}
}

Deno.test('LayoutDiscovery - should discover root layout', async () => {
	await setupTestDir();
	let layoutDiscovery: LayoutDiscovery | undefined;

	try {
		// Create root layout
		const pagesDir = join(testDir, 'pages');
		mkdirSync(pagesDir, { recursive: true });
		writeFileSync(
			join(pagesDir, '_layout.tsx'),
			`export default function RootLayout({ children }) {
				return <div className="root-layout">{children}</div>;
			}`
		);

		const options: LayoutDiscoveryOptions = {
			baseDirectory: testDir,
			filePattern: '_layout.tsx',
			excludeDirectories: ['node_modules'],
			enableWatching: false,
			developmentMode: true,
		};

		layoutDiscovery = new LayoutDiscovery(options);
		const layouts = await layoutDiscovery.discoverLayouts('/');

		assertEquals(layouts.length, 1);
		assertEquals(layouts[0].type, 'root');
		assertEquals(layouts[0].priority, 0);
		assertEquals(layouts[0].depth, 0);
	} finally {
		await cleanupTestDir(layoutDiscovery);
	}
});

Deno.test('LayoutDiscovery - should discover nested layouts in correct priority order', async () => {
	await setupTestDir();
	let layoutDiscovery: LayoutDiscovery | undefined;

	try {
		// Create layout hierarchy
		const pagesDir = join(testDir, 'pages');
		mkdirSync(pagesDir, { recursive: true });

		// Root layout
		writeFileSync(
			join(pagesDir, '_layout.tsx'),
			`export default function RootLayout({ children }) { return <div>{children}</div>; }`
		);

		// Blog layout
		const blogDir = join(pagesDir, 'blog');
		mkdirSync(blogDir, { recursive: true });
		writeFileSync(
			join(blogDir, '_layout.tsx'),
			`export default function BlogLayout({ children }) { return <div>{children}</div>; }`
		);

		// Admin layout
		const adminDir = join(pagesDir, 'admin');
		mkdirSync(adminDir, { recursive: true });
		writeFileSync(
			join(adminDir, '_layout.tsx'),
			`export default function AdminLayout({ children }) { return <div>{children}</div>; }`
		);

		const options: LayoutDiscoveryOptions = {
			baseDirectory: testDir,
			filePattern: '_layout.tsx',
			excludeDirectories: ['node_modules'],
			enableWatching: false,
			developmentMode: true,
		};

		layoutDiscovery = new LayoutDiscovery(options);

		// Test blog route
		const blogLayouts = await layoutDiscovery.discoverLayouts('/blog/post');
		assertEquals(blogLayouts.length, 2);
		assertEquals(blogLayouts[0].type, 'root');
		assertEquals(blogLayouts[0].priority, 0);
		assertEquals(blogLayouts[1].type, 'nested');
		assertEquals(blogLayouts[1].priority, 10);
	} finally {
		await cleanupTestDir(layoutDiscovery);
	}
});

Deno.test('LayoutDiscovery - should handle missing layout files gracefully', async () => {
	await setupTestDir();
	let layoutDiscovery: LayoutDiscovery | undefined;

	try {
		const options: LayoutDiscoveryOptions = {
			baseDirectory: testDir,
			filePattern: '_layout.tsx',
			excludeDirectories: ['node_modules'],
			enableWatching: false,
			developmentMode: true,
		};

		layoutDiscovery = new LayoutDiscovery(options);
		const layouts = await layoutDiscovery.discoverLayouts('/nonexistent/path');

		assertEquals(layouts.length, 0);
	} finally {
		await cleanupTestDir(layoutDiscovery);
	}
});

Deno.test('LayoutDiscovery - should cache discovered layouts', async () => {
	await setupTestDir();
	let layoutDiscovery: LayoutDiscovery | undefined;

	try {
		// Create root layout
		const pagesDir = join(testDir, 'pages');
		mkdirSync(pagesDir, { recursive: true });
		writeFileSync(
			join(pagesDir, '_layout.tsx'),
			`export default function RootLayout({ children }) { return <div>{children}</div>; }`
		);

		const options: LayoutDiscoveryOptions = {
			baseDirectory: testDir,
			filePattern: '_layout.tsx',
			excludeDirectories: ['node_modules'],
			enableWatching: false,
			developmentMode: true,
		};

		layoutDiscovery = new LayoutDiscovery(options);

		// First call
		const layouts1 = await layoutDiscovery.discoverLayouts('/');
		assertEquals(layouts1.length, 1);

		// Second call should use cache
		const layouts2 = await layoutDiscovery.discoverLayouts('/');
		assertEquals(layouts2.length, 1);

		// Verify cache stats
		const stats = layoutDiscovery.getCacheStats();
		assert(stats.routeCacheCount > 0);
	} finally {
		await cleanupTestDir(layoutDiscovery);
	}
});
