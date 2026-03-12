/** @jsxImportSource preact */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render } from 'preact-render-to-string';
import { h } from 'preact';
import DocsLayout from '../modules/docs/layouts/_layout.tsx';

describe('Docs layout property tests', () => {
	// Feature: avalon-docs, Property 10: Docs layout renders frontmatter title as h1
	it('Property 10: docs layout renders frontmatter title as h1', () => {
		// Only use titles that don't contain HTML special chars, since the renderer
		// will escape them (& → &amp; etc.) and a raw string match would fail.
		const safeTitle = fc.string({ minLength: 1 }).filter(
			s => s.trim().length > 0 && !/[&<>"']/.test(s),
		);
		fc.assert(
			fc.property(safeTitle, (title) => {
				const html = render(
					h(DocsLayout, { frontmatter: { title, currentPath: '/docs/introduction' } },
						h('p', null, 'content'),
					),
				);
				return html.includes('<h1') && html.includes(title);
			}),
			{ numRuns: 100 },
		);
	});
});
