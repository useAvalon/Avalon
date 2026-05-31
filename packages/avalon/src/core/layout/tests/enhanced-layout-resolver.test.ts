import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ComponentType } from "preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LayoutConfig, LayoutContext } from "../../../types/layout.ts";
import {
	createEnhancedLayoutResolver,
	EnhancedLayoutResolver,
	EnhancedLayoutResolverUtils,
} from "../enhanced-layout-resolver.ts";

// Mock components for testing
const MockPageComponent: ComponentType<any> = () => {
	return { type: "div", props: { children: "Page Content" } };
};

// Mock page module
interface MockPageModule {
	default: ComponentType<any>;
	layoutConfig?: LayoutConfig;
	loader?: (ctx: any) => Promise<any>;
}

// Test fixtures
const createMockLayoutContext = (routePath = "/test"): LayoutContext => ({
	request: new Request(`http://localhost${routePath}`),
	params: {},
	query: new URLSearchParams(),
	state: new Map(),
});

const createMockPageModule = (layoutConfig?: LayoutConfig): MockPageModule => ({
	default: MockPageComponent,
	layoutConfig,
});

describe("EnhancedLayoutResolver", () => {
	let resolver: EnhancedLayoutResolver;
	let tempDir: string;

	beforeEach(async () => {
		process.env.NODE_ENV = "test";

		tempDir = await mkdtemp(join(tmpdir(), "layout_resolver_test_"));

		resolver = createEnhancedLayoutResolver({
			baseDirectory: tempDir,
			developmentMode: true,
			enableCaching: true,
			enableMetrics: true,
			enableDebugInfo: true,
		});
	});

	afterEach(async () => {
		if (resolver) {
			resolver.destroy();
		}

		try {
			await rm(tempDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("constructor and configuration", () => {
		it("should create resolver with default options", () => {
			const defaultResolver = new EnhancedLayoutResolver({
				baseDirectory: tempDir,
			});

			const options = defaultResolver.getOptions();
			expect(options.baseDirectory).toEqual(tempDir);
			expect(options.filePattern).toEqual("_layout.tsx");
			expect(options.enableCaching).toEqual(true);
		});

		it("should create resolver with custom options", () => {
			const customResolver = createEnhancedLayoutResolver({
				baseDirectory: tempDir,
				filePattern: "layout.tsx",
				enableCaching: false,
				cacheTTL: 10000,
				maxCacheSize: 500,
			});

			const options = customResolver.getOptions();
			expect(options.filePattern).toEqual("layout.tsx");
			expect(options.enableCaching).toEqual(false);
			expect(options.cacheTTL).toEqual(10000);
			expect(options.maxCacheSize).toEqual(500);
		});

		it("should update options after creation", () => {
			resolver.updateOptions({
				enableCaching: false,
			});

			const options = resolver.getOptions();
			expect(options.enableCaching).toEqual(false);
		});
	});

	describe("layout resolution pipeline", () => {
		it("should resolve layouts with empty layout chain", async () => {
			const context = createMockLayoutContext("/test");
			const pageModule = createMockPageModule();

			const result = await resolver.resolveLayouts("/test", pageModule, context);

			expect(result).toBeDefined();
			expect(result.handlers.length).toEqual(0);
			expect(result.dataLoaders.length).toEqual(0);
			expect(result.metadata.totalLayouts).toEqual(0);
			expect(result.metadata.cacheHit).toEqual(false);
		});

		it("should handle layout resolution errors gracefully", async () => {
			const context = createMockLayoutContext("/error");
			const pageModule = createMockPageModule();

			const result = await resolver.resolveLayouts("/error", pageModule, context);

			expect(result).toBeDefined();
			expect(result.handlers.length).toEqual(0);
		});

		it("should collect performance metrics", async () => {
			const context = createMockLayoutContext("/metrics");
			const pageModule = createMockPageModule();

			const result = await resolver.resolveLayouts("/metrics", pageModule, context);

			expect(result.metadata).toBeDefined();
			expect(typeof result.metadata.resolutionTime).toEqual("number");
			expect(result.metadata.resolutionTime >= 0).toEqual(true);
			expect(typeof result.metadata.totalLayouts).toEqual("number");
			expect(typeof result.metadata.cacheHit).toEqual("boolean");
		});
	});

	describe("caching system", () => {
		it("should cache layout resolutions", async () => {
			const context = createMockLayoutContext("/cache-test");
			const pageModule = createMockPageModule();

			const result1 = await resolver.resolveLayouts("/cache-test", pageModule, context);
			expect(result1.metadata.cacheHit).toEqual(false);

			const result2 = await resolver.resolveLayouts("/cache-test", pageModule, context);
			expect(result2.metadata.cacheHit).toEqual(true);
		});

		it("should respect cache TTL", async () => {
			const shortTTLResolver = createEnhancedLayoutResolver({
				baseDirectory: tempDir,
				enableCaching: true,
				cacheTTL: 10,
			});

			const context = createMockLayoutContext("/ttl-test");
			const pageModule = createMockPageModule();

			await shortTTLResolver.resolveLayouts("/ttl-test", pageModule, context);

			await new Promise((resolve) => setTimeout(resolve, 20));

			const result = await shortTTLResolver.resolveLayouts("/ttl-test", pageModule, context);
			expect(result.metadata.cacheHit).toEqual(false);
		});

		it("should clear cache when requested", async () => {
			const context = createMockLayoutContext("/clear-test");
			const pageModule = createMockPageModule();

			await resolver.resolveLayouts("/clear-test", pageModule, context);

			resolver.clearCache();

			const result = await resolver.resolveLayouts("/clear-test", pageModule, context);
			expect(result.metadata.cacheHit).toEqual(false);
		});

		it("should disable caching when requested", async () => {
			resolver.setCaching(false);

			const context = createMockLayoutContext("/no-cache");
			const pageModule = createMockPageModule();

			const result1 = await resolver.resolveLayouts("/no-cache", pageModule, context);
			expect(result1.metadata.cacheHit).toEqual(false);

			const result2 = await resolver.resolveLayouts("/no-cache", pageModule, context);
			expect(result2.metadata.cacheHit).toEqual(false);
		});
	});

	describe("layout composition control", () => {
		it("should handle replaceLayout configuration", async () => {
			const context = createMockLayoutContext("/replace");
			const pageModule = createMockPageModule({
				replaceLayout: true,
			});

			const result = await resolver.resolveLayouts("/replace", pageModule, context);

			expect(result).toBeDefined();
			expect(result.handlers.length).toEqual(0);
		});

		it("should handle skipLayouts configuration", async () => {
			const context = createMockLayoutContext("/skip");
			const pageModule = createMockPageModule({
				skipLayouts: ["root-layout", "admin-layout"],
			});

			const result = await resolver.resolveLayouts("/skip", pageModule, context);

			expect(result).toBeDefined();
			expect(result.metadata.totalLayouts).toEqual(0);
		});

		it("should handle onlyLayouts configuration", async () => {
			const context = createMockLayoutContext("/only");
			const pageModule = createMockPageModule({
				onlyLayouts: ["specific-layout"],
			});

			const result = await resolver.resolveLayouts("/only", pageModule, context);

			expect(result).toBeDefined();
			expect(result.metadata.totalLayouts).toEqual(0);
		});
	});

	describe("component access", () => {
		it("should provide access to layout discovery", () => {
			const discovery = resolver.getLayoutDiscovery();
			expect(discovery).toBeDefined();
			expect(typeof discovery.discoverLayouts).toEqual("function");
		});

		it("should provide access to layout matcher", () => {
			const matcher = resolver.getLayoutMatcher();
			expect(matcher).toBeDefined();
			expect(typeof matcher.shouldApplyLayout).toEqual("function");
		});

		it("should provide access to layout composer", () => {
			const composer = resolver.getLayoutComposer();
			expect(composer).toBeDefined();
			expect(typeof composer.resolveLayouts).toEqual("function");
		});

		it("should provide access to layout data loader", () => {
			const dataLoader = resolver.getLayoutDataLoader();
			expect(dataLoader).toBeDefined();
			expect(typeof dataLoader.loadLayoutData).toEqual("function");
		});

		it("should provide access to cache manager", () => {
			const cacheManager = resolver.getCacheManager();
			expect(cacheManager).toBeDefined();
			expect(typeof cacheManager.getStats).toEqual("function");
		});
	});

	describe("resolver statistics", () => {
		it("should provide resolver statistics", () => {
			const stats = resolver.getResolverStats();

			expect(stats).toBeDefined();
			expect(typeof stats.cacheSize).toEqual("number");
			expect(typeof stats.cacheHitRate).toEqual("number");
			expect(typeof stats.totalResolutions).toEqual("number");
			expect(typeof stats.averageResolutionTime).toEqual("number");
			expect(typeof stats.errorCount).toEqual("number");
		});
	});
});

describe("EnhancedLayoutResolverUtils", () => {
	describe("configuration helpers", () => {
		it("should create basic configuration", () => {
			const config = EnhancedLayoutResolverUtils.createBasicConfig("/test", false);

			expect(config.baseDirectory).toEqual("/test");
			expect(config.developmentMode).toEqual(false);
			expect(config.enableCaching).toEqual(true);
			expect(config.enableMetrics).toEqual(false);
			expect(config.enableDebugInfo).toEqual(false);
		});

		it("should create basic configuration in development mode", () => {
			const config = EnhancedLayoutResolverUtils.createBasicConfig("/test", true);

			expect(config.baseDirectory).toEqual("/test");
			expect(config.developmentMode).toEqual(true);
			expect(config.enableMetrics).toEqual(true);
			expect(config.enableDebugInfo).toEqual(true);
		});

		it("should create production configuration", () => {
			const config = EnhancedLayoutResolverUtils.createProductionConfig("/prod");

			expect(config.baseDirectory).toEqual("/prod");
			expect(config.developmentMode).toEqual(false);
			expect(config.enableCaching).toEqual(true);
			expect(config.enableMetrics).toEqual(false);
			expect(config.enableDebugInfo).toEqual(false);
		});
	});
});

describe("Integration with layout system components", () => {
	let resolver: EnhancedLayoutResolver;
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "layout_integration_test_"));
		resolver = createEnhancedLayoutResolver({
			baseDirectory: tempDir,
			developmentMode: true,
		});
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true });
	});

	it("should integrate with layout matcher for conditional rendering", async () => {
		const matcher = resolver.getLayoutMatcher();

		matcher.addRule({
			matches: (route) => route.path.startsWith("/api/"),
			apply: false,
			priority: 100,
		});

		const context = createMockLayoutContext("/api/test");
		const pageModule = createMockPageModule();

		const result = await resolver.resolveLayouts("/api/test", pageModule, context);

		expect(result).toBeDefined();
		expect(result.metadata.totalLayouts).toEqual(0);
	});

	it("should integrate with layout composer for composition control", async () => {
		const composer = resolver.getLayoutComposer();

		expect(composer).toBeDefined();
		expect(typeof composer.resolveLayouts).toEqual("function");

		const context = createMockLayoutContext("/compose");
		const pageModule = createMockPageModule({
			skipLayouts: ["unwanted-layout"],
		});

		const result = await resolver.resolveLayouts("/compose", pageModule, context);

		expect(result).toBeDefined();
		expect(result.metadata.totalLayouts).toEqual(0);
	});

	it("should integrate with data loader for layout data", async () => {
		const dataLoader = resolver.getLayoutDataLoader();

		expect(dataLoader).toBeDefined();
		expect(typeof dataLoader.loadLayoutData).toEqual("function");

		const context = createMockLayoutContext("/data");
		const pageModule = createMockPageModule();

		const result = await resolver.resolveLayouts("/data", pageModule, context);

		expect(result).toBeDefined();
		expect(result.dataLoaders.length).toEqual(0);
	});
});

describe("Error handling and recovery", () => {
	let resolver: EnhancedLayoutResolver;
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "layout_error_test_"));
		resolver = createEnhancedLayoutResolver({
			baseDirectory: tempDir,
			developmentMode: true,
		});
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true });
	});

	it("should handle errors in discovery stage", async () => {
		const invalidResolver = createEnhancedLayoutResolver({
			baseDirectory: "/nonexistent/path",
			developmentMode: true,
		});

		const context = createMockLayoutContext("/error");
		const pageModule = createMockPageModule();

		const result = await invalidResolver.resolveLayouts("/error", pageModule, context);

		expect(result).toBeDefined();
		expect(result.handlers.length).toEqual(0);
	});

	it("should handle errors in composition stage", async () => {
		const context = createMockLayoutContext("/composition-error");
		const pageModule = createMockPageModule({
			customLayout: "/nonexistent/layout.tsx",
		});

		const result = await resolver.resolveLayouts("/composition-error", pageModule, context);

		expect(result).toBeDefined();
		expect(result.metadata.totalLayouts).toEqual(0);
	});
});

describe("Performance and metrics", () => {
	let resolver: EnhancedLayoutResolver;
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "layout_perf_test_"));
		resolver = createEnhancedLayoutResolver({
			baseDirectory: tempDir,
			developmentMode: true,
			enableMetrics: true,
		});
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true });
	});

	it("should collect timing metrics", async () => {
		const context = createMockLayoutContext("/perf");
		const pageModule = createMockPageModule();

		const result = await resolver.resolveLayouts("/perf", pageModule, context);

		expect(result.metadata).toBeDefined();
		expect(typeof result.metadata.resolutionTime).toEqual("number");
		expect(result.metadata.resolutionTime >= 0).toEqual(true);
	});

	it("should handle multiple concurrent resolutions", async () => {
		const context1 = createMockLayoutContext("/concurrent1");
		const context2 = createMockLayoutContext("/concurrent2");
		const context3 = createMockLayoutContext("/concurrent3");
		const pageModule = createMockPageModule();

		const [result1, result2, result3] = await Promise.all([
			resolver.resolveLayouts("/concurrent1", pageModule, context1),
			resolver.resolveLayouts("/concurrent2", pageModule, context2),
			resolver.resolveLayouts("/concurrent3", pageModule, context3),
		]);

		expect(result1).toBeDefined();
		expect(result2).toBeDefined();
		expect(result3).toBeDefined();

		expect(typeof result1.metadata.resolutionTime).toEqual("number");
		expect(typeof result2.metadata.resolutionTime).toEqual("number");
		expect(typeof result3.metadata.resolutionTime).toEqual("number");
	});
});
