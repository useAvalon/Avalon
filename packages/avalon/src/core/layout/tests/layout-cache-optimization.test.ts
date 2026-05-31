import { describe, expect, it } from "vitest";
import type { LayoutData, LayoutHandler, ResolvedLayout } from "../../../types/layout.ts";
import { defaultCacheConfig, LayoutCacheManager } from "../layout-cache-manager.ts";

describe("LayoutCacheManager - Intelligent Invalidation", () => {
	it("should cache and invalidate by file path", () => {
		const cacheManager = new LayoutCacheManager({
			...defaultCacheConfig,
			enableStats: true,
			intelligentInvalidation: true,
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

		const layoutHandler: LayoutHandler = {
			component: () => null,
			path: "/test/layout.tsx",
			priority: 10,
		};

		const layoutData: LayoutData = {
			title: "Test Layout",
			description: "Test description",
		};

		const routeKey = "/test/route:/test/layout.tsx";
		const handlerKey = "/test/layout.tsx";
		const dataKey = "/test/layout.tsx:data";

		cacheManager.setResolvedLayout(routeKey, resolvedLayout);
		cacheManager.setLayoutHandler(handlerKey, layoutHandler);
		cacheManager.setLayoutData(dataKey, layoutData);

		const cachedLayout = cacheManager.getResolvedLayout(routeKey);
		const cachedHandler = cacheManager.getLayoutHandler(handlerKey);
		const cachedData = cacheManager.getLayoutData(dataKey);

		expect(cachedLayout).toBeDefined();
		expect(cachedHandler).toBeDefined();
		expect(cachedData).toBeDefined();

		cacheManager.addDependency(routeKey, "/test/layout.tsx");

		const invalidatedCount = cacheManager.invalidateByFilePath("/test/layout.tsx");
		expect(invalidatedCount >= 1).toEqual(true);

		const invalidatedLayout = cacheManager.getResolvedLayout(routeKey);
		expect(invalidatedLayout).toEqual(null);

		const stats = cacheManager.getStats();
		expect(stats).toBeDefined();
		expect(typeof stats.hits).toEqual("number");
		expect(typeof stats.misses).toEqual("number");

		const hitRate = cacheManager.getHitRate();
		expect(typeof hitRate).toEqual("number");

		cacheManager.destroy();
	});
});

describe("LayoutCacheManager - LRU Eviction", () => {
	it("should evict least recently used entries", () => {
		const cacheManager = new LayoutCacheManager({
			...defaultCacheConfig,
			maxEntries: 3,
			enableStats: true,
		});

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

		cacheManager.setResolvedLayout("route1", createResolvedLayout("1"));
		cacheManager.setResolvedLayout("route2", createResolvedLayout("2"));
		cacheManager.setResolvedLayout("route3", createResolvedLayout("3"));

		cacheManager.getResolvedLayout("route1");

		cacheManager.setResolvedLayout("route4", createResolvedLayout("4"));

		const route1 = cacheManager.getResolvedLayout("route1");
		const route2 = cacheManager.getResolvedLayout("route2");
		const route3 = cacheManager.getResolvedLayout("route3");
		const route4 = cacheManager.getResolvedLayout("route4");

		expect(route1).toBeDefined();
		expect(route2).toEqual(null);
		expect(route3).toBeDefined();
		expect(route4).toBeDefined();

		cacheManager.destroy();
	});
});

describe("LayoutCacheManager - Performance Metrics", () => {
	it("should track hits and misses", () => {
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

		const miss = cacheManager.getResolvedLayout("nonexistent");
		expect(miss).toEqual(null);

		cacheManager.setResolvedLayout("test", resolvedLayout);
		const hit = cacheManager.getResolvedLayout("test");
		expect(hit).toBeDefined();

		const stats = cacheManager.getStats();
		expect(stats.hits).toEqual(1);
		expect(stats.misses).toEqual(1);

		const hitRate = cacheManager.getHitRate();
		expect(hitRate).toEqual(0.5);

		cacheManager.destroy();
	});
});
