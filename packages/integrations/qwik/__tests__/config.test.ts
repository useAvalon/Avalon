import { describe, expect, it } from 'vitest';
import { qwikIntegration } from '../mod.ts';

describe('qwikIntegration.config()', () => {
	const cfg = qwikIntegration.config();

	it('returns "qwik" as the integration name', () => {
		expect(cfg.name).toBe('qwik');
	});

	it('declares .tsx, .jsx, .ts, and .js file extensions', () => {
		expect(cfg.fileExtensions).toEqual(['.tsx', '.jsx', '.ts', '.js']);
	});

	it('declares "@builder.io/qwik" as JSX import source', () => {
		expect(cfg.jsxImportSources).toContain('@builder.io/qwik');
	});

	describe('detection patterns - imports', () => {
		const { imports } = cfg.detectionPatterns;

		it('matches bare "@builder.io/qwik" import', () => {
			expect(imports.some((r) => r.test('@builder.io/qwik'))).toBe(true);
		});

		it('matches "@builder.io/qwik/" subpath import', () => {
			expect(imports.some((r) => r.test('@builder.io/qwik/server'))).toBe(true);
		});

		it('matches from "@builder.io/qwik" import statement', () => {
			const code = "import { component$ } from '@builder.io/qwik'";
			expect(imports.some((r) => r.test(code))).toBe(true);
		});

		it('matches from "@builder.io/qwik/server" import statement', () => {
			const code = "import { renderToString } from '@builder.io/qwik/server'";
			expect(imports.some((r) => r.test(code))).toBe(true);
		});

		it('does not match unrelated imports', () => {
			const code = "import { useState } from 'react'";
			expect(imports.some((r) => r.test(code))).toBe(false);
		});
	});

	describe('detection patterns - content', () => {
		const { content } = cfg.detectionPatterns;

		it('matches component$', () => {
			expect(content.some((r) => r.test('export const Counter = component$(() => {'))).toBe(true);
		});

		it('matches useSignal', () => {
			expect(content.some((r) => r.test('const count = useSignal(0)'))).toBe(true);
		});

		it('matches useStore', () => {
			expect(content.some((r) => r.test('const state = useStore({ count: 0 })'))).toBe(true);
		});

		it('matches useTask$', () => {
			expect(content.some((r) => r.test('useTask$(() => { console.log("task") })'))).toBe(true);
		});

		it('matches useVisibleTask$', () => {
			expect(content.some((r) => r.test('useVisibleTask$(() => { document.title = "hi" })'))).toBe(true);
		});

		it('matches useResource$', () => {
			expect(content.some((r) => r.test('const data = useResource$(() => fetch("/api"))'))).toBe(true);
		});

		it('matches .qwik. file pattern', () => {
			expect(content.some((r) => r.test('Counter.qwik.tsx'))).toBe(true);
		});

		it('does not match unrelated content', () => {
			expect(content.some((r) => r.test('const x = 42'))).toBe(false);
		});
	});
});

describe('qwikIntegration.getHydrationScript()', () => {
	const script = qwikIntegration.getHydrationScript();

	it('returns a non-empty string', () => {
		expect(script).toBeTruthy();
		expect(typeof script).toBe('string');
		expect(script.length).toBeGreaterThan(0);
	});

	it('contains a query selector for data-framework="qwik"', () => {
		expect(script).toContain('data-framework="qwik"');
	});

	it('contains dynamic import logic', () => {
		expect(script).toContain('import(');
	});

	it('references q:container for resumability detection', () => {
		expect(script).toContain('q:container');
	});
});
