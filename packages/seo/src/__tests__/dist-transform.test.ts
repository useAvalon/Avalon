import { describe, expect, it } from "vitest";
import { SEO_ERROR_PAGE_PATH, SEO_TRANSFORM_MARKER } from "../constants.ts";
import {
	htmlFileToPathname,
	rewriteDevSiteUrls,
	stripSeoTransformMarker,
} from "../dist-transform.ts";

describe("htmlFileToPathname", () => {
	it("maps 404.html to the error-page sentinel", () => {
		expect(htmlFileToPathname("/dist", "/dist/404.html")).toBe(SEO_ERROR_PAGE_PATH);
	});

	it("maps index.html to /", () => {
		expect(htmlFileToPathname("/dist", "/dist/index.html")).toBe("/");
	});
});

describe("stripSeoTransformMarker", () => {
	it("removes the marker so post-build can re-transform", () => {
		const html = `<html><head><title>T</title>${SEO_TRANSFORM_MARKER}</head></html>`;
		expect(stripSeoTransformMarker(html)).not.toContain(SEO_TRANSFORM_MARKER);
	});
});

describe("rewriteDevSiteUrls", () => {
	it("rewrites localhost origins to the configured site URL", () => {
		const html =
			'<link rel="canonical" href="http://localhost:8012/" /><script type="application/ld+json">{"url":"http://localhost:8012/"}</script>';
		const out = rewriteDevSiteUrls(html, "https://useavalon.dev");
		expect(out).toContain("https://useavalon.dev/");
		expect(out).not.toContain("localhost:8012");
	});

	it("does not double-rewrite when target is already a dev origin", () => {
		const html = '<link rel="canonical" href="http://localhost:8012/" />';
		const out = rewriteDevSiteUrls(html, "http://localhost:8012");
		expect(out).toBe(html);
	});
});
