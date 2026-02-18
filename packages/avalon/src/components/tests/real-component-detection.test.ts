import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { analyzeComponent } from '../../core/components/component-detection.ts';

// Read real component files
const svelteWithHydrate = await readFile('./examples/SvelteCounter.svelte', 'utf-8');
const svelteWithoutHydrate = await readFile('./examples/TestCounterNoHydrate.svelte', 'utf-8');
const vueWithHydrate = await readFile('./examples/TestCounter.vue', 'utf-8');

describe('Real Component Detection', () => {
	it('should correctly analyze SvelteCounter.svelte (with hydrate)', () => {
		const analysis = analyzeComponent('examples/SvelteCounter.svelte', svelteWithHydrate);

		expect(analysis.framework).toEqual('svelte');
		expect(analysis.hasScript).toEqual(true);
		expect(analysis.hasHydrateFunction).toEqual(true);
		expect(analysis.recommendedStrategy).toEqual('hydrate');
	});

	it('should correctly analyze TestCounterNoHydrate.svelte (without hydrate)', () => {
		const analysis = analyzeComponent('examples/TestCounterNoHydrate.svelte', svelteWithoutHydrate);

		expect(analysis.framework).toEqual('svelte');
		expect(analysis.hasScript).toEqual(true);
		expect(analysis.hasHydrateFunction).toEqual(false);
		expect(analysis.recommendedStrategy).toEqual('ssr-only');
	});

	it('should correctly analyze TestCounter.vue (with hydrate)', () => {
		const analysis = analyzeComponent('examples/TestCounter.vue', vueWithHydrate);

		expect(analysis.framework).toEqual('vue');
		expect(analysis.hasScript).toEqual(true);
		expect(analysis.hasHydrateFunction).toEqual(true);
		expect(analysis.recommendedStrategy).toEqual('hydrate');
	});
});
