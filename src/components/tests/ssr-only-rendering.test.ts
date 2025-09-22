import { assertEquals, assertExists, assertStringIncludes } from 'jsr:@std/assert';
import { renderIsland } from '../../islands/island.tsx';
import { renderToString } from 'preact-render-to-string';

Deno.test('SSR-Only Rendering', async t => {
	await t.step('should render Vue component as SSR-only when no hydrate function detected', async () => {
		const result = await renderIsland({
			src: '/examples/StaticComponent.vue',
			condition: 'on:client',
			props: { title: 'Test Title', message: 'Test Message' },
			ssr: true,
			renderOptions: {
				detectScripts: true,
				logDecisions: true,
			},
		});

		const html = renderToString(result);

		// Should have SSR-only strategy
		assertStringIncludes(html, 'data-render-strategy="ssr-only"');

		// Should NOT have hydration attributes
		assertEquals(html.includes('data-hydrate='), false);
		assertEquals(html.includes('data-props='), false);

		// Should have actual content (not empty)
		assertStringIncludes(html, 'Static Component');

		// Should include styles
		assertStringIncludes(html, '<style>');
		assertStringIncludes(html, '.static-component');
	});

	await t.step('should render Svelte component as SSR-only when no hydrate function detected', async () => {
		const result = await renderIsland({
			src: '/examples/TestCounterNoHydrate.svelte',
			condition: 'on:client',
			props: { initialCount: 42 },
			ssr: true,
			renderOptions: {
				detectScripts: true,
				logDecisions: false,
			},
		});

		const html = renderToString(result);

		// Should have SSR-only strategy
		assertStringIncludes(html, 'data-render-strategy="ssr-only"');

		// Should NOT have hydration attributes
		assertEquals(html.includes('data-hydrate='), false);
		assertEquals(html.includes('data-props='), false);

		// Should have actual content (not empty)
		assertStringIncludes(html, 'Svelte Counter');

		// Should include styles
		assertStringIncludes(html, '<style>');
		assertStringIncludes(html, '.svelte-counter');

		// Should have framework attribute
		assertStringIncludes(html, 'data-framework="svelte"');
	});

	await t.step('should respect forceSSROnly option', async () => {
		const result = await renderIsland({
			src: '/examples/TestCounter.vue', // Component that normally would hydrate
			condition: 'on:client',
			props: { initialCount: 5 },
			ssr: true,
			renderOptions: {
				forceSSROnly: true,
				detectScripts: true,
				logDecisions: false,
			},
		});

		const html = renderToString(result);

		// Should be forced to SSR-only despite having hydrate function
		assertStringIncludes(html, 'data-render-strategy="ssr-only"');

		// Should NOT have hydration attributes
		assertEquals(html.includes('data-hydrate='), false);
		assertEquals(html.includes('data-props='), false);
	});

	await t.step('should handle components without script sections as SSR-only', async () => {
		const result = await renderIsland({
			src: '/examples/StaticComponent.vue',
			condition: 'on:client',
			props: {},
			ssr: true,
			renderOptions: {
				detectScripts: true,
				logDecisions: false,
			},
		});

		const html = renderToString(result);

		// Should be SSR-only
		assertStringIncludes(html, 'data-render-strategy="ssr-only"');

		// Should have content and styles
		assertStringIncludes(html, 'Static Component');
		assertStringIncludes(html, '<style>');
	});

	await t.step('should generate clean HTML without unnecessary attributes', async () => {
		const result = await renderIsland({
			src: '/examples/StaticComponent.vue',
			condition: 'on:client',
			props: {},
			ssr: true,
			renderOptions: {
				detectScripts: true,
				logDecisions: false,
			},
		});

		const html = renderToString(result);

		// Should NOT have unnecessary debug attributes
		assertEquals(html.includes('data-ssr-reason='), false);
		assertEquals(html.includes('data-hydrate-reason='), false);

		// Should have clean, minimal attributes
		assertStringIncludes(html, 'data-render-strategy="ssr-only"');
		assertExists(html.match(/id="island-[^"]+"/)); // Should have deterministic ID
	});
});
