import { describe, expect, it } from "vitest";
import { applyScopedCSS, applyScopeToHTML, generateScopeId } from "../server/css-extractor.ts";

describe("applyScopedCSS", () => {
	it("appends scope attribute to a simple selector", () => {
		const css = ".foo { color: red; }";
		const result = applyScopedCSS(css, "data-v-abc123");
		expect(result).toContain(".foo[data-v-abc123]");
		expect(result).toContain("color: red;");
	});

	it("scopes multiple comma-separated selectors", () => {
		const css = ".foo, .bar { margin: 0; }";
		const result = applyScopedCSS(css, "data-v-abc123");
		expect(result).toContain(".foo[data-v-abc123]");
		expect(result).toContain(".bar[data-v-abc123]");
	});

	it("scopes element selectors", () => {
		const css = "h1 { font-size: 2em; }";
		const result = applyScopedCSS(css, "data-v-xyz");
		expect(result).toContain("h1[data-v-xyz]");
	});

	it("scopes compound selectors", () => {
		const css = ".parent .child { display: flex; }";
		const result = applyScopedCSS(css, "data-v-s1");
		expect(result).toContain(".parent .child[data-v-s1]");
	});

	it("skips @media at-rules", () => {
		const css = "@media (max-width: 600px) { .foo { color: red; } }";
		const result = applyScopedCSS(css, "data-v-abc");
		// The @media rule itself should not be scoped
		expect(result).toMatch(/@media\s*\(max-width:\s*600px\)/);
	});

	it("skips @keyframes at-rules", () => {
		const css = "@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }";
		const result = applyScopedCSS(css, "data-v-abc");
		expect(result).toContain("@keyframes fadeIn");
	});

	it("skips @supports at-rules", () => {
		const css = "@supports (display: grid) { .grid { display: grid; } }";
		const result = applyScopedCSS(css, "data-v-abc");
		expect(result).toMatch(/@supports\s*\(display:\s*grid\)/);
	});

	it("returns empty string for empty CSS", () => {
		expect(applyScopedCSS("", "data-v-abc")).toBe("");
	});
});

describe("applyScopeToHTML", () => {
	it("adds scope attribute to opening tags", () => {
		const html = '<div class="wrapper"><span>hello</span></div>';
		const result = applyScopeToHTML(html, "data-v-abc");
		expect(result).toContain('<div class="wrapper" data-v-abc>');
		expect(result).toContain("<span data-v-abc>");
	});

	it("leaves closing tags unmodified", () => {
		const html = "<div>text</div>";
		const result = applyScopeToHTML(html, "data-v-abc");
		expect(result).toContain("</div>");
		// Closing tag should not have the scope attribute
		expect(result).not.toContain("</div data-v-abc>");
	});

	it("leaves self-closing tags unmodified", () => {
		const html = '<img src="a.png"/>';
		const result = applyScopeToHTML(html, "data-v-abc");
		// Self-closing tags ending with / are skipped by the implementation
		expect(result).toContain('<img src="a.png"/>');
	});

	it("handles multiple opening tags", () => {
		const html = "<ul><li>one</li><li>two</li></ul>";
		const result = applyScopeToHTML(html, "data-v-s1");
		expect(result).toContain("<ul data-v-s1>");
		expect(result).toContain("<li data-v-s1>");
	});

	it("returns empty string for empty HTML", () => {
		expect(applyScopeToHTML("", "data-v-abc")).toBe("");
	});

	it("handles tags with attributes", () => {
		const html = '<a href="/link" class="btn">click</a>';
		const result = applyScopeToHTML(html, "data-v-abc");
		expect(result).toContain('<a href="/link" class="btn" data-v-abc>');
	});
});

describe("generateScopeId", () => {
	it('returns a string starting with "data-v-"', () => {
		const id = generateScopeId("/components/Foo.vue");
		expect(id).toMatch(/^data-v-/);
	});

	it("returns deterministic output for the same input", () => {
		const a = generateScopeId("/components/Foo.vue");
		const b = generateScopeId("/components/Foo.vue");
		expect(a).toBe(b);
	});

	it("returns different IDs for different paths", () => {
		const a = generateScopeId("/components/Foo.vue");
		const b = generateScopeId("/components/Bar.vue");
		expect(a).not.toBe(b);
	});

	it("produces alphanumeric hash portion", () => {
		const id = generateScopeId("/src/App.vue");
		const hash = id.replace("data-v-", "");
		expect(hash).toMatch(/^[a-z0-9]+$/);
	});
});
