import { assertEquals, assertExists } from '@std/assert';
import { LayoutCacheManager, defaultCacheConfig } from '../layout-cache-manager.ts';
import type { ResolvedLayout, LayoutHandler, LayoutData } from '../../../types/layout.ts';

Deno.test('LayoutCacheManager - Intelligent Invalidation', async () => {
	const cacheManager = new LayoutCacheManager({
		...defaultCacheConfig,
		enableStats: true,
		intelligentInvalidation: true,
	});

	// Create test data
	const resolvedLayout: ResolvedLayout = {
		handlers: [],
		dataLoaders: [],
		errorBoundaries: [],
		streamingComponents: [],
		metadata: {
			totalLayouts: 1,
			resolutionTime: 100,
			cacheHit: false,
		},
	};

	const layoutHandler: LayoutHandler = {
		component: () => null,
		path: '/test/layout.tsx',
		priority: 10,
	};

	const layoutData: LayoutData = {
		title: 'Test Layout',
		description: 'Test description',
	};

	// Test basic caching with realistic keys that contain file paths
	const routeKey = '/test/route:/test/layout.tsx';
	const handlerKey = '/test/layout.tsx';
	const dataKey = '/test/layout.tsx:data';

	cacheManager.setResolvedLayout(routeKey, resolvedLayout);
	cacheManager.setLayoutHandler(handlerKey, layoutHandler);
	cacheManager.setLayoutData(dataKey, layoutData);

	// Verify cache entries exist
	const cachedLayout = cacheManager.getResolvedLayout(routeKey);
	const cachedHandler = cacheManager.getLayoutHandler(handlerKey);
	const cachedData = cacheManager.getLayoutData(dataKey);

	assertExists(cachedLayout);
	assertExists(cachedHandler);
	assertExists(cachedData);

	// Test dependency tracking
	cacheManager.addDependency(routeKey, '/test/layout.tsx');

	// Test intelligent invalidation by file path
	const invalidatedCount = cacheManager.invalidateByFilePath('/test/layout.tsx');
	// Should invalidate entries that contain the file path
	assertEquals(invalidatedCount >= 1, true);

	// Verify cache was invalidated
	const invalidatedLayout = cacheManager.getResolvedLayout(routeKey);
	assertEquals(invalidatedLayout, null);

	// Test cache statistics
	const stats = cacheManager.getStats();
	assertExists(stats);
	assertEquals(typeof stats.hits, 'number');
	assertEquals(typeof stats.misses, 'number');

	// Test hit rate calculation
	const hitRate = cacheManager.getHitRate();
	assertEquals(typeof hitRate, 'number');

	// Cleanup
	cacheManager.destroy();
});

Deno.test('LayoutCacheManager - LRU Eviction', async () => {
	const cacheManager = new LayoutCacheManager({
		...defaultCacheConfig,
		maxEntries: 3, // Small cache for testing eviction
		enableStats: true,
	});

	// Create test data
	const createResolvedLayout = (id: string): ResolvedLayout => ({
		handlers: [],
		dataLoaders: [],
		errorBoundaries: [],
		streamingComponents: [],
		metadata: {
			totalLayouts: 1,
			resolutionTime: 100,
			cacheHit: false,
		},
	});

	// Fill cache to capacity
	cacheManager.setResolvedLayout('route1', createResolvedLayout('1'));
	cacheManager.setResolvedLayout('route2', createResolvedLayout('2'));
	cacheManager.setResolvedLayout('route3', createResolvedLayout('3'));

	// Access route1 to make it recently used
	cacheManager.getResolvedLayout('route1');

	// Add another entry to trigger eviction
	cacheManager.setResolvedLayout('route4', createResolvedLayout('4'));

	// route2 should be evicted (least recently used)
	const route1 = cacheManager.getResolvedLayout('route1');
	const route2 = cacheManager.getResolvedLayout('route2');
	const route3 = cacheManager.getResolvedLayout('route3');
	const route4 = cacheManager.getResolvedLayout('route4');

	assertExists(route1); // Recently accessed, should exist
	assertEquals(route2, null); // Should be evicted
	assertExists(route3); // Should exist
	assertExists(route4); // Newly added, should exist

	// Cleanup
	cacheManager.destroy();
});

Deno.test('LayoutCacheManager - Performance Metrics', async () => {
	const cacheManager = new LayoutCacheManager({
		...defaultCacheConfig,
		enableStats: true,
	});

	const resolvedLayout: ResolvedLayout = {
		handlers: [],
		dataLoaders: [],
		errorBoundaries: [],
		streamingComponents: [],
		metadata: {
			totalLayouts: 1,
			resolutionTime: 100,
			cacheHit: false,
		},
	};

	// Test cache miss
	const miss = cacheManager.getResolvedLayout('nonexistent');
	assertEquals(miss, null);

	// Test cache hit
	cacheManager.setResolvedLayout('test', resolvedLayout);
	const hit = cacheManager.getResolvedLayout('test');
	assertExists(hit);

	// Check statistics
	const stats = cacheManager.getStats();
	assertEquals(stats.hits, 1);
	assertEquals(stats.misses, 1);

	const hitRate = cacheManager.getHitRate();
	assertEquals(hitRate, 0.5); // 1 hit out of 2 total accesses

	// Cleanup
	cacheManager.destroy();
});
