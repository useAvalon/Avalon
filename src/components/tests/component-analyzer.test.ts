import { assertEquals, assertExists } from 'jsr:@std/assert';
import {
	analyzeComponentFile,
	analyzeComponentContent,
	shouldHydrate,
	getComponentFramework,
	generateAnalysisSummary,
} from '../../core/components/component-analyzer.ts';

Deno.test('Component Analyzer Integration', async t => {
	await t.step('should analyze real component files', async () => {
		const report = await analyzeComponentFile('examples/SvelteCounter.svelte', { logDecisions: false });

		assertEquals(report.analysis.framework, 'svelte');
		assertEquals(report.analysis.hasScript, true);
		assertEquals(report.analysis.hasHydrateFunction, true);
		assertEquals(report.decision.shouldHydrate, true);
		assertExists(report.metadata);
	});

	await t.step('should provide quick hydration check', async () => {
		const shouldHydrateResult = await shouldHydrate('examples/TestCounterNoHydrate.svelte');
		assertEquals(shouldHydrateResult, false); // Has script but no hydrate function, defaults to SSR-only
	});

	await t.step('should detect component framework', async () => {
		const framework = await getComponentFramework('examples/TestCounter.vue');
		assertEquals(framework, 'vue');
	});

	await t.step('should analyze component content directly', () => {
		const vueContent = `
<template>
  <div>Static content</div>
</template>
`;

		const report = analyzeComponentContent('test.vue', vueContent);
		assertEquals(report.analysis.framework, 'vue');
		assertEquals(report.analysis.hasScript, false);
		assertEquals(report.decision.shouldHydrate, false);
	});

	await t.step('should handle analysis errors gracefully', async () => {
		// Test with non-existent file
		const shouldHydrateResult = await shouldHydrate('non-existent.vue');
		assertEquals(shouldHydrateResult, true); // Defaults to hydrate on error
	});
});

Deno.test('Analysis Summary Generation', async t => {
	await t.step('should generate summary statistics', () => {
		const mockReports = new Map();

		// Add some mock reports
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

		assertEquals(summary.total, 2);
		assertEquals(summary.byFramework.vue, 1);
		assertEquals(summary.byFramework.svelte, 1);
		assertEquals(summary.byStrategy.hydrate, 1);
		assertEquals(summary.byStrategy['ssr-only'], 1);
	});
});
