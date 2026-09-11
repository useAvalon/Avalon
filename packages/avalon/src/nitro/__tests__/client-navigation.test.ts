import { describe, expect, it } from "vitest";
import { renderPage } from "../renderer.ts";
import type { NitroRenderContext, PageModule } from "../types.ts";

const context = {
	pathname: "/checkout",
	url: new URL("http://localhost/checkout"),
	params: {},
	query: {},
	request: new Request("http://localhost/checkout"),
	event: { context: {} },
} as unknown as NitroRenderContext;

const wrap = () => `<!DOCTYPE html><html lang="en"><body>ok</body></html>`;

describe("renderPage — clientNavigation", () => {
	it("stamps html and sets the opt-out header when the page export is false", async () => {
		const pageModule: PageModule = {
			default: () => null,
			clientNavigation: false,
		};
		const result = await renderPage(pageModule, context, {}, wrap);
		expect(String(result.html)).toContain('data-client-navigation="false"');
		expect(result.headers["Avalon-Client-Navigation"]).toBe("false");
	});

	it("leaves client navigation enabled by default", async () => {
		const pageModule: PageModule = { default: () => null };
		const result = await renderPage(pageModule, context, {}, wrap);
		expect(String(result.html)).not.toContain("data-client-navigation");
		expect(result.headers["Avalon-Client-Navigation"]).toBeUndefined();
	});
});
