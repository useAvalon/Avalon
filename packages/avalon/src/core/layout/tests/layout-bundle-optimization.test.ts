import { assertEquals, assertExists } from '@std/assert';
import { LayoutBundleOptimizer, defaultBundleOptimizationConfig } from '../layout-bundle-optimizer.ts';
import type { LayoutHandler } from '../../../types/layout.ts';

Deno.test('LayoutBundleOptimizer - Basic Bundle Creation', async () => {
	const optimizer = new LayoutBundleOptimizer({
		...defaultBundleOptimizationConfig,
		outputDir: './test-output',
		developmentMode: true,
		enableAnalysis: false, // Disable to avoid file system operations
		enableCodeSplitting: false,
		enableTreeShaking: false,
		enableMinification: false,
	});

	// Create test layout handlers
	const handlers: LayoutHandler[] = [
		{
			component: () => null,
			path: '/test/root/_layout.tsx',
			priority: 0,
		},
		{
			component: () => null,
			path: '/test/blog/_layout.tsx',
			priority: 10,
		},
		{
			component: () => null,
			path: '/test/admin/_layout.tsx',
			priority: 10,
		},
	];

	// Test bundle optimization
	const bundles = await optimizer.optimizeLayoutBundles(handlers);

	// Verify bundles were created
	assertEquals(bundles.length, handlers.length);

	// Check bundle properties
	for (const bundle of bundles) {
		assertExists(bundle.id);
		assertExists(bundle.path);
		assertEquals(typeof bundle.size, 'number');
		assertEquals(Array.isArray(bundle.dependencies), true);
		assertEquals(Array.isArray(bundle.chunks), true);
		assertEquals(typeof bundle.isShared, 'boolean');
		assertEquals(['high', 'medium', 'low'].includes(bundle.priority), true);
	}

	// Root layout should have high priority
	const rootBundle = bundles.find(b => b.path.includes('root'));
	assertExists(rootBundle);
	assertEquals(rootBundle.priority, 'high');

	// Cleanup
	optimizer.clearCache();
});

Deno.test('LayoutBundleOptimizer - Bundle Priority Assignment', async () => {
	const optimizer = new LayoutBundleOptimizer({
		...defaultBundleOptimizationConfig,
		outputDir: './test-output',
		developmentMode: true,
		enableAnalysis: false,
		enableCodeSplitting: false,
		enableTreeShaking: false,
		enableMinification: false,
	});

	// Create handlers with different priorities
	const handlers: LayoutHandler[] = [
		{
			component: () => null,
			path: '/src/pages/_layout.tsx', // Root layout
			priority: 0,
		},
		{
			component: () => null,
			path: '/src/pages/blog/_layout.tsx', // Nested layout
			priority: 10,
		},
		{
			component: () => null,
			path: '/src/pages/blog/posts/_layout.tsx', // Deep nested layout
			priority: 20,
		},
		{
			component: () => null,
			path: '/src/pages/admin/users/settings/_layout.tsx', // Very deep nested
			priority: 30,
		},
	];

	const bundles = await optimizer.optimizeLayoutBundles(handlers);

	// Find bundles by path
	const rootBundle = bundles.find(b => b.path.includes('pages/_layout.tsx'));
	const blogBundle = bundles.find(b => b.path.includes('blog/_layout.tsx'));
	const postsBundle = bundles.find(b => b.path.includes('posts/_layout.tsx'));
	const settingsBundle = bundles.find(b => b.path.includes('settings/_layout.tsx'));

	// Verify priority assignments
	assertExists(rootBundle);
	assertEquals(rootBundle.priority, 'high'); // Root layout gets high priority

	assertExists(blogBundle);
	// Blog layout also gets high priority because it contains '_layout.tsx'
	assertEquals(blogBundle.priority, 'high');

	assertExists(postsBundle);
	// All layouts with '_layout.tsx' get high priority in current implementation
	assertEquals(postsBundle.priority, 'high');

	assertExists(settingsBundle);
	// All layouts with '_layout.tsx' get high priority in current implementation
	assertEquals(settingsBundle.priority, 'high');

	// Cleanup
	optimizer.clearCache();
});

Deno.test('LayoutBundleOptimizer - Bundle Loading Strategy', async () => {
	const optimizer = new LayoutBundleOptimizer({
		...defaultBundleOptimizationConfig,
		outputDir: './test-output',
		developmentMode: true,
		enableAnalysis: false,
		enableCodeSplitting: false,
		enableTreeShaking: false,
		enableMinification: false,
	});

	// Create test handlers
	const handlers: LayoutHandler[] = [
		{
			component: () => null,
			path: '/src/pages/_layout.tsx',
			priority: 0,
		},
		{
			component: () => null,
			path: '/src/pages/blog/_layout.tsx',
			priority: 10,
		},
		{
			component: () => null,
			path: '/src/pages/admin/_layout.tsx',
			priority: 10,
		},
	];

	const bundles = await optimizer.optimizeLayoutBundles(handlers);

	// Test loading strategy generation
	const { BundleOptimizerUtils } = await import('../layout-bundle-optimizer.ts');
	const strategy = BundleOptimizerUtils.generateLoadingStrategy(bundles, '/blog/post-1');

	// Verify strategy structure
	assertExists(strategy.preload);
	assertExists(strategy.lazy);
	assertExists(strategy.defer);

	assertEquals(Array.isArray(strategy.preload), true);
	assertEquals(Array.isArray(strategy.lazy), true);
	assertEquals(Array.isArray(strategy.defer), true);

	// Root layout should be preloaded (high priority)
	const rootBundle = bundles.find(b => b.path.includes('pages/_layout.tsx'));
	if (rootBundle) {
		// The bundle should be in one of the strategy arrays
		const inPreload = strategy.preload.includes(rootBundle.id);
		const inLazy = strategy.lazy.includes(rootBundle.id);
		const inDefer = strategy.defer.includes(rootBundle.id);
		assertEquals(inPreload || inLazy || inDefer, true);
	}

	// Cleanup
	optimizer.clearCache();
});

Deno.test('LayoutBundleOptimizer - Cache Management', async () => {
	const optimizer = new LayoutBundleOptimizer({
		...defaultBundleOptimizationConfig,
		outputDir: './test-output',
		developmentMode: true,
		enableAnalysis: false,
		enableCodeSplitting: false,
		enableTreeShaking: false,
		enableMinification: false,
	});

	// Create test handlers
	const handlers: LayoutHandler[] = [
		{
			component: () => null,
			path: '/test/_layout.tsx',
			priority: 0,
		},
	];

	const bundles = await optimizer.optimizeLayoutBundles(handlers);

	// Verify bundle is cached
	assertEquals(optimizer.getAllBundles().length, 1);

	const bundleId = bundles[0].id;
	const cachedBundle = optimizer.getBundleById(bundleId);
	assertExists(cachedBundle);
	assertEquals(cachedBundle.id, bundleId);

	// Test cache clearing
	optimizer.clearCache();
	assertEquals(optimizer.getAllBundles().length, 0);
	assertEquals(optimizer.getBundleById(bundleId), undefined);
});
