/**
 * Tests for FrameworkModuleResolver
 */

import { assertEquals, assertThrows } from '@std/assert';
import { FrameworkModuleResolver } from '../framework-module-resolver.ts';

Deno.test('FrameworkModuleResolver - Basic functionality', async t => {
	await t.step('should create resolver with default settings', () => {
		const resolver = new FrameworkModuleResolver();
		assertEquals(resolver.getMode(), 'development');
		assertEquals(resolver.getBaseUrl(), '');
	});

	await t.step('should create resolver with custom settings', () => {
		const resolver = new FrameworkModuleResolver('production', 'https://example.com');
		assertEquals(resolver.getMode(), 'production');
		assertEquals(resolver.getBaseUrl(), 'https://example.com');
	});

	await t.step('should update mode and base URL', () => {
		const resolver = new FrameworkModuleResolver();
		resolver.setMode('production');
		resolver.setBaseUrl('https://test.com');
		assertEquals(resolver.getMode(), 'production');
		assertEquals(resolver.getBaseUrl(), 'https://test.com');
	});
});

Deno.test('FrameworkModuleResolver - Framework support', async t => {
	const resolver = new FrameworkModuleResolver();

	await t.step('should support known frameworks', () => {
		assertEquals(resolver.isFrameworkSupported('solid'), true);
		assertEquals(resolver.isFrameworkSupported('preact'), true);
		assertEquals(resolver.isFrameworkSupported('vue'), true);
		assertEquals(resolver.isFrameworkSupported('svelte'), true);
	});

	await t.step('should not support unknown frameworks', () => {
		assertEquals(resolver.isFrameworkSupported('unknown'), false);
		assertEquals(resolver.isFrameworkSupported('react'), false);
	});

	await t.step('should return supported frameworks list', () => {
		const frameworks = resolver.getSupportedFrameworks();
		assertEquals(frameworks.includes('solid'), true);
		assertEquals(frameworks.includes('preact'), true);
		assertEquals(frameworks.includes('vue'), true);
		assertEquals(frameworks.includes('svelte'), true);
	});

	await t.step('should get framework configuration', () => {
		const solidConfig = resolver.getFrameworkConfig('solid');
		assertEquals(solidConfig?.extensions.includes('.tsx'), true);
		assertEquals(solidConfig?.hydrationExtension, '.js');
		assertEquals(solidConfig?.mimeType, 'application/javascript');

		const unknownConfig = resolver.getFrameworkConfig('unknown');
		assertEquals(unknownConfig, undefined);
	});
});

Deno.test('FrameworkModuleResolver - Solid path transformation', async t => {
	const resolver = new FrameworkModuleResolver();

	await t.step('should transform .tsx to .js for Solid hydration', () => {
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

	await t.step('should transform .jsx to .js for Solid hydration', () => {
		const result = resolver.resolveModule('/src/islands/Counter.jsx', 'solid', {
			forHydration: true,
		});

		assertEquals(result.originalPath, '/src/islands/Counter.jsx');
		assertEquals(result.resolvedPath, '/src/islands/Counter.js');
		assertEquals(result.shouldTransform, true);
	});

	await t.step('should not transform non-hydration requests', () => {
		const result = resolver.resolveModule('/src/islands/Counter.tsx', 'solid', {
			forHydration: false,
		});

		assertEquals(result.originalPath, '/src/islands/Counter.tsx');
		assertEquals(result.resolvedPath, '/src/islands/Counter.tsx');
		assertEquals(result.shouldTransform, false);
	});

	await t.step('should not transform .js files', () => {
		const result = resolver.resolveModule('/src/islands/Counter.js', 'solid', {
			forHydration: true,
		});

		assertEquals(result.originalPath, '/src/islands/Counter.js');
		assertEquals(result.resolvedPath, '/src/islands/Counter.js');
		assertEquals(result.shouldTransform, false);
	});
});

Deno.test('FrameworkModuleResolver - Preact path transformation', async t => {
	const resolver = new FrameworkModuleResolver();

	await t.step('should transform .tsx to .js for Preact hydration', () => {
		const result = resolver.resolveModule('/src/islands/Counter.tsx', 'preact', {
			forHydration: true,
		});

		assertEquals(result.originalPath, '/src/islands/Counter.tsx');
		assertEquals(result.resolvedPath, '/src/islands/Counter.js');
		assertEquals(result.framework, 'preact');
		assertEquals(result.shouldTransform, true);
		assertEquals(result.mimeType, 'application/javascript');
	});

	await t.step('should transform .jsx to .js for Preact hydration', () => {
		const result = resolver.resolveModule('/src/islands/Counter.jsx', 'preact', {
			forHydration: true,
		});

		assertEquals(result.resolvedPath, '/src/islands/Counter.js');
		assertEquals(result.shouldTransform, true);
	});
});

Deno.test('FrameworkModuleResolver - Vue path transformation', async t => {
	const resolver = new FrameworkModuleResolver();

	await t.step('should transform .vue to .js for Vue hydration', () => {
		const result = resolver.resolveModule('/src/islands/Counter.vue', 'vue', {
			forHydration: true,
		});

		assertEquals(result.originalPath, '/src/islands/Counter.vue');
		assertEquals(result.resolvedPath, '/src/islands/Counter.js');
		assertEquals(result.framework, 'vue');
		assertEquals(result.shouldTransform, true);
		assertEquals(result.mimeType, 'application/javascript');
	});
});

Deno.test('FrameworkModuleResolver - Svelte path transformation', async t => {
	const resolver = new FrameworkModuleResolver();

	await t.step('should transform .svelte to .js for Svelte hydration', () => {
		const result = resolver.resolveModule('/src/islands/Counter.svelte', 'svelte', {
			forHydration: true,
		});

		assertEquals(result.originalPath, '/src/islands/Counter.svelte');
		assertEquals(result.resolvedPath, '/src/islands/Counter.js');
		assertEquals(result.framework, 'svelte');
		assertEquals(result.shouldTransform, true);
		assertEquals(result.mimeType, 'application/javascript');
	});
});

Deno.test('FrameworkModuleResolver - MIME type detection', async t => {
	const resolver = new FrameworkModuleResolver();

	await t.step('should detect JavaScript MIME types', () => {
		assertEquals(resolver.getMimeType('/test.js'), 'application/javascript');
		assertEquals(resolver.getMimeType('/test.mjs'), 'application/javascript');
		assertEquals(resolver.getMimeType('/test.ts'), 'application/javascript');
		assertEquals(resolver.getMimeType('/test.tsx'), 'application/javascript');
		assertEquals(resolver.getMimeType('/test.jsx'), 'application/javascript');
	});

	await t.step('should detect component MIME types', () => {
		assertEquals(resolver.getMimeType('/test.vue'), 'application/javascript');
		assertEquals(resolver.getMimeType('/test.svelte'), 'application/javascript');
	});

	await t.step('should detect other MIME types', () => {
		assertEquals(resolver.getMimeType('/test.css'), 'text/css');
		assertEquals(resolver.getMimeType('/test.json'), 'application/json');
		assertEquals(resolver.getMimeType('/test.txt'), 'text/plain');
		assertEquals(resolver.getMimeType('/test.unknown'), 'text/plain');
	});
});

Deno.test('FrameworkModuleResolver - URL generation', async t => {
	await t.step('should generate URLs without base URL', () => {
		const resolver = new FrameworkModuleResolver();
		assertEquals(resolver.generateModuleUrl('/src/test.js'), '/src/test.js');
		assertEquals(resolver.generateModuleUrl('src/test.js'), '/src/test.js');
	});

	await t.step('should generate URLs with base URL', () => {
		const resolver = new FrameworkModuleResolver('development', 'https://example.com');
		assertEquals(resolver.generateModuleUrl('/src/test.js'), 'https://example.com/src/test.js');
		assertEquals(resolver.generateModuleUrl('src/test.js'), 'https://example.com/src/test.js');
	});

	await t.step('should handle base URL with trailing slash', () => {
		const resolver = new FrameworkModuleResolver('development', 'https://example.com/');
		assertEquals(resolver.generateModuleUrl('/src/test.js'), 'https://example.com/src/test.js');
	});

	await t.step('should generate URLs with custom base URL option', () => {
		const resolver = new FrameworkModuleResolver();
		const result = resolver.resolveModule('/src/test.tsx', 'solid', {
			forHydration: true,
			baseUrl: 'https://custom.com',
		});
		assertEquals(result.url, 'https://custom.com/src/test.js');
	});
});

Deno.test('FrameworkModuleResolver - Transformation detection', async t => {
	const resolver = new FrameworkModuleResolver();

	await t.step('should detect when transformation is needed', () => {
		assertEquals(resolver.needsTransformation('/test.tsx', 'solid'), true);
		assertEquals(resolver.needsTransformation('/test.jsx', 'solid'), true);
		assertEquals(resolver.needsTransformation('/test.vue', 'vue'), true);
		assertEquals(resolver.needsTransformation('/test.svelte', 'svelte'), true);
	});

	await t.step('should detect when transformation is not needed', () => {
		assertEquals(resolver.needsTransformation('/test.js', 'solid'), false);
		assertEquals(resolver.needsTransformation('/test.css', 'solid'), false);
		assertEquals(resolver.needsTransformation('/test.tsx', 'unknown'), false);
	});
});

Deno.test('FrameworkModuleResolver - Error handling', async t => {
	const resolver = new FrameworkModuleResolver();

	await t.step('should throw error for unknown framework', () => {
		assertThrows(
			() => {
				resolver.resolveModule('/test.tsx', 'unknown');
			},
			Error,
			'Unknown framework: unknown'
		);
	});
});

Deno.test('FrameworkModuleResolver - Development vs Production mode', async t => {
	await t.step('should handle development mode', () => {
		const resolver = new FrameworkModuleResolver('development');
		const result = resolver.resolveModule('/src/test.tsx', 'solid', {
			forHydration: true,
		});
		assertEquals(result.resolvedPath, '/src/test.js');
	});

	await t.step('should handle production mode', () => {
		const resolver = new FrameworkModuleResolver('production');
		const result = resolver.resolveModule('/src/test.tsx', 'solid', {
			forHydration: true,
		});
		assertEquals(result.resolvedPath, '/src/test.js');
	});
});
