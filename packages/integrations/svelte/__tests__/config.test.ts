import { describe, expect, it } from 'vitest';
import { svelteIntegration } from '../mod.ts';

describe('svelteIntegration.config()', () => {
	const cfg = svelteIntegration.config();

	it('returns "svelte" as the integration name', () => {
		expect(cfg.name).toBe('svelte');
	});

	it('declares .svelte file extension', () => {
		expect(cfg.fileExtensions).toEqual(['.svelte']);
	});

	describe('detection patterns - imports', () => {
		const { imports } = cfg.detectionPatterns;

		it('matches bare "svelte" import', () => {
			expect(imports.some((r) => r.test('svelte'))).toBe(true);
		});

		it('matches "svelte/" subpath import', () => {
			expect(imports.some((r) => r.test('svelte/motion'))).toBe(true);
		});

		it('matches "svelte/motion" subpath', () => {
			expect(imports.some((r) => r.test('svelte/motion'))).toBe(true);
		});

		it('does not match unrelated module specifiers', () => {
			expect(imports.some((r) => r.test('react'))).toBe(false);
			expect(imports.some((r) => r.test('vue'))).toBe(false);
		});
	});

	describe('detection patterns - content', () => {
		const { content } = cfg.detectionPatterns;

		it('matches <script> tag', () => {
			expect(content.some((r) => r.test('<script>'))).toBe(true);
		});

		it('matches <script lang="ts"> tag', () => {
			expect(content.some((r) => r.test('<script lang="ts">'))).toBe(true);
		});

		it('matches <style> tag', () => {
			expect(content.some((r) => r.test('<style>'))).toBe(true);
		});

		it('matches Svelte reactive statement $:', () => {
			expect(content.some((r) => r.test('$: doubled = count * 2'))).toBe(true);
		});

		it('matches Svelte template expression ${', () => {
			expect(content.some((r) => r.test('${name}'))).toBe(true);
		});

		it('does not match unrelated content', () => {
			expect(content.some((r) => r.test('const x = 42'))).toBe(false);
		});
	});
});

describe('svelteIntegration.getHydrationScript()', () => {
	const script = svelteIntegration.getHydrationScript();

	it('returns a non-empty string', () => {
		expect(script).toBeTruthy();
		expect(typeof script).toBe('string');
		expect(script.length).toBeGreaterThan(0);
	});

	it('contains a query selector for data-framework="svelte"', () => {
		expect(script).toContain('data-framework="svelte"');
	});

	it('contains dynamic import logic', () => {
		expect(script).toContain('import(');
	});
});
