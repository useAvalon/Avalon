import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { ensureDir } from '../packages/avalon/src/utils/fs.ts';
import { MiddlewareDiscovery } from '../packages/avalon/src/core/middleware/middleware-discovery.ts';
import type { MiddlewareWatcherCallback } from '../packages/avalon/src/schemas/middleware.ts';

/**
 * Simplified tests for middleware hot reloading functionality
 * Requirements: 5.4
 */

// Test directory setup
const testDir = join(process.cwd(), 'tests', 'fixtures', 'hot-reload-simple-test');

async function setupTestDirectory(): Promise<void> {
	if (existsSync(testDir)) {
		await rm(testDir, { recursive: true });
	}
	await ensureDir(testDir);
}

async function cleanupTestDirectory(): Promise<void> {
	if (existsSync(testDir)) {
		await rm(testDir, { recursive: true });
	}
}

function createTestMiddleware(name: string): string {
	return `
export default async function ${name}Middleware(context, next) {
	context.locals.${name} = true;
	return await next();
}
`;
}

describe('Middleware Hot Reload', () => {
	it('should enable watch mode', async () => {
		await setupTestDirectory();

		const discovery = new MiddlewareDiscovery({
			baseDirectory: testDir,
			filePattern: '_middleware.ts',
			enableWatching: true,
			developmentMode: true,
		});

		try {
			expect(discovery.isWatchModeEnabled()).toEqual(true);

			await new Promise(resolve => setTimeout(resolve, 200));

			expect(discovery.isWatcherActive()).toEqual(true);
		} finally {
			discovery.stopWatcher();
			await cleanupTestDirectory();
		}
	});

	it('should detect new middleware files', async () => {
		await setupTestDirectory();

		const discovery = new MiddlewareDiscovery({
			baseDirectory: testDir,
			filePattern: '_middleware.ts',
			enableWatching: true,
			developmentMode: true,
		});

		const watchEvents: Array<{ filePath: string; event: string }> = [];

		try {
			const callback: MiddlewareWatcherCallback = (filePath, event) => {
				watchEvents.push({ filePath, event });
			};
			discovery.setWatcherCallback(callback);

			await new Promise(resolve => setTimeout(resolve, 200));

			const middlewarePath = join(testDir, '_middleware.ts');
			await writeFile(middlewarePath, createTestMiddleware('global'));

			await new Promise(resolve => setTimeout(resolve, 500));

			const addEvent = watchEvents.find(e => e.event === 'add' && e.filePath === middlewarePath);
			expect(addEvent).toBeDefined();
		} finally {
			discovery.stopWatcher();
			await cleanupTestDirectory();
		}
	});

	it('should invalidate cache on file changes', async () => {
		await setupTestDirectory();

		const discovery = new MiddlewareDiscovery({
			baseDirectory: testDir,
			filePattern: '_middleware.ts',
			enableWatching: true,
			developmentMode: true,
		});

		try {
			const middlewarePath = join(testDir, '_middleware.ts');
			await writeFile(middlewarePath, createTestMiddleware('global'));

			await new Promise(resolve => setTimeout(resolve, 200));

			const initialChain = await discovery.buildMiddlewareChain(new URL('http://localhost/test'));
			expect(initialChain.length).toEqual(1);

			const initialStats = discovery.getCacheStats();
			expect(initialStats.middlewareCount).toEqual(1);

			await writeFile(middlewarePath, createTestMiddleware('globalModified'));

			await new Promise(resolve => setTimeout(resolve, 500));

			const newChain = await discovery.buildMiddlewareChain(new URL('http://localhost/test'));
			expect(newChain.length).toEqual(1);
		} finally {
			discovery.stopWatcher();
			await cleanupTestDirectory();
		}
	});

	it('should handle invalid middleware files', async () => {
		await setupTestDirectory();

		const discovery = new MiddlewareDiscovery({
			baseDirectory: testDir,
			filePattern: '_middleware.ts',
			enableWatching: true,
			developmentMode: true,
		});

		try {
			const middlewarePath = join(testDir, '_middleware.ts');
			await writeFile(middlewarePath, 'export const notDefault = () => {};');

			await new Promise(resolve => setTimeout(resolve, 200));

			const chain = await discovery.buildMiddlewareChain(new URL('http://localhost/test'));
			expect(chain.length).toEqual(0);
		} finally {
			discovery.stopWatcher();
			await cleanupTestDirectory();
		}
	});

	it('should handle non-existent directory', async () => {
		const nonExistentDir = join(testDir, 'non-existent');

		const discovery = new MiddlewareDiscovery({
			baseDirectory: nonExistentDir,
			filePattern: '_middleware.ts',
			enableWatching: true,
			developmentMode: true,
		});

		try {
			await new Promise(resolve => setTimeout(resolve, 200));

			expect(discovery.isWatchModeEnabled()).toEqual(true);
			expect(discovery.isWatcherActive()).toEqual(false);
		} finally {
			discovery.stopWatcher();
		}
	});

	it('should manage watcher callbacks', async () => {
		await setupTestDirectory();

		const discovery = new MiddlewareDiscovery({
			baseDirectory: testDir,
			filePattern: '_middleware.ts',
			enableWatching: true,
			developmentMode: true,
		});

		const watchEvents: Array<{ filePath: string; event: string }> = [];

		try {
			const callback: MiddlewareWatcherCallback = (filePath, event) => {
				watchEvents.push({ filePath, event });
			};
			discovery.setWatcherCallback(callback);

			await new Promise(resolve => setTimeout(resolve, 200));

			const middlewarePath = join(testDir, '_middleware.ts');
			await writeFile(middlewarePath, createTestMiddleware('global'));

			await new Promise(resolve => setTimeout(resolve, 500));

			expect(watchEvents.length > 0).toEqual(true);

			discovery.removeWatcherCallback();
			const eventCountBeforeRemoval = watchEvents.length;

			await writeFile(middlewarePath, createTestMiddleware('globalModified'));

			await new Promise(resolve => setTimeout(resolve, 500));

			expect(watchEvents.length).toEqual(eventCountBeforeRemoval);
		} finally {
			discovery.stopWatcher();
			await cleanupTestDirectory();
		}
	});
});
