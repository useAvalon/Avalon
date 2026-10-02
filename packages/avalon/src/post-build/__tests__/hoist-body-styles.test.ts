import { describe, expect, it } from "vitest";
import { hoistBodyStylesToHead } from "../hoist-body-styles.ts";

describe("hoistBodyStylesToHead", () => {
	it("hoists body styles into head with data-avalon-ssr-css for client navigation", () => {
		const html = `<!DOCTYPE html><html><head><title>x</title></head><body><div><style>.card{color:red}</style></div></body></html>`;
		const out = hoistBodyStylesToHead(html);

		expect(out).toContain('<style data-avalon-ssr-css="true">.card{color:red}</style>');
		expect(out).not.toMatch(/<body>[^<]*<style/);
		expect(out.indexOf("data-avalon-ssr-css")).toBeLessThan(out.indexOf("<body"));
	});

	it("preserves attributes, skips template and script string false matches", () => {
		expect(
			hoistBodyStylesToHead(
				`<html><head></head><body><style media="print">a{}</style><template shadowrootmode="open"><style>b{}</style></template><script>"<style>c{}</style>"</script></body></html>`,
			),
		).toBe(
			`<html><head><style data-avalon-ssr-css="true" media="print">a{}</style></head><body><template shadowrootmode="open"><style>b{}</style></template><script>"<style>c{}</style>"</script></body></html>`,
		);
	});

	it("leaves HTML unchanged when body has no hoistable styles", () => {
		const html = `<html><head></head><body><div><template shadowrootmode="open"><style>.in-shadow{}</style></template></div></body></html>`;
		expect(hoistBodyStylesToHead(html)).toBe(html);
	});

	it("drops empty body style tags without leaving stale parser state", () => {
		const html = `<html><head></head><body><style></style><style>.x{}</style></body></html>`;
		const out = hoistBodyStylesToHead(html);

		expect(out).toBe(
			`<html><head><style data-avalon-ssr-css="true">.x{}</style></head><body></body></html>`,
		);
	});
});
