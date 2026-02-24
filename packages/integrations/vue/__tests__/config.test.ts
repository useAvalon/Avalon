import { describe, expect, it } from 'vitest';
import { vueIntegration } from '../mod.ts';

describe('vueIntegration.config()', () => {
	const cfg = vueIntegration.config();

	it('returns "vue" as the integration name', () => {
		expect(cfg.name).toBe('vue');
	});

	it('declares .vue file extension', () => {
		expect(cfg.fileExtensions).toEqual(['.vue']);
	});

	describe('detection patterns - imports', () => {
		const { imports } = cfg.detectionPatterns;

		it('matches bare "vue" import', () => {
			expect(imports.some((r) => r.test('vue'))).toBe(true);
		});

		it('matches "vue/" subpath import', () => {
			expect(imports.some((r) => r.test('vue/server-renderer'))).toBe(true);
		});

		it('matches from "vue" import statement', () => {
			const code = "import { ref } from 'vue'";
			expect(imports.some((r) => r.test(code))).toBe(true);
		});

		it('does not match unrelated imports', () => {
			const code = "import { render } from 'react'";
			expect(imports.some((r) => r.test(code))).toBe(false);
		});
	});

	describe('detection patterns - content', () => {
		const { content } = cfg.detectionPatterns;

		it('matches <template> tag', () => {
			expect(content.some((r) => r.test('<template>'))).toBe(true);
		});

		it('matches <script setup> tag', () => {
			expect(content.some((r) => r.test('<script setup>'))).toBe(true);
		});

		it('matches <script lang="ts" setup> tag', () => {
			expect(content.some((r) => r.test('<script lang="ts" setup>'))).toBe(true);
		});

		it('matches defineComponent API', () => {
			expect(content.some((r) => r.test('defineComponent({ })'))).toBe(true);
		});

		it('matches ref API', () => {
			expect(content.some((r) => r.test('const count = ref(0)'))).toBe(true);
		});

		it('matches reactive API', () => {
			expect(content.some((r) => r.test('const state = reactive({})'))).toBe(true);
		});

		it('matches computed API', () => {
			expect(content.some((r) => r.test('const doubled = computed(() => count.value * 2)'))).toBe(true);
		});

		it('does not match unrelated content', () => {
			expect(content.some((r) => r.test('const x = 42'))).toBe(false);
		});
	});
});

describe('vueIntegration.getHydrationScript()', () => {
	const script = vueIntegration.getHydrationScript();

	it('returns a non-empty string', () => {
		expect(script).toBeTruthy();
		expect(typeof script).toBe('string');
		expect(script.length).toBeGreaterThan(0);
	});

	it('contains a query selector for data-framework="vue"', () => {
		expect(script).toContain('data-framework="vue"');
	});

	it('contains dynamic import logic', () => {
		expect(script).toContain('import(');
	});
});
