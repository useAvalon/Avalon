import { assertEquals, assertExists, assertRejects } from 'jsr:@std/assert';
import { describe, it, beforeEach, afterEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';
import { join } from 'node:path';
import { ComponentType } from 'preact';

import {
	EnhancedLayoutResolver,
	createEnhancedLayoutResolver,
	EnhancedLayoutResolverUtils,
	type EnhancedLayoutResolverOptions,
} from '../enhanced-layout-resolver.ts';
import type {
	LayoutContext,
	LayoutData,
	LayoutHandler,
	LayoutProps,
	LayoutConfig,
	ResolvedLayout,
} from '../../../types/layout.ts';

// Mock components for testing
const MockLayoutComponent: ComponentType<LayoutProps> = ({ children, data }) => {
	return { type: 'div', props: { children: [data.title || 'Layout', children] } };
};

const MockPageComponent: ComponentType<any> = () => {
	return { type: 'div', props: { children: 'Page Content' } };
};

// Mock page module
interface MockPageModule {
	default: ComponentType<any>;
	layoutConfig?: LayoutConfig;
	loader?: (ctx: any) => Promise<any>;
}

// Test fixtures
const createMockLayoutContext = (routePath = '/test'): LayoutContext => ({
	request: new Request(`http://localhost${routePath}`),
	params: {},
	query: new URLSearchParams(),
	state: new Map(),
});

const createMockPageModule = (layoutConfig?: LayoutConfig): MockPageModule => ({
	default: MockPageComponent,
	layoutConfig,
});

describe('EnhancedLayoutResolver', () => {
	let resolver: EnhancedLayoutResolver;
	let tempDir: string;

	beforeEach(async () => {
		// Set test environment to prevent timers
		Deno.env.set('DENO_ENV', 'test');

		// Create temporary directory for test layouts
		tempDir = await Deno.makeTempDir({ prefix: 'layout_resolver_test_' });

		// Create resolver with test configuration
		resolver = createEnhancedLayoutResolver({
			baseDirectory: tempDir,
			developmentMode: true,
			enableCaching: true,
			enableStreaming: true,
			enableErrorBoundaries: true,
			enableMetrics: true,
			enableDebugInfo: true,
		});
	});

	afterEach(async () => {
		// Clean up resolver resources
		if (resolver) {
			resolver.destroy();
		}

		// Clean up temporary directory
		try {
			await Deno.remove(tempDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe('constructor and configuration', () => {
		it('should create resolver with default options', () => {
			const defaultResolver = new EnhancedLayoutResolver({
				baseDirectory: tempDir,
			});

			const options = defaultResolver.getOptions();
			assertEquals(options.baseDirectory, tempDir);
			assertEquals(options.filePattern, '_layout.tsx');
			assertEquals(options.enableCaching, true);
			assertEquals(options.enableStreaming, true);
			assertEquals(options.enableErrorBoundaries, true);
		});

		it('should create resolver with custom options', () => {
			const customResolver = createEnhancedLayoutResolver({
				baseDirectory: tempDir,
				filePattern: 'layout.tsx',
				enableCaching: false,
				enableStreaming: false,
				cacheTTL: 10000,
				maxCacheSize: 500,
			});

			const options = customResolver.getOptions();
			assertEquals(options.filePattern, 'layout.tsx');
			assertEquals(options.enableCaching, false);
			assertEquals(options.enableStreaming, false);
			assertEquals(options.cacheTTL, 10000);
			assertEquals(options.maxCacheSize, 500);
		});

		it('should update options after creation', () => {
			resolver.updateOptions({
				enableCaching: false,
				enableStreaming: false,
			});

			const options = resolver.getOptions();
			assertEquals(options.enableCaching, false);
			assertEquals(options.enableStreaming, false);
		});
	});

	describe('layout resolution pipeline', () => {
		it('should resolve layouts with empty layout chain', async () => {
			const context = createMockLayoutContext('/test');
			const pageModule = createMockPageModule();

			const result = await resolver.resolveLayouts('/test', pageModule, context);

			assertExists(result);
			assertEquals(result.handlers.length, 0);
			assertEquals(result.dataLoaders.length, 0);
			assertEquals(result.metadata.totalLayouts, 0);
			assertEquals(result.metadata.cacheHit, false);
		});

		it('should handle layout resolution errors gracefully', async () => {
			const context = createMockLayoutContext('/error');
			const pageModule = createMockPageModule();

			// This should not throw, but handle errors gracefully
			const result = await resolver.resolveLayouts('/error', pageModule, context);

			assertExists(result);
			// Should return empty result on error
			assertEquals(result.handlers.length, 0);
		});

		it('should collect performance metrics', async () => {
			const context = createMockLayoutContext('/metrics');
			const pageModule = createMockPageModule();

			const result = await resolver.resolveLayouts('/metrics', pageModule, context);

			assertExists(result.metadata);
			assertEquals(typeof result.metadata.resolutionTime, 'number');
			assertEquals(result.metadata.resolutionTime >= 0, true);
			assertEquals(typeof result.metadata.totalLayouts, 'number');
			assertEquals(typeof result.metadata.cacheHit, 'boolean');
		});
	});

	describe('caching system', () => {
		it('should cache layout resolutions', async () => {
			const context = createMockLayoutContext('/cache-test');
			const pageModule = createMockPageModule();

			// First resolution
			const result1 = await resolver.resolveLayouts('/cache-test', pageModule, context);
			assertEquals(result1.metadata.cacheHit, false);

			// Second resolution should hit cache
			const result2 = await resolver.resolveLayouts('/cache-test', pageModule, context);
			assertEquals(result2.metadata.cacheHit, true);
		});

		it('should respect cache TTL', async () => {
			// Create resolver with very short TTL
			const shortTTLResolver = createEnhancedLayoutResolver({
				baseDirectory: tempDir,
				enableCaching: true,
				cacheTTL: 10, // 10ms
			});

			const context = createMockLayoutContext('/ttl-test');
			const pageModule = createMockPageModule();

			// First resolution
			await shortTTLResolver.resolveLayouts('/ttl-test', pageModule, context);

			// Wait for TTL to expire
			await new Promise(resolve => setTimeout(resolve, 20));

			// Second resolution should not hit cache
			const result = await shortTTLResolver.resolveLayouts('/ttl-test', pageModule, context);
			assertEquals(result.metadata.cacheHit, false);
		});

		it('should clear cache when requested', async () => {
			const context = createMockLayoutContext('/clear-test');
			const pageModule = createMockPageModule();

			// First resolution to populate cache
			await resolver.resolveLayouts('/clear-test', pageModule, context);

			// Clear cache
			resolver.clearCache();

			// Second resolution should not hit cache
			const result = await resolver.resolveLayouts('/clear-test', pageModule, context);
			assertEquals(result.metadata.cacheHit, false);
		});

		it('should disable caching when requested', async () => {
			resolver.setCaching(false);

			const context = createMockLayoutContext('/no-cache');
			const pageModule = createMockPageModule();

			// First resolution
			const result1 = await resolver.resolveLayouts('/no-cache', pageModule, context);
			assertEquals(result1.metadata.cacheHit, false);

			// Second resolution should also not hit cache
			const result2 = await resolver.resolveLayouts('/no-cache', pageModule, context);
			assertEquals(result2.metadata.cacheHit, false);
		});
	});

	describe('layout composition control', () => {
		it('should handle replaceLayout configuration', async () => {
			const context = createMockLayoutContext('/replace');
			const pageModule = createMockPageModule({
				replaceLayout: true,
			});

			const result = await resolver.resolveLayouts('/replace', pageModule, context);

			assertExists(result);
			// With replaceLayout: true and no customLayout, should have no layouts
			assertEquals(result.handlers.length, 0);
		});

		it('should handle skipLayouts configuration', async () => {
			const context = createMockLayoutContext('/skip');
			const pageModule = createMockPageModule({
				skipLayouts: ['root-layout', 'admin-layout'],
			});

			const result = await resolver.resolveLayouts('/skip', pageModule, context);

			assertExists(result);
			// Should process the configuration even with no actual layouts
			assertEquals(result.metadata.totalLayouts, 0);
		});

		it('should handle onlyLayouts configuration', async () => {
			const context = createMockLayoutContext('/only');
			const pageModule = createMockPageModule({
				onlyLayouts: ['specific-layout'],
			});

			const result = await resolver.resolveLayouts('/only', pageModule, context);

			assertExists(result);
			// Should process the configuration even with no actual layouts
			assertEquals(result.metadata.totalLayouts, 0);
		});
	});

	describe('component access', () => {
		it('should provide access to layout discovery', () => {
			const discovery = resolver.getLayoutDiscovery();
			assertExists(discovery);
			assertEquals(typeof discovery.discoverLayouts, 'function');
		});

		it('should provide access to layout matcher', () => {
			const matcher = resolver.getLayoutMatcher();
			assertExists(matcher);
			assertEquals(typeof matcher.shouldApplyLayout, 'function');
		});

		it('should provide access to layout composer', () => {
			const composer = resolver.getLayoutComposer();
			assertExists(composer);
			assertEquals(typeof composer.resolveLayouts, 'function');
		});

		it('should provide access to layout data loader', () => {
			const dataLoader = resolver.getLayoutDataLoader();
			assertExists(dataLoader);
			assertEquals(typeof dataLoader.loadLayoutData, 'function');
		});

		it('should provide access to layout streaming', () => {
			const streaming = resolver.getLayoutStreaming();
			assertExists(streaming);
			assertEquals(typeof streaming.renderWithStreaming, 'function');
		});

		it('should provide access to error recovery', () => {
			const errorRecovery = resolver.getErrorRecovery();
			assertExists(errorRecovery);
			assertEquals(typeof errorRecovery.handleLayoutError, 'function');
		});
	});

	describe('resolver statistics', () => {
		it('should provide resolver statistics', () => {
			const stats = resolver.getResolverStats();

			assertExists(stats);
			assertEquals(typeof stats.cacheSize, 'number');
			assertEquals(typeof stats.cacheHitRate, 'number');
			assertEquals(typeof stats.totalResolutions, 'number');
			assertEquals(typeof stats.averageResolutionTime, 'number');
			assertEquals(typeof stats.errorCount, 'number');
		});
	});
});

describe('EnhancedLayoutResolverUtils', () => {
	describe('configuration helpers', () => {
		it('should create basic configuration', () => {
			const config = EnhancedLayoutResolverUtils.createBasicConfig('/test', false);

			assertEquals(config.baseDirectory, '/test');
			assertEquals(config.developmentMode, false);
			assertEquals(config.enableCaching, true);
			assertEquals(config.enableStreaming, true);
			assertEquals(config.enableErrorBoundaries, true);
			assertEquals(config.enableMetrics, false);
			assertEquals(config.enableDebugInfo, false);
		});

		it('should create production configuration', () => {
			const config = EnhancedLayoutResolverUtils.createProductionConfig('/prod');

			assertEquals(config.baseDirectory, '/prod');
			assertEquals(config.developmentMode, false);
			assertEquals(config.enableCaching, true);
			assertEquals(config.cacheTTL, 15 * 60 * 1000); // 15 minutes
			assertEquals(config.maxCacheSize, 5000);
			assertEquals(config.enableStreaming, true);
			assertEquals(config.enableErrorBoundaries, true);
			assertEquals(config.enableMetrics, false);
			assertEquals(config.enableDebugInfo, false);
		});

		it('should create development configuration', () => {
			const config = EnhancedLayoutResolverUtils.createDevelopmentConfig('/dev');

			assertEquals(config.baseDirectory, '/dev');
			assertEquals(config.developmentMode, true);
			assertEquals(config.enableWatching, true);
			assertEquals(config.enableCaching, true);
			assertEquals(config.cacheTTL, 1 * 60 * 1000); // 1 minute
			assertEquals(config.maxCacheSize, 100);
			assertEquals(config.enableStreaming, true);
			assertEquals(config.enableErrorBoundaries, true);
			assertEquals(config.enableMetrics, true);
			assertEquals(config.enableDebugInfo, true);
		});
	});
});

describe('Integration with layout system components', () => {
	let resolver: EnhancedLayoutResolver;
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await Deno.makeTempDir({ prefix: 'layout_integration_test_' });
		resolver = createEnhancedLayoutResolver({
			baseDirectory: tempDir,
			developmentMode: true,
		});
	});

	afterEach(async () => {
		await Deno.remove(tempDir, { recursive: true });
	});

	it('should integrate with layout matcher for conditional rendering', async () => {
		const matcher = resolver.getLayoutMatcher();

		// Add a custom rule
		matcher.addRule({
			matches: (layoutPath: string, route: any) => route.path.startsWith('/api/'),
			apply: false,
			priority: 100,
		});

		const context = createMockLayoutContext('/api/test');
		const pageModule = createMockPageModule();

		const result = await resolver.resolveLayouts('/api/test', pageModule, context);

		assertExists(result);
		// Should work even with conditional rendering rules
		assertEquals(result.metadata.totalLayouts, 0);
	});

	it('should integrate with layout composer for composition control', async () => {
		const composer = resolver.getLayoutComposer();

		// Verify composer is properly integrated
		assertExists(composer);
		assertEquals(typeof composer.resolveLayouts, 'function');

		const context = createMockLayoutContext('/compose');
		const pageModule = createMockPageModule({
			skipLayouts: ['unwanted-layout'],
		});

		const result = await resolver.resolveLayouts('/compose', pageModule, context);

		assertExists(result);
		assertEquals(result.metadata.totalLayouts, 0);
	});

	it('should integrate with data loader for layout data', async () => {
		const dataLoader = resolver.getLayoutDataLoader();

		// Verify data loader is properly integrated
		assertExists(dataLoader);
		assertEquals(typeof dataLoader.loadLayoutData, 'function');

		const context = createMockLayoutContext('/data');
		const pageModule = createMockPageModule();

		const result = await resolver.resolveLayouts('/data', pageModule, context);

		assertExists(result);
		assertEquals(result.dataLoaders.length, 0); // No layouts with loaders
	});
});

describe('Error handling and recovery', () => {
	let resolver: EnhancedLayoutResolver;
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await Deno.makeTempDir({ prefix: 'layout_error_test_' });
		resolver = createEnhancedLayoutResolver({
			baseDirectory: tempDir,
			developmentMode: true,
			enableErrorBoundaries: true,
		});
	});

	afterEach(async () => {
		await Deno.remove(tempDir, { recursive: true });
	});

	it('should handle errors in discovery stage', async () => {
		// Create a resolver with invalid base directory
		const invalidResolver = createEnhancedLayoutResolver({
			baseDirectory: '/nonexistent/path',
			developmentMode: true,
		});

		const context = createMockLayoutContext('/error');
		const pageModule = createMockPageModule();

		// Should not throw, but handle error gracefully
		const result = await invalidResolver.resolveLayouts('/error', pageModule, context);

		assertExists(result);
		assertEquals(result.handlers.length, 0);
	});

	it('should handle errors in composition stage', async () => {
		const context = createMockLayoutContext('/composition-error');
		const pageModule = createMockPageModule({
			customLayout: '/nonexistent/layout.tsx',
		});

		// Should not throw, but handle error gracefully
		const result = await resolver.resolveLayouts('/composition-error', pageModule, context);

		assertExists(result);
		assertEquals(result.metadata.totalLayouts, 0);
	});
});

describe('Performance and metrics', () => {
	let resolver: EnhancedLayoutResolver;
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await Deno.makeTempDir({ prefix: 'layout_perf_test_' });
		resolver = createEnhancedLayoutResolver({
			baseDirectory: tempDir,
			developmentMode: true,
			enableMetrics: true,
		});
	});

	afterEach(async () => {
		await Deno.remove(tempDir, { recursive: true });
	});

	it('should collect timing metrics', async () => {
		const context = createMockLayoutContext('/perf');
		const pageModule = createMockPageModule();

		const result = await resolver.resolveLayouts('/perf', pageModule, context);

		assertExists(result.metadata);
		assertEquals(typeof result.metadata.resolutionTime, 'number');
		assertEquals(result.metadata.resolutionTime >= 0, true);
	});

	it('should handle multiple concurrent resolutions', async () => {
		const context1 = createMockLayoutContext('/concurrent1');
		const context2 = createMockLayoutContext('/concurrent2');
		const context3 = createMockLayoutContext('/concurrent3');
		const pageModule = createMockPageModule();

		// Run multiple resolutions concurrently
		const [result1, result2, result3] = await Promise.all([
			resolver.resolveLayouts('/concurrent1', pageModule, context1),
			resolver.resolveLayouts('/concurrent2', pageModule, context2),
			resolver.resolveLayouts('/concurrent3', pageModule, context3),
		]);

		assertExists(result1);
		assertExists(result2);
		assertExists(result3);

		// All should complete successfully
		assertEquals(typeof result1.metadata.resolutionTime, 'number');
		assertEquals(typeof result2.metadata.resolutionTime, 'number');
		assertEquals(typeof result3.metadata.resolutionTime, 'number');
	});
});
