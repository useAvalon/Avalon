import { describe, it, expect } from 'vitest';
import {
	analyzeComponentFile,
	analyzeComponentContent,
	shouldHydrate,
	getComponentFramework,
	generateAnalysisSummary,
} from '../../core/components/component-analyzer.ts';

describe('Component Analyzer Integration', () => {
	it('should analyze real component files', async () => {
		const report = await analyzeComponentFile('examples/SvelteCounter.svelte', { logDecisions: false });
		expect(report.analysis.framework).toEqual('svelte');
		expect(report.analysis.hasScript).toEqual(true);
		expect(report.analysis.hasHydrateFunction).toEqual(true);
		expect(report.decision.shouldHydrate).toEqual(true);
		expect(report.metadata).toBeDefined();
	});

	it('should provide quick hydration check', async () => {
		const shouldHydrateResult = await shouldHydrate('examples/TestCounterNoHydrate.svelte');
		expect(shouldHydrateResult).toEqual(false);
	});

	it('should detect component framework', async () => {
		const framework = await getComponentFramework('examples/TestCounter.vue');
		expect(framework).toEqual('vue');
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
