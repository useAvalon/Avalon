import { describe, it, expect } from 'vitest';
import {
	analyzeComponentFile,
	analyzeComponentContent,
	shouldHydrate,
	getComponentFramework,
	generateAnalysisSummary,
} from '../../core/components/component-analyzer.ts';

describe('Component Analyzer Integration', () => {
	it('should analyze real component files', () => {
		const svelteContent = `
<script>
  import { onMount } from 'svelte';
  let count = 0;
  function increment() { count += 1; }
  onMount(() => { console.log('mounted'); });
</script>
<button on:click={increment}>{count}</button>
`;
		const report = analyzeComponentContent('SvelteCounter.svelte', svelteContent, { logDecisions: false });
		expect(report.analysis.framework).toEqual('svelte');
		expect(report.analysis.hasScript).toEqual(true);
		expect(report.decision.shouldHydrate).toEqual(true);
		expect(report.metadata).toBeDefined();
	});

	it('should provide quick hydration check', () => {
		const noHydrateContent = `
<div>
  <h1>Static Svelte Component</h1>
  <p>No JavaScript here</p>
</div>
`;
		const report = analyzeComponentContent('TestCounterNoHydrate.svelte', noHydrateContent);
		expect(report.decision.shouldHydrate).toEqual(false);
	});

	it('should detect component framework', () => {
		const vueContent = `
<template>
  <div>{{ count }}</div>
</template>
<script setup>
import { ref } from 'vue'
const count = ref(0)
</script>
`;
		const report = analyzeComponentContent('TestCounter.vue', vueContent);
		expect(report.analysis.framework).toEqual('vue');
	});

	it('should analyze component content directly', () => {
		const vueContent = `
<template>
  <div>Static content</div>
</template>
`;

		const report = analyzeComponentContent('test.vue', vueContent);
		expect(report.analysis.framework).toEqual('vue');
		expect(report.analysis.hasScript).toEqual(false);
		expect(report.decision.shouldHydrate).toEqual(false);
	});

	it('should handle analysis errors gracefully', async () => {
		const shouldHydrateResult = await shouldHydrate('non-existent.vue');
		expect(shouldHydrateResult).toEqual(true); // Defaults to hydrate on error
	});
});

describe('Analysis Summary Generation', () => {
	it('should generate summary statistics', () => {
		const mockReports = new Map();

		mockReports.set('comp1.vue', {
			analysis: { framework: 'vue', hasScript: true, hasHydrateFunction: true, recommendedStrategy: 'hydrate' },
			decision: { shouldHydrate: true, reason: 'test' },
			metadata: {},
		});

		mockReports.set('comp2.svelte', {
			analysis: { framework: 'svelte', hasScript: false, hasHydrateFunction: false, recommendedStrategy: 'ssr-only' },
			decision: { shouldHydrate: false, reason: 'test' },
			metadata: {},
		});

		const summary = generateAnalysisSummary(mockReports);

		expect(summary.total).toEqual(2);
		expect(summary.byFramework.vue).toEqual(1);
		expect(summary.byFramework.svelte).toEqual(1);
		expect(summary.byStrategy.hydrate).toEqual(1);
		expect(summary.byStrategy['ssr-only']).toEqual(1);
	});
});
