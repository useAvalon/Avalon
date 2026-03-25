import { describe, expect, it } from 'vitest';
import { extractInlineStyles } from '../server/renderer.ts';

describe('extractInlineStyles', () => {
	it('returns unchanged HTML when no <style> tags are present', () => {
		const html = '<div class="counter">Count: 0</div>';
		const result = extractInlineStyles(html);
		expect(result.html).toBe(html);
		expect(result.css).toEqual([]);
	});

	it('extracts a single <style> tag and removes it from HTML', () => {
		const html = '<style>.counter { color: red; }</style><div class="counter">Count: 0</div>';
		const result = extractInlineStyles(html);
		expect(result.html).toBe('<div class="counter">Count: 0</div>');
		expect(result.css).toEqual(['.counter { color: red; }']);
	});

	it('extracts multiple <style> tags', () => {
		const html =
			'<style>.a { color: red; }</style><div>A</div><style>.b { color: blue; }</style><div>B</div>';
		const result = extractInlineStyles(html);
		expect(result.html).toBe('<div>A</div><div>B</div>');
		expect(result.css).toEqual(['.a { color: red; }', '.b { color: blue; }']);
	});

	it('deduplicates identical <style> blocks from multiple component instances', () => {
		const sharedStyle = '.counter { font-weight: bold; }';
		const html =
			`<style>${sharedStyle}</style><div>Instance 1</div>` +
			`<style>${sharedStyle}</style><div>Instance 2</div>` +
			`<style>${sharedStyle}</style><div>Instance 3</div>`;
		const result = extractInlineStyles(html);
		expect(result.html).toBe('<div>Instance 1</div><div>Instance 2</div><div>Instance 3</div>');
		expect(result.css).toEqual([sharedStyle]);
	});

	it('keeps distinct CSS blocks while deduplicating identical ones', () => {
		const styleA = '.a { color: red; }';
		const styleB = '.b { color: blue; }';
		const html =
			`<style>${styleA}</style><div>1</div>` +
			`<style>${styleB}</style><div>2</div>` +
			`<style>${styleA}</style><div>3</div>`;
		const result = extractInlineStyles(html);
		expect(result.html).toBe('<div>1</div><div>2</div><div>3</div>');
		expect(result.css).toEqual([styleA, styleB]);
	});

	it('handles <style> tags with attributes (e.g. jsx)', () => {
		const html = '<style jsx>.counter { color: red; }</style><div>Count</div>';
		const result = extractInlineStyles(html);
		expect(result.html).toBe('<div>Count</div>');
		expect(result.css).toEqual(['.counter { color: red; }']);
	});

	it('handles empty <style> tags gracefully', () => {
		const html = '<style></style><div>Content</div><style>  </style>';
		const result = extractInlineStyles(html);
		expect(result.html).toBe('<div>Content</div>');
		expect(result.css).toEqual([]);
	});

	it('handles multiline CSS inside <style> tags', () => {
		const css = `.counter {\n  color: red;\n  font-size: 16px;\n}`;
		const html = `<style>${css}</style><div>Count</div>`;
		const result = extractInlineStyles(html);
		expect(result.html).toBe('<div>Count</div>');
		expect(result.css).toEqual([css]);
	});

	it('returns empty array and original HTML for HTML with no styles', () => {
		const html = '';
		const result = extractInlineStyles(html);
		expect(result.html).toBe('');
		expect(result.css).toEqual([]);
	});
});
