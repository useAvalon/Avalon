/**
 * Integration tests for module resolution system
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { FrameworkModuleResolver } from '../framework-module-resolver.ts';
import { HydrationRouteHandler, createHydrationRoutes } from '../../../render/routes/hydration-routes.ts';

Deno.test('Module Resolution Integration - End-to-end flow', async t => {
	await t.step('should resolve Solid .tsx to .js for hydration', () => {
		const resolver = new FrameworkModuleResolver('development');

		const result = resolver.resolveModule('/src/islands/Counter.tsx', 'solid', {
			forHydration: true,
		});

		assertEquals(result.originalPath, '/src/islands/Counter.tsx');
		assertEquals(result.resolvedPath, '/src/islands/Counter.js');
		assertEquals(result.framework, 'solid');
		assertEquals(result.shouldTransform, true);
		assertEquals(result.mimeType, 'application/javascript');
		assertEquals(result.url, '/src/islands/Counter.js');
	});

	await t.step('should handle different frameworks correctly', () => {
		const resolver = new FrameworkModuleResolver('production', 'https://cdn.example.com');

		// Test Preact
		const preactResult = resolver.resolveModule('/components/Button.jsx', 'preact', {
			forHydration: true,
		});
		assertEquals(preactResult.resolvedPath, '/components/Button.js');
		assertEquals(preactResult.url, 'https://cdn.example.com/components/Button.js');

		// Test Vue
		const vueResult = resolver.resolveModule('/components/Modal.vue', 'vue', {
			forHydration: true,
		});
		assertEquals(vueResult.resolvedPath, '/components/Modal.js');
		assertEquals(vueResult.mimeType, 'application/javascript');

		// Test Svelte
		const svelteResult = resolver.resolveModule('/components/Card.svelte', 'svelte', {
			forHydration: true,
		});
		assertEquals(svelteResult.resolvedPath, '/components/Card.js');
	});

	await t.step('should create proper hydration routes', () => {
		const routes = createHydrationRoutes(true);

		// Verify we have routes for all the expected patterns
		const patterns = routes.map(route => route.pattern.pathname);

		assertEquals(patterns.includes('/src/islands/*'), true);
		assertEquals(patterns.includes('/src/components/*'), true);
		assertEquals(patterns.includes('*.tsx'), true);
		assertEquals(patterns.includes('*.jsx'), true);
		assertEquals(patterns.includes('*.vue'), true);
		assertEquals(patterns.includes('*.svelte'), true);
	});

	await t.step('should handle development vs production modes', () => {
		const devResolver = new FrameworkModuleResolver('development');
		const prodResolver = new FrameworkModuleResolver('production');

		const testPath = '/src/islands/Counter.tsx';

		const devResult = devResolver.resolveModule(testPath, 'solid', { forHydration: true });
		const prodResult = prodResolver.resolveModule(testPath, 'solid', { forHydration: true });

		// Both should transform the path the same way
		assertEquals(devResult.resolvedPath, prodResult.resolvedPath);
		assertEquals(devResult.resolvedPath, '/src/islands/Counter.js');

		// Mode should be reflected in the resolver
		assertEquals(devResolver.getMode(), 'development');
		assertEquals(prodResolver.getMode(), 'production');
	});
});

Deno.test('Module Resolution Integration - Error scenarios', async t => {
	await t.step('should handle unsupported frameworks gracefully', () => {
		const resolver = new FrameworkModuleResolver();

		let errorThrown = false;
		try {
			resolver.resolveModule('/test.tsx', 'react');
		} catch (error) {
			errorThrown = true;
			assertStringIncludes((error as Error).message, 'Unknown framework: react');
		}

		assertEquals(errorThrown, true);
	});

	await t.step('should handle invalid paths gracefully', () => {
		const resolver = new FrameworkModuleResolver();

		// Should not throw for empty or invalid paths
		const result = resolver.resolveModule('', 'solid', { forHydration: true });
		assertEquals(result.originalPath, '');
		assertEquals(result.resolvedPath, '');
	});

	await t.step('should handle MIME type detection for unknown extensions', () => {
		const resolver = new FrameworkModuleResolver();

		assertEquals(resolver.getMimeType('/test.unknown'), 'text/plain');
		assertEquals(resolver.getMimeType('/test'), 'text/plain');
		assertEquals(resolver.getMimeType(''), 'text/plain');
	});
});

Deno.test('Module Resolution Integration - Performance considerations', async t => {
	await t.step('should handle multiple resolutions efficiently', () => {
		const resolver = new FrameworkModuleResolver();
		const startTime = performance.now();

		// Perform multiple resolutions
		for (let i = 0; i < 100; i++) {
			resolver.resolveModule(`/src/islands/Counter${i}.tsx`, 'solid', {
				forHydration: true,
			});
		}

		const endTime = performance.now();
		const duration = endTime - startTime;

		// Should complete 100 resolutions in reasonable time (less than 100ms)
		assertEquals(duration < 100, true, `Resolution took ${duration}ms, expected < 100ms`);
	});

	await t.step('should cache framework configurations', () => {
		const resolver = new FrameworkModuleResolver();

		// Multiple calls should return the same config object
		const config1 = resolver.getFrameworkConfig('solid');
		const config2 = resolver.getFrameworkConfig('solid');

		assertEquals(config1, config2);
		assertEquals(config1?.extensions.includes('.tsx'), true);
	});
});
