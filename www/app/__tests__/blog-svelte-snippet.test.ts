import { describe, expect, it } from "vitest";
import { highlightTrustedCode } from "../modules/blog/lib/highlight-code.ts";
import { cartBadgeSvelte } from "../modules/blog/snippets/cart-badge-svelte.ts";

describe("blog Svelte cart badge snippet", () => {
	it("highlights like other MDX fenced blocks", () => {
		const html = highlightTrustedCode(cartBadgeSvelte, "xml");
		expect(html).toContain("hljs-tag");
		expect(html).toContain("CartBadge.svelte");
		expect(html).not.toContain("<script lang");
	});
});
