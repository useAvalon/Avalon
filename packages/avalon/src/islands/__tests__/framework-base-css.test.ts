import { describe, expect, it } from "vitest";
import { __FRAMEWORK_BASE_CSS, injectFrameworkBaseCSS } from "../framework-base-css.ts";

describe("injectFrameworkBaseCSS", () => {
	it("injects a baseline <style> tag right after <head>", () => {
		const html = `<html><head><title>x</title></head><body></body></html>`;
		const result = injectFrameworkBaseCSS(html);

		expect(result).toContain('<style data-avalon-base="true">');
		expect(result).toContain("avalon-island");
		expect(result).toContain("display:contents");
		// Inserted directly after <head>, before the title
		expect(result.indexOf("<style data-avalon-base")).toBeLessThan(result.indexOf("<title>"));
	});

	it("targets all three framework-emitted custom elements", () => {
		expect(__FRAMEWORK_BASE_CSS).toContain("avalon-island");
		expect(__FRAMEWORK_BASE_CSS).toContain("avalon-page");
		expect(__FRAMEWORK_BASE_CSS).toContain("avalon-page-content");
		expect(__FRAMEWORK_BASE_CSS).toContain("display:contents");
	});

	it("is idempotent — does not double-inject if already present", () => {
		const html = `<html><head><title>x</title></head><body></body></html>`;
		const once = injectFrameworkBaseCSS(html);
		const twice = injectFrameworkBaseCSS(once);

		expect(once).toBe(twice);
		// Only one occurrence of the marker
		expect((twice.match(/data-avalon-base/g) || []).length).toBe(1);
	});

	it("returns input unchanged when there is no <head>", () => {
		const html = `<div>fragment without a document shell</div>`;
		expect(injectFrameworkBaseCSS(html)).toBe(html);
	});

	it("preserves attributes on the <head> tag", () => {
		const html = `<html><head data-test="x"><title>y</title></head><body></body></html>`;
		const result = injectFrameworkBaseCSS(html);

		expect(result).toContain('<head data-test="x">');
		expect(result).toContain('<style data-avalon-base="true">');
	});
});
