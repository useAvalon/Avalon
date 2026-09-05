import { describe, expect, it } from "vitest";
import { ssrDomShimModuleSource, ssrDomStubFileSource } from "../ssr-dom-shim-module.ts";

describe("ssrDomShimModuleSource", () => {
	it("installs a document stub and real ssr-dom-shim classes", () => {
		const src = ssrDomShimModuleSource();
		expect(src).toContain("createTreeWalker");
		expect(src).toContain("CSSStyleSheet");
		expect(src).toContain("@lit-labs/ssr-dom-shim");
		expect(src).toContain("CustomElementRegistry");
		expect(src).toContain("globalThis.document");
		expect(src).not.toContain("linkedom");
	});
});

describe("ssrDomStubFileSource", () => {
	it("is self-contained for Cloudflare workers", () => {
		const src = ssrDomStubFileSource();
		expect(src).toContain("createTreeWalker");
		expect(src).toContain("CSSStyleSheet");
		expect(src).toContain("HTMLElement");
		expect(src).not.toContain("@lit-labs/ssr-dom-shim");
		expect(src).not.toContain("linkedom");
	});

	it("installs a working customElements registry (not a no-op)", () => {
		const src = ssrDomStubFileSource();
		expect(src).toContain("registry.set(name, ctor)");
		expect(src).toContain("registry.get(name)");
		expect(src).not.toMatch(/define\(\)\s*\{\s*\}/);
		expect(src).toContain("avalon-ce-probe");
	});
});
