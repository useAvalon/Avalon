import { assertEquals } from 'jsr:@std/assert';
import { analyzeComponent } from '../../core/components/component-detection.ts';

// Read real component files
const svelteWithHydrate = await Deno.readTextFile('./examples/SvelteCounter.svelte');
const svelteWithoutHydrate = await Deno.readTextFile('./examples/TestCounterNoHydrate.svelte');
const vueWithHydrate = await Deno.readTextFile('./examples/TestCounter.vue');

Deno.test('Real Component Detection', async t => {
	await t.step('should correctly analyze SvelteCounter.svelte (with hydrate)', () => {
		const analysis = analyzeComponent('examples/SvelteCounter.svelte', svelteWithHydrate);

		assertEquals(analysis.framework, 'svelte');
		assertEquals(analysis.hasScript, true);
		assertEquals(analysis.hasHydrateFunction, true);
		assertEquals(analysis.recommendedStrategy, 'hydrate');
	});

	await t.step('should correctly analyze TestCounterNoHydrate.svelte (without hydrate)', () => {
		const analysis = analyzeComponent('examples/TestCounterNoHydrate.svelte', svelteWithoutHydrate);

		assertEquals(analysis.framework, 'svelte');
		assertEquals(analysis.hasScript, true);
		assertEquals(analysis.hasHydrateFunction, false);
		assertEquals(analysis.recommendedStrategy, 'ssr-only'); // Default to SSR-only unless explicit hydrate function
	});

	await t.step('should correctly analyze TestCounter.vue (with hydrate)', () => {
		const analysis = analyzeComponent('examples/TestCounter.vue', vueWithHydrate);

		assertEquals(analysis.framework, 'vue');
		assertEquals(analysis.hasScript, true);
		assertEquals(analysis.hasHydrateFunction, true);
		assertEquals(analysis.recommendedStrategy, 'hydrate');
	});
});
