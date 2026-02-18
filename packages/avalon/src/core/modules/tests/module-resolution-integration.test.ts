/**
 * Integration tests for module resolution system
 */

import { describe, it, expect } from 'vitest';
import { FrameworkModuleResolver } from '../framework-module-resolver.ts';
import { HydrationRouteHandler, createHydrationRoutes } from '../../../render/routes/hydration-routes.ts';

describe('Module Resolution Integration - End-to-end flow', () => {
	it('should resolve Solid .tsx to .js for hydration', () => {
		const resolver = new FrameworkModuleResolver('development');

		const result = resolver.resolveModule('/src/islands/Counter.tsx', 'solid', {
			forHydration: true,
		});

		expect(result.originalPath).toEqual('/src/islands/Counter.tsx');
		expect(result.resolvedPath).toEqual('/src/islands/Counter.js');
		expect(result.framework).toEqual('solid');
		expect(result.shouldTransform).toEqual(true);
		expect(result.mimeType).toEqual('application/javascript');
		expect(result.url).toEqual('/src/islands/Counter.js');
	});

	it('should handle different frameworks correctly', () => {
		const resolver = new FrameworkModuleResolver('production', 'https://cdn.example.com');

		// Test Preact
		const preactResult = resolver.resolveModule('/components/Button.jsx', 'preact', {
			forHydration: true,
		});
		expect(preactResult.resolvedPath).toEqual('/components/Button.js');
		expect(preactResult.url).toEqual('https://cdn.example.com/components/Button.js');

		// Test Vue
		const vueResult = resolver.resolveModule('/components/Modal.vue', 'vue', {
			forHydration: true,
		});
		expect(vueResult.resolvedPath).toEqual('/components/Modal.js');
		expect(vueResult.mimeType).toEqual('application/javascript');

		// Test Svelte
		const svelteResult = resolver.resolveModule('/components/Card.svelte', 'svelte', {
			forHydration: true,
		});
		expect(svelteResult.resolvedPath).toEqual('/components/Card.js');
	});

	it('should create proper hydration routes', () => {
		const routes = createHydrationRoutes(true);

		const patterns = routes.map(route => route.pattern.pathname);

		expect(patterns.includes('/src/islands/*')).toEqual(true);
		expect(patterns.includes('/src/components/*')).toEqual(true);
		expect(patterns.includes('*.tsx')).toEqual(true);
		expect(patterns.includes('*.jsx')).toEqual(true);
		expect(patterns.includes('*.vue')).toEqual(true);
		expect(patterns.includes('*.svelte')).toEqual(true);
	});

	it('should handle development vs production modes', () => {
		const devResolver = new FrameworkModuleResolver('development');
		const prodResolver = new FrameworkModuleResolver('production');

		const testPath = '/src/islands/Counter.tsx';

		const devResult = devResolver.resolveModule(testPath, 'solid', { forHydration: true });
		const prodResult = prodResolver.resolveModule(testPath, 'solid', { forHydration: true });

		expect(devResult.resolvedPath).toEqual(prodResult.resolvedPath);
		expect(devResult.resolvedPath).toEqual('/src/islands/Counter.js');

		expect(devResolver.getMode()).toEqual('development');
		expect(prodResolver.getMode()).toEqual('production');
	});
});

describe('Module Resolution Integration - Error scenarios', () => {
	it('should handle unsupported frameworks gracefully', () => {
		const resolver = new FrameworkModuleResolver();

		expect(() => {
			resolver.resolveModule('/test.tsx', 'react');
		}).toThrow('Unknown framework: react');
	});

	it('should handle invalid paths gracefully', () => {
		const resolver = new FrameworkModuleResolver();

		const result = resolver.resolveModule('', 'solid', { forHydration: true });
		expect(result.originalPath).toEqual('');
		expect(result.resolvedPath).toEqual('');
	});

	it('should handle MIME type detection for unknown extensions', () => {
		const resolver = new FrameworkModuleResolver();

		expect(resolver.getMimeType('/test.unknown')).toEqual('text/plain');
		expect(resolver.getMimeType('/test')).toEqual('text/plain');
		expect(resolver.getMimeType('')).toEqual('text/plain');
	});
});

describe('Module Resolution Integration - Performance considerations', () => {
	it('should handle multiple resolutions efficiently', () => {
		const resolver = new FrameworkModuleResolver();
		const startTime = performance.now();

		for (let i = 0; i < 100; i++) {
			resolver.resolveModule(`/src/islands/Counter${i}.tsx`, 'solid', {
				forHydration: true,
			});
		}

		const endTime = performance.now();
		const duration = endTime - startTime;

		expect(duration < 100).toEqual(true);
	});

	it('should cache framework configurations', () => {
		const resolver = new FrameworkModuleResolver();

		const config1 = resolver.getFrameworkConfig('solid');
		const config2 = resolver.getFrameworkConfig('solid');

		expect(config1).toEqual(config2);
		expect(config1?.extensions.includes('.tsx')).toEqual(true);
	});
});
