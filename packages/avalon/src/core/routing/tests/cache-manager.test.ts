/**
 * Tests for the cache manager and performance optimization features
 */

import { assertEquals, assertExists, assertNotEquals } from '@std/assert';
import { CacheManager, RouteCache, MetadataCache, CachePerformanceMonitor, type CacheStats } from '../cache-manager.ts';
import type { FileSystemRoute, ResolvedMetadata, RouteParams } from '../../../schemas/routing.ts';

Deno.test('CacheManager - Basic Operations', async t => {
	await t.step('should store and retrieve data', () => {
		const cache = new CacheManager();
		const testData = { message: 'Hello, World!' };

		cache.set('test-key', testData);
		const retrieved = cache.get('test-key');

		assertEquals(retrieved, testData);
	});

	await t.step('should return null for non-existent keys', () => {
		const cache = new CacheManager();
		const result = cache.get('non-existent');

		assertEquals(result, null);
	});

	await t.step('should respect TTL', async () => {
		const cache = new CacheManager();
		const testData = { message: 'Hello, World!' };

		cache.set('test-key', testData, { ttl: 100 }); // 100ms TTL

		// Should be available immediately
		assertEquals(cache.get('test-key'), testData);

		// Wait for TTL to expire
		await new Promise(resolve => setTimeout(resolve, 150));

		// Should be null after TTL
		assertEquals(cache.get('test-key'), null);
	});

	await t.step('should handle dependencies', () => {
		const cache = new CacheManager();
		const testData = { message: 'Hello, World!' };
		const dependencies = ['/path/to/file1.ts', '/path/to/file2.ts'];

		cache.set('test-key', testData, { dependencies });

		// Should be able to retrieve normally
		assertEquals(cache.get('test-key'), testData);

		// Should invalidate when dependency changes
		const invalidated = cache.invalidateByFile('/path/to/file1.ts');
		assertEquals(invalidated, ['test-key']);

		// Should be null after invalidation
		assertEquals(cache.get('test-key'), null);
	});
});

Deno.test('CacheManager - Memory Management', async t => {
	await t.step('should evict entries when memory limit is reached', () => {
		const cache = new CacheManager({
			maxMemoryUsage: 1024, // 1KB limit
			maxEntries: 10,
		});

		// Add entries that exceed memory limit
		for (let i = 0; i < 20; i++) {
			const largeData = { data: 'x'.repeat(100) }; // ~100 bytes each
			cache.set(`key-${i}`, largeData);
		}

		const stats = cache.getStats();

		// Should have evicted some entries
		assertEquals(stats.totalEntries < 20, true);
		assertEquals(stats.evictionCount > 0, true);
	});

	await t.step('should evict entries when entry limit is reached', () => {
		const cache = new CacheManager({
			maxEntries: 5,
			enableLRU: true,
		});

		// Add more entries than the limit
		for (let i = 0; i < 10; i++) {
			cache.set(`key-${i}`, { value: i });
		}

		const stats = cache.getStats();

		// Should not exceed entry limit
		assertEquals(stats.totalEntries <= 5, true);
		assertEquals(stats.evictionCount > 0, true);
	});

	await t.step('should cleanup expired entries', async () => {
		const cache = new CacheManager();

		// Add entries with short TTL
		cache.set('key1', { data: 'test1' }, { ttl: 50 });
		cache.set('key2', { data: 'test2' }, { ttl: 100 });
		cache.set('key3', { data: 'test3' }, { ttl: 200 });

		// Wait for some to expire
		await new Promise(resolve => setTimeout(resolve, 75));

		const cleanedCount = cache.cleanup();

		// Should have cleaned up at least one expired entry
		assertEquals(cleanedCount >= 1, true);
	});
});

Deno.test('RouteCache - Specialized Operations', async t => {
	await t.step('should cache routes with file dependencies', () => {
		const routeCache = new RouteCache();
		const routes: FileSystemRoute[] = [
			{
				pattern: new URLPattern({ pathname: '/test' }),
				filePath: '/pages/test.tsx',
				routeType: 'static',
				dynamicSegments: [],
				priority: 0,
				isPrivate: false,
			},
		];
		const pageFiles = [
			{
				filePath: '/pages/test.tsx',
				relativePath: 'test.tsx',
				extension: '.tsx',
				isPrivate: false,
				mtime: Date.now(),
			},
		];

		routeCache.setRoutes('test-routes', routes, pageFiles);
		const retrieved = routeCache.getRoutes('test-routes');

		assertEquals(retrieved, routes);
	});

	await t.step('should invalidate routes when files change', () => {
		const routeCache = new RouteCache();
		const routes: FileSystemRoute[] = [
			{
				pattern: new URLPattern({ pathname: '/test' }),
				filePath: '/pages/test.tsx',
				routeType: 'static',
				dynamicSegments: [],
				priority: 0,
				isPrivate: false,
			},
		];
		const pageFiles = [
			{
				filePath: '/pages/test.tsx',
				relativePath: 'test.tsx',
				extension: '.tsx',
				isPrivate: false,
				mtime: Date.now(),
			},
		];

		routeCache.setRoutes('test-routes', routes, pageFiles);

		// Should be available
		assertEquals(routeCache.getRoutes('test-routes'), routes);

		// Invalidate by file
		const invalidated = routeCache.invalidateByFile('/pages/test.tsx');
		assertEquals(invalidated.length > 0, true);

		// Should be null after invalidation
		assertEquals(routeCache.getRoutes('test-routes'), null);
	});
});

Deno.test('MetadataCache - Specialized Operations', async t => {
	await t.step('should cache metadata with route parameters', () => {
		const metadataCache = new MetadataCache();
		const metadata: ResolvedMetadata = {
			title: 'Test Page',
			description: 'A test page',
			sources: ['page'],
			resolvedAt: Date.now(),
		};
		const params: RouteParams = { slug: 'test-slug' };
		const dependencies = ['/pages/_metadata.ts'];

		metadataCache.setMetadata('/blog/[slug]', params, metadata, dependencies);
		const retrieved = metadataCache.getMetadata('/blog/[slug]', params);

		assertEquals(retrieved, metadata);
	});

	await t.step('should handle different parameter combinations', () => {
		const metadataCache = new MetadataCache();
		const metadata1: ResolvedMetadata = {
			title: 'Test Page 1',
			sources: ['page'],
			resolvedAt: Date.now(),
		};
		const metadata2: ResolvedMetadata = {
			title: 'Test Page 2',
			sources: ['page'],
			resolvedAt: Date.now(),
		};

		metadataCache.setMetadata('/blog/[slug]', { slug: 'post-1' }, metadata1, []);
		metadataCache.setMetadata('/blog/[slug]', { slug: 'post-2' }, metadata2, []);

		assertEquals(metadataCache.getMetadata('/blog/[slug]', { slug: 'post-1' }), metadata1);
		assertEquals(metadataCache.getMetadata('/blog/[slug]', { slug: 'post-2' }), metadata2);
	});
});

Deno.test('CachePerformanceMonitor - Performance Tracking', async t => {
	await t.step('should track operation timing', async () => {
		const monitor = new CachePerformanceMonitor();

		const result = await monitor.timeOperation('test-operation', async () => {
			await new Promise(resolve => setTimeout(resolve, 10));
			return 'test-result';
		});

		assertEquals(result, 'test-result');

		const metrics = monitor.getMetrics();
		assertExists(metrics['test-operation']);
		assertEquals(metrics['test-operation'].callCount, 1);
		assertEquals(metrics['test-operation'].totalTime > 0, true);
	});

	await t.step('should track multiple operations', async () => {
		const monitor = new CachePerformanceMonitor();

		// Run multiple operations
		await monitor.timeOperation('operation-a', async () => {
			await new Promise(resolve => setTimeout(resolve, 5));
		});

		await monitor.timeOperation('operation-b', async () => {
			await new Promise(resolve => setTimeout(resolve, 10));
		});

		await monitor.timeOperation('operation-a', async () => {
			await new Promise(resolve => setTimeout(resolve, 5));
		});

		const metrics = monitor.getMetrics();

		// Should track both operations
		assertExists(metrics['operation-a']);
		assertExists(metrics['operation-b']);

		// Operation A should have been called twice
		assertEquals(metrics['operation-a'].callCount, 2);
		assertEquals(metrics['operation-b'].callCount, 1);
	});

	await t.step('should provide summary statistics', async () => {
		const monitor = new CachePerformanceMonitor();

		await monitor.timeOperation('fast-op', async () => {
			await new Promise(resolve => setTimeout(resolve, 1));
		});

		await monitor.timeOperation('slow-op', async () => {
			await new Promise(resolve => setTimeout(resolve, 20));
		});

		const summary = monitor.getSummary();

		assertEquals(summary.totalOperations, 2);
		assertEquals(summary.totalTime > 0, true);
		assertEquals(summary.slowestOperation, 'slow-op');
		assertEquals(summary.fastestOperation, 'fast-op');
	});

	await t.step('should handle operation errors', async () => {
		const monitor = new CachePerformanceMonitor();

		try {
			await monitor.timeOperation('error-operation', async () => {
				throw new Error('Test error');
			});
		} catch (error) {
			assertEquals((error as Error).message, 'Test error');
		}

		const metrics = monitor.getMetrics();
		assertExists(metrics['error-operation:error']);
		assertEquals(metrics['error-operation:error'].callCount, 1);
	});
});

Deno.test('Cache Integration - Real-world Scenarios', async t => {
	await t.step('should handle cache warming', () => {
		const cache = new CacheManager();

		const warmupData = [
			{ key: 'route:/home', data: { path: '/home' } },
			{ key: 'route:/about', data: { path: '/about' } },
			{ key: 'metadata:/home', data: { title: 'Home' } },
		];

		cache.warmup(warmupData);

		// All warmed up data should be available
		for (const item of warmupData) {
			assertEquals(cache.get(item.key), item.data);
		}
	});

	await t.step('should handle concurrent access', async () => {
		const cache = new CacheManager();

		// Simulate concurrent cache operations
		const promises = [];
		for (let i = 0; i < 10; i++) {
			promises.push(
				Promise.resolve().then(() => {
					cache.set(`concurrent-${i}`, { value: i });
					return cache.get(`concurrent-${i}`);
				})
			);
		}

		const results = await Promise.all(promises);

		// All operations should complete successfully
		for (let i = 0; i < 10; i++) {
			assertEquals(results[i], { value: i });
		}
	});

	await t.step('should provide comprehensive statistics', () => {
		const cache = new CacheManager({ enableStats: true });

		// Add some data
		cache.set('key1', { data: 'test1' });
		cache.set('key2', { data: 'test2' });
		cache.get('key1'); // Hit
		cache.get('key3'); // Miss

		const stats = cache.getStats();

		assertEquals(stats.totalEntries, 2);
		assertEquals(stats.hitRate > 0, true);
		assertEquals(stats.missRate > 0, true);
		assertExists(stats.totalMemoryUsage);
		assertExists(stats.oldestEntry);
		assertExists(stats.newestEntry);
	});
});
