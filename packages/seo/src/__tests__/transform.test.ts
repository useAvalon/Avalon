import { describe, expect, it } from "vitest";
import type { SeoConfig } from "../config.ts";
import { transformSeoHtml } from "../transform.ts";

const baseConfig: SeoConfig = {
	siteUrl: "https://example.com",
	siteName: "Example",
	defaultDescription: "Default description",
	defaultOgImage: { url: "/og.png", width: 1200, height: 630 },
	canonical: true,
	openGraph: true,
	twitterCards: true,
	structuredData: true,
	breadcrumbs: true,
	speakable: true,
	speakableSelectors: ["h1"],
	searchQueryParam: "q",
	locale: "en_US",
	robotsImagePreview: true,
};

const html = `<!DOCTYPE html><html><head><title>Hello</title><meta name="description" content="Desc" /></head><body></body></html>`;

describe("transformSeoHtml", () => {
	it("injects canonical and JSON-LD in production-style HTML", () => {
		const out = transformSeoHtml(html, "/", baseConfig);
		expect(out).toContain('rel="canonical"');
		expect(out).toContain("application/ld+json");
		expect(out).toContain("og:image");
		expect(out).toContain("max-image-preview:large");
	});

	it("is idempotent when the marker is already present", () => {
		const once = transformSeoHtml(html, "/", baseConfig);
		const twice = transformSeoHtml(once, "/", baseConfig);
		expect(twice).toBe(once);
	});
});
