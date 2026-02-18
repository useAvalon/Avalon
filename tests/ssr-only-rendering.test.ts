import { describe, it, expect } from 'vitest';
import { renderIsland } from '../packages/avalon/src/islands/island.tsx';
import { renderToString } from 'preact-render-to-string';

describe('SSR-Only Rendering', () => {
	it('should render Vue component as SSR-only when no hydrate function detected', async () => {
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

		expect(html).toContain('data-render-strategy="ssr-only"');
		expect(html.includes('data-hydrate=')).toEqual(false);
		expect(html.includes('data-props=')).toEqual(false);
		expect(html).toContain('Static Component');
		expect(html).toContain('<style>');
		expect(html).toContain('.static-component');
	});

	it('should render Svelte component as SSR-only when no hydrate function detected', async () => {
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

		expect(html).toContain('data-render-strategy="ssr-only"');
		expect(html.includes('data-hydrate=')).toEqual(false);
		expect(html.includes('data-props=')).toEqual(false);
		expect(html).toContain('Svelte Counter');
		expect(html).toContain('<style>');
		expect(html).toContain('.svelte-counter');
		expect(html).toContain('data-framework="svelte"');
	});

	it('should respect forceSSROnly option', async () => {
		const result = await renderIsland({
			src: '/examples/TestCounter.vue',
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

		expect(html).toContain('data-render-strategy="ssr-only"');
		expect(html.includes('data-hydrate=')).toEqual(false);
		expect(html.includes('data-props=')).toEqual(false);
	});

	it('should handle components without script sections as SSR-only', async () => {
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

		expect(html).toContain('data-render-strategy="ssr-only"');
		expect(html).toContain('Static Component');
		expect(html).toContain('<style>');
	});

	it('should generate clean HTML without unnecessary attributes', async () => {
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

		expect(html.includes('data-ssr-reason=')).toEqual(false);
		expect(html.includes('data-hydrate-reason=')).toEqual(false);
		expect(html).toContain('data-render-strategy="ssr-only"');
		expect(html.match(/id="island-[^"]+"/)).toBeDefined();
	});
});
