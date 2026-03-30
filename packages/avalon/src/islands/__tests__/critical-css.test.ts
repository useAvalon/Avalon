import { describe, it, expect, beforeEach } from "vitest";
import {
	deduplicateCSSRules,
	extractCriticalCSS,
	deferNonCriticalStylesheets,
	inlineCriticalCSS,
} from "../critical-css.ts";
import { addUniversalCSS, clearUniversalCSS } from "../universal-css-collector.ts";

describe("deduplicateCSSRules", () => {
	it("returns empty string for empty input", () => {
		expect(deduplicateCSSRules("")).toBe("");
		expect(deduplicateCSSRules("   ")).toBe("");
	});

	it("removes exact duplicate rules", () => {
		const css = `.btn { color: red; }\n.btn { color: red; }`;
		const result = deduplicateCSSRules(css);
		expect(result).toBe(".btn { color: red; }");
	});

	it("keeps distinct rules", () => {
		const css = `.btn { color: red; }\n.link { color: blue; }`;
		const result = deduplicateCSSRules(css);
		expect(result).toContain(".btn { color: red; }");
		expect(result).toContain(".link { color: blue; }");
	});

	it("preserves standalone CSS comments", () => {
		const css = `/* solid: /islands/Counter.tsx (s-abc) */\n.btn { color: red; }`;
		const result = deduplicateCSSRules(css);
		expect(result).toContain("/* solid:");
		expect(result).toContain(".btn { color: red; }");
	});

	it("deduplicates rules that differ only in whitespace", () => {
		const css = `.btn {  color:  red; }\n.btn { color: red; }`;
		const result = deduplicateCSSRules(css);
		// Only one should remain
		const matches = result.split(".btn").length - 1;
		expect(matches).toBe(1);
	});
});

describe("extractCriticalCSS", () => {
	beforeEach(() => {
		clearUniversalCSS();
	});

	it("returns empty string when no CSS has been collected", () => {
		expect(extractCriticalCSS()).toBe("");
	});

	it("returns an inline style tag with collected CSS", () => {
		addUniversalCSS(".counter { color: red; }", "/islands/Counter.tsx", "solid", "s-abc");
		const result = extractCriticalCSS();
		expect(result).toContain('<style data-critical-css="true">');
		expect(result).toContain("color:");
		expect(result).toContain("</style>");
	});

	it("deduplicates CSS from multiple components with same styles", () => {
		addUniversalCSS(".btn { color: red; }", "/islands/A.tsx", "solid", "s-a");
		addUniversalCSS(".btn { color: red; }", "/islands/B.tsx", "solid", "s-b");
		const result = extractCriticalCSS();
		// The deduplicated CSS should only contain .btn once
		const btnCount = (result.match(/\.btn/g) || []).length;
		expect(btnCount).toBe(1);
	});

	it("clears the collector after extraction by default", () => {
		addUniversalCSS(".x { color: red; }", "/islands/X.tsx", "solid", "s-x");
		extractCriticalCSS(); // clears by default
		expect(extractCriticalCSS()).toBe("");
	});

	it("preserves the collector when clear=false", () => {
		addUniversalCSS(".x { color: red; }", "/islands/X.tsx", "solid", "s-x");
		extractCriticalCSS(false);
		expect(extractCriticalCSS(false)).not.toBe("");
	});
});

describe("deferNonCriticalStylesheets", () => {
	it("defers external (third-party) stylesheet links", () => {
		const html = `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"></head><body></body></html>`;
		const result = deferNonCriticalStylesheets(html);
		expect(result).toContain('media="print"');
		expect(result).toContain("onload=\"this.media='all'\"");
		expect(result).toContain("<noscript>");
	});

	it("does not defer local stylesheets", () => {
		const html = `<link rel="stylesheet" href="/assets/entry-client-abc123.css">`;
		const result = deferNonCriticalStylesheets(html);
		expect(result).toBe(html);
	});

	it("does not defer relative path stylesheets", () => {
		const html = `<link rel="stylesheet" href="/styles.css">`;
		const result = deferNonCriticalStylesheets(html);
		expect(result).toBe(html);
	});

	it("does not modify links that already have a media attribute", () => {
		const html = `<link rel="stylesheet" href="https://example.com/print.css" media="print">`;
		const result = deferNonCriticalStylesheets(html);
		expect(result).toBe(html);
	});

	it("does not modify links marked as data-critical", () => {
		const html = `<link rel="stylesheet" href="https://example.com/critical.css" data-critical>`;
		const result = deferNonCriticalStylesheets(html);
		expect(result).toBe(html);
	});

	it("defers multiple external stylesheet links", () => {
		const html = `<head>
<link rel="stylesheet" href="https://cdn.example.com/a.css">
<link rel="stylesheet" href="https://cdn.example.com/b.css">
</head>`;
		const result = deferNonCriticalStylesheets(html);
		const noscriptCount = (result.match(/<noscript>/g) || []).length;
		expect(noscriptCount).toBe(2);
	});

	it("leaves non-stylesheet links untouched", () => {
		const html = `<link rel="icon" href="/favicon.ico">`;
		const result = deferNonCriticalStylesheets(html);
		expect(result).toBe(html);
	});

	it("defers external but keeps local in mixed HTML", () => {
		const html = `<head>
<link rel="stylesheet" href="/assets/entry.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
</head>`;
		const result = deferNonCriticalStylesheets(html);
		// Local stylesheet untouched
		expect(result).toContain('href="/assets/entry.css">');
		expect(result).not.toContain('/assets/entry.css" media="print"');
		// External stylesheet deferred
		expect(result).toContain("fonts.googleapis.com");
		expect(result).toContain('media="print"');
	});
});

describe("inlineCriticalCSS", () => {
	beforeEach(() => {
		clearUniversalCSS();
	});

	it("inlines collected CSS into <head> and defers external stylesheets", () => {
		addUniversalCSS(".counter { color: red; }", "/islands/Counter.tsx", "solid", "s-abc");

		const html = `<!DOCTYPE html>
<html><head><title>Test</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">
</head><body><div>Hello</div></body></html>`;

		const result = inlineCriticalCSS(html);

		// Critical CSS should be inlined in <head>
		expect(result).toContain('<style data-critical-css="true">');
		expect(result).toContain("color:");

		// External stylesheet should be deferred
		expect(result).toContain('media="print"');
		expect(result).toContain("<noscript>");
	});

	it("returns HTML unchanged when no CSS collected and no external stylesheets", () => {
		const html = `<html><head><title>Test</title></head><body></body></html>`;
		const result = inlineCriticalCSS(html);
		expect(result).toBe(html);
	});

	it("does not defer local stylesheets", () => {
		const html = `<html><head><link rel="stylesheet" href="/app.css"></head><body></body></html>`;
		const result = inlineCriticalCSS(html);
		expect(result).not.toContain('media="print"');
		expect(result).not.toContain("<noscript>");
	});

	it("only inlines CSS when no external stylesheets exist", () => {
		addUniversalCSS(".x { color: blue; }", "/islands/X.tsx", "solid", "s-x");
		const html = `<html><head><title>Test</title></head><body></body></html>`;
		const result = inlineCriticalCSS(html);
		expect(result).toContain("data-critical-css");
		expect(result).not.toContain("<noscript>");
	});
});
