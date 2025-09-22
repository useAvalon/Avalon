import { assertEquals, assertExists, assert } from 'jsr:@std/assert';
import { join } from 'node:path';
import { existsSync } from '@std/fs';
import { ensureDir } from '@std/fs';
import { MiddlewareDiscovery } from '../src/core/middleware/middleware-discovery.ts';
import type { MiddlewareWatcherCallback } from '../src/schemas/middleware.ts';

/**
 * Simplified tests for middleware hot reloading functionality
 * Requirements: 5.4
 */

// Test directory setup
const testDir = join(Deno.cwd(), 'tests', 'fixtures', 'hot-reload-simple-test');

async function setupTestDirectory(): Promise<void> {
	// Clean up any existing test directory
	if (existsSync(testDir)) {
		await Deno.remove(testDir, { recursive: true, force: true });
	}

	// Create test directory structure
	await ensureDir(testDir, { recursive: true });
}

async function cleanupTestDirectory(): Promise<void> {
	if (existsSync(testDir)) {
		await Deno.remove(testDir, { recursive: true, force: true });
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

Deno.test('Middleware Hot Reload - Watch Mode', async () => {
	await setupTestDirectory();

	const discovery = new MiddlewareDiscovery({
		baseDirectory: testDir,
		filePattern: '_middleware.ts',
		enableWatching: true,
		developmentMode: true,
	});

	try {
		assert(discovery.isWatchModeEnabled(), 'Watch mode should be enabled');

		// Give the watcher a moment to start
		await new Promise(resolve => setTimeout(resolve, 200));

		assert(discovery.isWatcherActive(), 'File watcher should be active');
	} finally {
		discovery.stopWatcher();
		await cleanupTestDirectory();
	}
});

Deno.test('Middleware Hot Reload - File Detection', async () => {
	await setupTestDirectory();

	const discovery = new MiddlewareDiscovery({
		baseDirectory: testDir,
		filePattern: '_middleware.ts',
		enableWatching: true,
		developmentMode: true,
	});

	const watchEvents: Array<{ filePath: string; event: string }> = [];

	try {
		// Set up watcher callback
		const callback: MiddlewareWatcherCallback = (filePath, event) => {
			watchEvents.push({ filePath, event });
		};
		discovery.setWatcherCallback(callback);

		// Give the watcher time to start
		await new Promise(resolve => setTimeout(resolve, 200));

		// Create a new middleware file
		const middlewarePath = join(testDir, '_middleware.ts');
		await Deno.writeTextFile(middlewarePath, createTestMiddleware('global'));

		// Wait for file system event to be processed
		await new Promise(resolve => setTimeout(resolve, 500));

		// Check that the event was detected
		const addEvent = watchEvents.find(e => e.event === 'add' && e.filePath === middlewarePath);
		assertExists(addEvent, 'Should detect new middleware file creation');
	} finally {
		discovery.stopWatcher();
		await cleanupTestDirectory();
	}
});

Deno.test('Middleware Hot Reload - Cache Invalidation', async () => {
	await setupTestDirectory();

	const discovery = new MiddlewareDiscovery({
		baseDirectory: testDir,
		filePattern: '_middleware.ts',
		enableWatching: true,
		developmentMode: true,
	});

	try {
		// Create initial middleware file
		const middlewarePath = join(testDir, '_middleware.ts');
		await Deno.writeTextFile(middlewarePath, createTestMiddleware('global'));

		// Give the watcher time to start
		await new Promise(resolve => setTimeout(resolve, 200));

		// Load middleware to populate cache
		const initialChain = await discovery.buildMiddlewareChain(new URL('http://localhost/test'));
		assertEquals(initialChain.length, 1, 'Should load initial middleware');

		// Check cache stats
		const initialStats = discovery.getCacheStats();
		assertEquals(initialStats.middlewareCount, 1, 'Should have cached middleware');

		// Modify the middleware file
		await Deno.writeTextFile(middlewarePath, createTestMiddleware('globalModified'));

		// Wait for file system event and cache invalidation
		await new Promise(resolve => setTimeout(resolve, 500));

		// Middleware should still be loadable after change
		const newChain = await discovery.buildMiddlewareChain(new URL('http://localhost/test'));
		assertEquals(newChain.length, 1, 'Should still load middleware after change');
	} finally {
		discovery.stopWatcher();
		await cleanupTestDirectory();
	}
});

Deno.test('Middleware Hot Reload - Invalid Files', async () => {
	await setupTestDirectory();

	const discovery = new MiddlewareDiscovery({
		baseDirectory: testDir,
		filePattern: '_middleware.ts',
		enableWatching: true,
		developmentMode: true,
	});

	try {
		// Create invalid middleware file (missing default export)
		const middlewarePath = join(testDir, '_middleware.ts');
		await Deno.writeTextFile(middlewarePath, 'export const notDefault = () => {};');

		// Give the watcher time to start
		await new Promise(resolve => setTimeout(resolve, 200));

		// Try to build middleware chain
		const chain = await discovery.buildMiddlewareChain(new URL('http://localhost/test'));
		assertEquals(chain.length, 0, 'Should not include invalid middleware in chain');
	} finally {
		discovery.stopWatcher();
		await cleanupTestDirectory();
	}
});

Deno.test('Middleware Hot Reload - Non-existent Directory', async () => {
	const nonExistentDir = join(testDir, 'non-existent');

	const discovery = new MiddlewareDiscovery({
		baseDirectory: nonExistentDir,
		filePattern: '_middleware.ts',
		enableWatching: true,
		developmentMode: true,
	});

	try {
		// Should not crash when trying to watch non-existent directory
		await new Promise(resolve => setTimeout(resolve, 200));

		// Discovery should still be functional for other operations
		assert(discovery.isWatchModeEnabled(), 'Watch mode should still be enabled');
		assert(!discovery.isWatcherActive(), 'Watcher should not be active for non-existent directory');
	} finally {
		discovery.stopWatcher();
	}
});

Deno.test('Middleware Hot Reload - Callback Management', async () => {
	await setupTestDirectory();

	const discovery = new MiddlewareDiscovery({
		baseDirectory: testDir,
		filePattern: '_middleware.ts',
		enableWatching: true,
		developmentMode: true,
	});

	const watchEvents: Array<{ filePath: string; event: string }> = [];

	try {
		// Set up watcher callback
		const callback: MiddlewareWatcherCallback = (filePath, event) => {
			watchEvents.push({ filePath, event });
		};
		discovery.setWatcherCallback(callback);

		// Give the watcher time to start
		await new Promise(resolve => setTimeout(resolve, 200));

		// Create a middleware file
		const middlewarePath = join(testDir, '_middleware.ts');
		await Deno.writeTextFile(middlewarePath, createTestMiddleware('global'));

		// Wait for event
		await new Promise(resolve => setTimeout(resolve, 500));

		assert(watchEvents.length > 0, 'Should receive callback with callback set');

		// Remove callback
		discovery.removeWatcherCallback();
		const eventCountBeforeRemoval = watchEvents.length;

		// Modify the file
		await Deno.writeTextFile(middlewarePath, createTestMiddleware('globalModified'));

		// Wait for potential event
		await new Promise(resolve => setTimeout(resolve, 500));

		assertEquals(watchEvents.length, eventCountBeforeRemoval, 'Should not receive new callbacks after removal');
	} finally {
		discovery.stopWatcher();
		await cleanupTestDirectory();
	}
});
