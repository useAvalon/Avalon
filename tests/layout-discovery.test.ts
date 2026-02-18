import { describe, it, expect } from 'vitest';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { ensureDir } from '../packages/avalon/src/utils/fs.ts';
import { LayoutDiscovery } from '../packages/avalon/src/core/layout/layout-discovery.ts';
import type { LayoutDiscoveryOptions } from '../packages/avalon/src/schemas/layout.ts';

const testDir = resolve('./test-layouts');

async function setupTestDir(): Promise<void> {
	if (existsSync(testDir)) {
		await rm(testDir, { recursive: true });
	}
	await ensureDir(testDir);
}

async function cleanupTestDir(layoutDiscovery?: LayoutDiscovery): Promise<void> {
	if (layoutDiscovery) {
		layoutDiscovery.stopWatcher();
	}
	if (existsSync(testDir)) {
		await rm(testDir, { recursive: true });
	}
}

describe('LayoutDiscovery', () => {
	it('should discover root layout', async () => {
		await setupTestDir();
		let layoutDiscovery: LayoutDiscovery | undefined;

		try {
			// Create root layout
			const pagesDir = join(testDir, 'pages');
			await ensureDir(pagesDir);
			await writeFile(
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

			expect(layouts.length).toEqual(1);
			expect(layouts[0].type).toEqual('root');
			expect(layouts[0].priority).toEqual(0);
			expect(layouts[0].depth).toEqual(0);
		} finally {
			await cleanupTestDir(layoutDiscovery);
		}
	});

	it('should discover nested layouts in correct priority order', async () => {
		await setupTestDir();
		let layoutDiscovery: LayoutDiscovery | undefined;

		try {
			// Create layout hierarchy
			const pagesDir = join(testDir, 'pages');
			await ensureDir(pagesDir);

			// Root layout
			await writeFile(
				join(pagesDir, '_layout.tsx'),
				`export default function RootLayout({ children }) { return <div>{children}</div>; }`
			);

			// Blog layout
			const blogDir = join(pagesDir, 'blog');
			await ensureDir(blogDir);
			await writeFile(
				join(blogDir, '_layout.tsx'),
				`export default function BlogLayout({ children }) { return <div>{children}</div>; }`
			);

			// Admin layout
			const adminDir = join(pagesDir, 'admin');
			await ensureDir(adminDir);
			await writeFile(
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
			expect(blogLayouts.length).toEqual(2);
			expect(blogLayouts[0].type).toEqual('root');
			expect(blogLayouts[0].priority).toEqual(0);
			expect(blogLayouts[1].type).toEqual('nested');
			expect(blogLayouts[1].priority).toEqual(10);
		} finally {
			await cleanupTestDir(layoutDiscovery);
		}
	});

	it('should handle missing layout files gracefully', async () => {
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

			expect(layouts.length).toEqual(0);
		} finally {
			await cleanupTestDir(layoutDiscovery);
		}
	});

	it('should cache discovered layouts', async () => {
		await setupTestDir();
		let layoutDiscovery: LayoutDiscovery | undefined;

		try {
			// Create root layout
			const pagesDir = join(testDir, 'pages');
			await ensureDir(pagesDir);
			await writeFile(
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
			expect(layouts1.length).toEqual(1);

			// Second call should use cache
			const layouts2 = await layoutDiscovery.discoverLayouts('/');
			expect(layouts2.length).toEqual(1);

			// Verify cache stats
			const stats = layoutDiscovery.getCacheStats();
			expect(stats.routeCacheCount > 0).toBeTruthy();
		} finally {
			await cleanupTestDir(layoutDiscovery);
		}
	});
});
