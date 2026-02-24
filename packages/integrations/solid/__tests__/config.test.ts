import { describe, expect, it } from 'vitest';
import { solidIntegration } from '../mod.ts';

describe('solidIntegration.config()', () => {
	const cfg = solidIntegration.config();

	it('returns "solid" as the integration name', () => {
		expect(cfg.name).toBe('solid');
	});

	it('declares .tsx, .jsx, .ts, and .js file extensions', () => {
		expect(cfg.fileExtensions).toEqual(['.tsx', '.jsx', '.ts', '.js']);
	});

	it('declares "solid-js" and "solid-js/h" as JSX import sources', () => {
		expect(cfg.jsxImportSources).toContain('solid-js');
		expect(cfg.jsxImportSources).toContain('solid-js/h');
	});

	describe('detection patterns - imports', () => {
		const { imports } = cfg.detectionPatterns;

		it('matches bare "solid-js" import', () => {
			expect(imports.some((r) => r.test('solid-js'))).toBe(true);
		});

		it('matches "solid-js/" subpath import', () => {
			expect(imports.some((r) => r.test('solid-js/web'))).toBe(true);
		});

		it('matches from "solid-js" import statement', () => {
			const code = "import { createSignal } from 'solid-js'";
			expect(imports.some((r) => r.test(code))).toBe(true);
		});

		it('matches from "solid-js/web" import statement', () => {
			const code = "import { hydrate } from 'solid-js/web'";
			expect(imports.some((r) => r.test(code))).toBe(true);
		});

		it('does not match unrelated imports', () => {
			const code = "import { useState } from 'react'";
			expect(imports.some((r) => r.test(code))).toBe(false);
		});
	});

	describe('detection patterns - content', () => {
		const { content } = cfg.detectionPatterns;

		it('matches createSignal', () => {
			expect(content.some((r) => r.test('const [count, setCount] = createSignal(0)'))).toBe(true);
		});

		it('matches createEffect', () => {
			expect(content.some((r) => r.test('createEffect(() => console.log(count()))'))).toBe(true);
		});

		it('matches createMemo', () => {
			expect(content.some((r) => r.test('const doubled = createMemo(() => count() * 2)'))).toBe(true);
		});

		it('matches createResource', () => {
			expect(content.some((r) => r.test('const [data] = createResource(fetchData)'))).toBe(true);
		});

		it('matches Show component', () => {
			expect(content.some((r) => r.test('<Show when={visible()}>'))).toBe(true);
		});

		it('matches For component', () => {
			expect(content.some((r) => r.test('<For each={items()}>'))).toBe(true);
		});

		it('matches .solid. file pattern', () => {
			expect(content.some((r) => r.test('Counter.solid.tsx'))).toBe(true);
		});

		it('does not match unrelated content', () => {
			expect(content.some((r) => r.test('const x = 42'))).toBe(false);
		});
	});
});

describe('solidIntegration.getHydrationScript()', () => {
	const script = solidIntegration.getHydrationScript();

	it('returns a non-empty string', () => {
		expect(script).toBeTruthy();
		expect(typeof script).toBe('string');
		expect(script.length).toBeGreaterThan(0);
	});

	it('contains a query selector for data-framework="solid"', () => {
		expect(script).toContain('data-framework="solid"');
	});

	it('contains dynamic import logic', () => {
		expect(script).toContain('import(');
	});
});
