import { describe, expect, it } from "vitest";
import {
	applyHtmlPostProcess,
	clearHtmlPostProcessHooks,
	registerHtmlPostProcess,
} from "../html-post-process.ts";

describe("html-post-process", () => {
	it("runs registered hooks in order", () => {
		clearHtmlPostProcessHooks();
		registerHtmlPostProcess((html) => `${html}<!-- a -->`);
		registerHtmlPostProcess((html, path) => `${html}<!-- ${path} -->`);

		const out = applyHtmlPostProcess("<html></html>", "/docs/");
		expect(out).toBe("<html></html><!-- a --><!-- /docs/ -->");
		clearHtmlPostProcessHooks();
	});
});
