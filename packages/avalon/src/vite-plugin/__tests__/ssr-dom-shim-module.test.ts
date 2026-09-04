import { describe, expect, it } from "vitest";
import { ssrDomShimModuleSource } from "../ssr-dom-shim-module.ts";

describe("ssrDomShimModuleSource", () => {
	it("installs a document stub before other SSR modules load", () => {
		const src = ssrDomShimModuleSource();
		expect(src).toContain("createTreeWalker");
		expect(src).toContain("HTMLElement");
		expect(src).toContain("globalThis.document");
		expect(src).not.toContain("linkedom");
	});
});
