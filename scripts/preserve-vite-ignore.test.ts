import { describe, expect, it } from "vitest";
import { preserveViteIgnore } from "./preserve-vite-ignore.ts";

describe("preserveViteIgnore", () => {
	it("marks runtime dynamic imports", () => {
		expect(preserveViteIgnore("await import(toImportSpecifier(path))")).toBe(
			"await import(/* @vite-ignore */ toImportSpecifier(path))",
		);
		expect(preserveViteIgnore("await import(`@useavalon/${name}`)")).toBe(
			"await import(/* @vite-ignore */ `@useavalon/${name}`)",
		);
		expect(preserveViteIgnore("await import(`file://${abs}`)")).toBe(
			"await import(/* @vite-ignore */ `file://${abs}`)",
		);
	});

	it("leaves static imports alone", () => {
		const literal = `await import("vite-imagetools")`;
		expect(preserveViteIgnore(literal)).toBe(literal);
		const template = "await import(`./hydrate-runtime.js`)";
		expect(preserveViteIgnore(template)).toBe(template);
	});

	it("does not double-annotate", () => {
		const marked = "await import(/* @vite-ignore */ path)";
		expect(preserveViteIgnore(marked)).toBe(marked);
	});
});
