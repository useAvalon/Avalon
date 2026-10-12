import { describe, expect, it } from "vitest";
import { jsxForCore } from "./jsx-dialect";

describe("jsxForCore", () => {
	const preact = `import { useState } from 'preact/hooks';
<label class="field-label" for="checkout-email">
  <input autocomplete="email" tabindex="-1" class={open ? 'is-open' : ''} />
</label>`;

	it("leaves Preact JSX unchanged", () => {
		expect(jsxForCore("preact", preact)).toBe(preact);
	});

	it("rewrites attributes and hooks for a React shell", () => {
		const react = jsxForCore("react", preact);
		expect(react).toContain("from 'react'");
		expect(react).not.toContain("preact/hooks");
		expect(react).toContain('className="field-label"');
		expect(react).toContain('htmlFor="checkout-email"');
		expect(react).toContain("autoComplete=");
		expect(react).toContain("tabIndex=");
		expect(react).toContain("className={open ? 'is-open' : ''}");
	});

	it("converts string style props to React style objects", () => {
		const source = `<p style="--reveal-delay:120ms" />
<div style={\`--reveal-delay:\${index * 70}ms\`} />`;
		const react = jsxForCore("react", source);
		expect(react).toContain("style={{ '--reveal-delay': '120ms' }}");
		expect(react).toContain("style={{ '--reveal-delay': `${index * 70}ms` }}");
		expect(react).not.toContain('style="--reveal-delay');
	});

	it("leaves string style props on Preact", () => {
		const source = '<p style="--reveal-delay:120ms" />';
		expect(jsxForCore("preact", source)).toBe(source);
	});
});
