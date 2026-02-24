import { describe, expect, it } from 'vitest';
import {
	scopeCss,
	minifyCss,
	combineCss,
	generateScopeId,
	processCssForProduction,
} from '../server/css-collector.ts';

describe('scopeCss', () => {
	it('adds scope attribute to a simple selector', () => {
		const css = '.foo { color: red; }';
		const result = scopeCss(css, 'svelte-abc123');
		expect(result).toContain('.foo[svelte-abc123]');
		expect(result).toContain('color: red;');
	});

	it('scopes element selectors', () => {
		const css = 'h1 { font-size: 2em; }';
		const result = scopeCss(css, 'svelte-xyz');
		expect(result).toContain('h1[svelte-xyz]');
	});

	it('scopes compound selectors', () => {
		const css = '.parent .child { display: flex; }';
		const result = scopeCss(css, 'svelte-s1');
		expect(result).toContain('.parent .child[svelte-s1]');
	});

	it('skips @media at-rules', () => {
		const css = '@media (max-width: 600px) { .foo { color: red; } }';
		const result = scopeCss(css, 'svelte-abc');
		expect(result).toMatch(/@media\s*\(max-width:\s*600px\)/);
	});

	it('skips @keyframes at-rules', () => {
		const css = '@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }';
		const result = scopeCss(css, 'svelte-abc');
		expect(result).toContain('@keyframes fadeIn');
	});

	it('returns empty string for empty CSS', () => {
		expect(scopeCss('', 'svelte-abc')).toBe('');
	});
});

describe('minifyCss', () => {
	it('removes CSS comments', () => {
		const css = '/* comment */ .foo { color: red; }';
		const result = minifyCss(css);
		expect(result).not.toContain('/*');
		expect(result).not.toContain('*/');
		expect(result).not.toContain('comment');
	});

	it('removes multi-line comments', () => {
		const css = `
			/* 
			 * multi-line
			 * comment
			 */
			.bar { margin: 0; }
		`;
		const result = minifyCss(css);
		expect(result).not.toContain('/*');
		expect(result).not.toContain('multi-line');
		expect(result).toContain('.bar');
	});

	it('collapses whitespace', () => {
		const css = '.foo  {  color:  red;  }';
		const result = minifyCss(css);
		expect(result).not.toContain('  ');
	});

	it('removes whitespace around braces, colons, semicolons', () => {
		const css = '.foo { color : red ; }';
		const result = minifyCss(css);
		expect(result).toBe('.foo{color:red;}');
	});

	it('trims leading and trailing whitespace', () => {
		const css = '   .foo { color: red; }   ';
		const result = minifyCss(css);
		expect(result).toBe(result.trim());
	});
});

describe('combineCss', () => {
	it('concatenates non-null results', () => {
		const results = [
			{ code: '.a { color: red; }' },
			{ code: '.b { color: blue; }' },
		];
		const result = combineCss(results);
		expect(result).toContain('.a { color: red; }');
		expect(result).toContain('.b { color: blue; }');
	});

	it('filters out null entries', () => {
		const results = [
			{ code: '.a { color: red; }' },
			null,
			{ code: '.b { color: blue; }' },
			null,
		];
		const result = combineCss(results);
		expect(result).toContain('.a { color: red; }');
		expect(result).toContain('.b { color: blue; }');
	});

	it('returns empty string when all entries are null', () => {
		expect(combineCss([null, null])).toBe('');
	});

	it('returns empty string for empty array', () => {
		expect(combineCss([])).toBe('');
	});

	it('joins results with newline separator', () => {
		const results = [
			{ code: '.a {}' },
			{ code: '.b {}' },
		];
		const result = combineCss(results);
		expect(result).toBe('.a {}\n.b {}');
	});
});

describe('generateScopeId', () => {
	it('returns a string starting with "svelte-"', () => {
		const id = generateScopeId('/components/Foo.svelte');
		expect(id).toMatch(/^svelte-/);
	});

	it('returns deterministic output for the same input', () => {
		const a = generateScopeId('/components/Foo.svelte');
		const b = generateScopeId('/components/Foo.svelte');
		expect(a).toBe(b);
	});

	it('returns different IDs for different paths', () => {
		const a = generateScopeId('/components/Foo.svelte');
		const b = generateScopeId('/components/Bar.svelte');
		expect(a).not.toBe(b);
	});

	it('produces alphanumeric hash portion', () => {
		const id = generateScopeId('/src/App.svelte');
		const hash = id.replace('svelte-', '');
		expect(hash).toMatch(/^[a-z0-9]+$/);
	});
});

describe('processCssForProduction', () => {
	it('applies scoping when scopeId is provided', () => {
		const css = '.foo { color: red; }';
		const result = processCssForProduction(css, { scopeId: 'svelte-abc' });
		expect(result).toContain('.foo[svelte-abc]');
	});

	it('applies minification when minify is true', () => {
		const css = '/* comment */ .foo { color: red; }';
		const result = processCssForProduction(css, { minify: true });
		expect(result).not.toContain('/*');
		expect(result).not.toContain('  ');
	});

	it('applies scoping first, then minification', () => {
		const css = '.foo { color: red; }';
		const result = processCssForProduction(css, {
			scopeId: 'svelte-abc',
			minify: true,
		});
		// Scoping should be applied (selector has scope attribute)
		expect(result).toContain('[svelte-abc]');
		// Minification should collapse whitespace
		expect(result).not.toContain('  ');
		// The result should be minified with scoped selector
		expect(result).toBe('.foo[svelte-abc]{color:red;}');
	});

	it('returns CSS unchanged when no options are provided', () => {
		const css = '.foo { color: red; }';
		const result = processCssForProduction(css);
		expect(result).toBe(css);
	});
});
