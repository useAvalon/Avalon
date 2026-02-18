/**
 * Tests for FrameworkModuleResolver
 */

import { describe, it, expect } from 'vitest';
import { FrameworkModuleResolver } from '../framework-module-resolver.ts';

describe('FrameworkModuleResolver - Basic functionality', () => {
	it('should create resolver with default settings', () => {
		const resolver = new FrameworkModuleResolver();
		expect(resolver.getMode()).toEqual('development');
		expect(resolver.getBaseUrl()).toEqual('');
	});

	it('should create resolver with custom settings', () => {
		const resolver = new FrameworkModuleResolver('production', 'https://example.com');
		expect(resolver.getMode()).toEqual('production');
		expect(resolver.getBaseUrl()).toEqual('https://example.com');
	});

	it('should update mode and base URL', () => {
		const resolver = new FrameworkModuleResolver();
		resolver.setMode('production');
		resolver.setBaseUrl('https://test.com');
		expect(resolver.getMode()).toEqual('production');
		expect(resolver.getBaseUrl()).toEqual('https://test.com');
	});
});

describe('FrameworkModuleResolver - Framework support', () => {
	const resolver = new FrameworkModuleResolver();

	it('should support known frameworks', () => {
		expect(resolver.isFrameworkSupported('solid')).toEqual(true);
		expect(resolver.isFrameworkSupported('preact')).toEqual(true);
		expect(resolver.isFrameworkSupported('vue')).toEqual(true);
		expect(resolver.isFrameworkSupported('svelte')).toEqual(true);
	});

	it('should not support unknown frameworks', () => {
		expect(resolver.isFrameworkSupported('unknown')).toEqual(false);
		expect(resolver.isFrameworkSupported('react')).toEqual(false);
	});

	it('should return supported frameworks list', () => {
		const frameworks = resolver.getSupportedFrameworks();
		expect(frameworks.includes('solid')).toEqual(true);
		expect(frameworks.includes('preact')).toEqual(true);
		expect(frameworks.includes('vue')).toEqual(true);
		expect(frameworks.includes('svelte')).toEqual(true);
	});

	it('should get framework configuration', () => {
		const solidConfig = resolver.getFrameworkConfig('solid');
		expect(solidConfig?.extensions.includes('.tsx')).toEqual(true);
		expect(solidConfig?.hydrationExtension).toEqual('.js');
		expect(solidConfig?.mimeType).toEqual('application/javascript');

		const unknownConfig = resolver.getFrameworkConfig('unknown');
		expect(unknownConfig).toEqual(undefined);
	});
});

describe('FrameworkModuleResolver - Solid path transformation', () => {
	const resolver = new FrameworkModuleResolver();

	it('should transform .tsx to .js for Solid hydration', () => {
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

	it('should transform .jsx to .js for Solid hydration', () => {
		const result = resolver.resolveModule('/src/islands/Counter.jsx', 'solid', {
			forHydration: true,
		});

		expect(result.originalPath).toEqual('/src/islands/Counter.jsx');
		expect(result.resolvedPath).toEqual('/src/islands/Counter.js');
		expect(result.shouldTransform).toEqual(true);
	});

	it('should not transform non-hydration requests', () => {
		const result = resolver.resolveModule('/src/islands/Counter.tsx', 'solid', {
			forHydration: false,
		});

		expect(result.originalPath).toEqual('/src/islands/Counter.tsx');
		expect(result.resolvedPath).toEqual('/src/islands/Counter.tsx');
		expect(result.shouldTransform).toEqual(false);
	});

	it('should not transform .js files', () => {
		const result = resolver.resolveModule('/src/islands/Counter.js', 'solid', {
			forHydration: true,
		});

		expect(result.originalPath).toEqual('/src/islands/Counter.js');
		expect(result.resolvedPath).toEqual('/src/islands/Counter.js');
		expect(result.shouldTransform).toEqual(false);
	});
});

describe('FrameworkModuleResolver - Preact path transformation', () => {
	const resolver = new FrameworkModuleResolver();

	it('should transform .tsx to .js for Preact hydration', () => {
		const result = resolver.resolveModule('/src/islands/Counter.tsx', 'preact', {
			forHydration: true,
		});

		expect(result.originalPath).toEqual('/src/islands/Counter.tsx');
		expect(result.resolvedPath).toEqual('/src/islands/Counter.js');
		expect(result.framework).toEqual('preact');
		expect(result.shouldTransform).toEqual(true);
		expect(result.mimeType).toEqual('application/javascript');
	});

	it('should transform .jsx to .js for Preact hydration', () => {
		const result = resolver.resolveModule('/src/islands/Counter.jsx', 'preact', {
			forHydration: true,
		});

		expect(result.resolvedPath).toEqual('/src/islands/Counter.js');
		expect(result.shouldTransform).toEqual(true);
	});
});

describe('FrameworkModuleResolver - Vue path transformation', () => {
	const resolver = new FrameworkModuleResolver();

	it('should transform .vue to .js for Vue hydration', () => {
		const result = resolver.resolveModule('/src/islands/Counter.vue', 'vue', {
			forHydration: true,
		});

		expect(result.originalPath).toEqual('/src/islands/Counter.vue');
		expect(result.resolvedPath).toEqual('/src/islands/Counter.js');
		expect(result.framework).toEqual('vue');
		expect(result.shouldTransform).toEqual(true);
		expect(result.mimeType).toEqual('application/javascript');
	});
});

describe('FrameworkModuleResolver - Svelte path transformation', () => {
	const resolver = new FrameworkModuleResolver();

	it('should transform .svelte to .js for Svelte hydration', () => {
		const result = resolver.resolveModule('/src/islands/Counter.svelte', 'svelte', {
			forHydration: true,
		});

		expect(result.originalPath).toEqual('/src/islands/Counter.svelte');
		expect(result.resolvedPath).toEqual('/src/islands/Counter.js');
		expect(result.framework).toEqual('svelte');
		expect(result.shouldTransform).toEqual(true);
		expect(result.mimeType).toEqual('application/javascript');
	});
});

describe('FrameworkModuleResolver - MIME type detection', () => {
	const resolver = new FrameworkModuleResolver();

	it('should detect JavaScript MIME types', () => {
		expect(resolver.getMimeType('/test.js')).toEqual('application/javascript');
		expect(resolver.getMimeType('/test.mjs')).toEqual('application/javascript');
		expect(resolver.getMimeType('/test.ts')).toEqual('application/javascript');
		expect(resolver.getMimeType('/test.tsx')).toEqual('application/javascript');
		expect(resolver.getMimeType('/test.jsx')).toEqual('application/javascript');
	});

	it('should detect component MIME types', () => {
		expect(resolver.getMimeType('/test.vue')).toEqual('application/javascript');
		expect(resolver.getMimeType('/test.svelte')).toEqual('application/javascript');
	});

	it('should detect other MIME types', () => {
		expect(resolver.getMimeType('/test.css')).toEqual('text/css');
		expect(resolver.getMimeType('/test.json')).toEqual('application/json');
		expect(resolver.getMimeType('/test.txt')).toEqual('text/plain');
		expect(resolver.getMimeType('/test.unknown')).toEqual('text/plain');
	});
});

describe('FrameworkModuleResolver - URL generation', () => {
	it('should generate URLs without base URL', () => {
		const resolver = new FrameworkModuleResolver();
		expect(resolver.generateModuleUrl('/src/test.js')).toEqual('/src/test.js');
		expect(resolver.generateModuleUrl('src/test.js')).toEqual('/src/test.js');
	});

	it('should generate URLs with base URL', () => {
		const resolver = new FrameworkModuleResolver('development', 'https://example.com');
		expect(resolver.generateModuleUrl('/src/test.js')).toEqual('https://example.com/src/test.js');
		expect(resolver.generateModuleUrl('src/test.js')).toEqual('https://example.com/src/test.js');
	});

	it('should handle base URL with trailing slash', () => {
		const resolver = new FrameworkModuleResolver('development', 'https://example.com/');
		expect(resolver.generateModuleUrl('/src/test.js')).toEqual('https://example.com/src/test.js');
	});

	it('should generate URLs with custom base URL option', () => {
		const resolver = new FrameworkModuleResolver();
		const result = resolver.resolveModule('/src/test.tsx', 'solid', {
			forHydration: true,
			baseUrl: 'https://custom.com',
		});
		expect(result.url).toEqual('https://custom.com/src/test.js');
	});
});

describe('FrameworkModuleResolver - Transformation detection', () => {
	const resolver = new FrameworkModuleResolver();

	it('should detect when transformation is needed', () => {
		expect(resolver.needsTransformation('/test.tsx', 'solid')).toEqual(true);
		expect(resolver.needsTransformation('/test.jsx', 'solid')).toEqual(true);
		expect(resolver.needsTransformation('/test.vue', 'vue')).toEqual(true);
		expect(resolver.needsTransformation('/test.svelte', 'svelte')).toEqual(true);
	});

	it('should detect when transformation is not needed', () => {
		expect(resolver.needsTransformation('/test.js', 'solid')).toEqual(false);
		expect(resolver.needsTransformation('/test.css', 'solid')).toEqual(false);
		expect(resolver.needsTransformation('/test.tsx', 'unknown')).toEqual(false);
	});
});

describe('FrameworkModuleResolver - Error handling', () => {
	const resolver = new FrameworkModuleResolver();

	it('should throw error for unknown framework', () => {
		expect(() => {
			resolver.resolveModule('/test.tsx', 'unknown');
		}).toThrow('Unknown framework: unknown');
	});
});

describe('FrameworkModuleResolver - Development vs Production mode', () => {
	it('should handle development mode', () => {
		const resolver = new FrameworkModuleResolver('development');
		const result = resolver.resolveModule('/src/test.tsx', 'solid', {
			forHydration: true,
		});
		expect(result.resolvedPath).toEqual('/src/test.js');
	});

	it('should handle production mode', () => {
		const resolver = new FrameworkModuleResolver('production');
		const result = resolver.resolveModule('/src/test.tsx', 'solid', {
			forHydration: true,
		});
		expect(result.resolvedPath).toEqual('/src/test.js');
	});
});
