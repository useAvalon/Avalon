import { describe, expect, it } from "vitest";
import type { SeoConfig } from "../config.ts";
import {
	extractArticleMetaFromHtml,
	extractMetadataFromHtml,
	injectMetaTags,
} from "../meta-tags.ts";

const baseSeoConfig: SeoConfig = {
	siteUrl: "https://example.com",
	siteName: "My Site",
	locale: "en_US",
	canonical: true,
	openGraph: true,
	twitterCards: true,
	structuredData: true,
	breadcrumbs: true,
	speakable: true,
	speakableSelectors: ["h1", "[data-speakable]"],
	searchQueryParam: "q",
	twitterSite: "@mysite",
	twitterCreator: "@author",
	defaultOgImage: { url: "/default-og.png", width: 1200, height: 630 },
};

const minimalHtml = `<html><head><title>Test Page</title><meta name="description" content="A test page" /></head><body></body></html>`;

describe("injectMetaTags", () => {
	it("injects canonical URL", () => {
		const result = injectMetaTags(minimalHtml, "/test", baseSeoConfig);
		expect(result).toContain('<link rel="canonical" href="https://example.com/test" />');
	});

	it("does not duplicate canonical if already present", () => {
		const html = `<html><head><title>Test</title><link rel="canonical" href="https://example.com/existing" /></head><body></body></html>`;
		const result = injectMetaTags(html, "/test", baseSeoConfig);
		expect(result).not.toContain('href="https://example.com/test"');
		expect(result).toContain('href="https://example.com/existing"');
	});

	it("injects OG tags with image dimensions", () => {
		const result = injectMetaTags(minimalHtml, "/test", baseSeoConfig);
		expect(result).toContain('property="og:title"');
		expect(result).toContain('property="og:description"');
		expect(result).toContain('property="og:url"');
		expect(result).toContain('property="og:type"');
		expect(result).toContain('property="og:locale"');
		expect(result).toContain('property="og:site_name"');
		expect(result).toContain('property="og:image"');
		expect(result).toContain('property="og:image:width" content="1200"');
		expect(result).toContain('property="og:image:height" content="630"');
	});

	it("does not duplicate OG tags if already present", () => {
		const html = `<html><head><title>Test</title><meta property="og:title" content="Existing" /></head><body></body></html>`;
		const result = injectMetaTags(html, "/test", baseSeoConfig);
		// Should not inject another og:title
		const ogTitleCount = (result.match(/og:title/g) || []).length;
		expect(ogTitleCount).toBe(1);
	});

	it("injects Twitter card tags", () => {
		const result = injectMetaTags(minimalHtml, "/test", baseSeoConfig);
		expect(result).toContain('name="twitter:card" content="summary_large_image"');
		expect(result).toContain('name="twitter:site" content="@mysite"');
		expect(result).toContain('name="twitter:creator" content="@author"');
		expect(result).toContain('name="twitter:title"');
		expect(result).toContain('name="twitter:description"');
		expect(result).toContain('name="twitter:image"');
	});

	it("uses summary card type when no image available", () => {
		const config = { ...baseSeoConfig, defaultOgImage: undefined };
		const result = injectMetaTags(minimalHtml, "/test", config);
		expect(result).toContain('name="twitter:card" content="summary"');
	});

	it("injects font preconnect links", () => {
		const config = {
			...baseSeoConfig,
			fontPreconnect: ["https://fonts.googleapis.com", "https://fonts.gstatic.com"],
		};
		const result = injectMetaTags(minimalHtml, "/test", config);
		expect(result).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
		expect(result).toContain('rel="preconnect" href="https://fonts.gstatic.com"');
		// gstatic should get crossorigin variant
		expect(result).toContain('href="https://fonts.gstatic.com" crossorigin');
	});

	it("does not inject font preconnect if already present", () => {
		const html = `<html><head><title>Test</title><link rel="preconnect" href="https://fonts.googleapis.com" /></head><body></body></html>`;
		const config = {
			...baseSeoConfig,
			fontPreconnect: ["https://fonts.googleapis.com"],
		};
		const result = injectMetaTags(html, "/test", config);
		const preconnectCount = (result.match(/fonts\.googleapis\.com/g) || []).length;
		expect(preconnectCount).toBe(1); // Only the existing one
	});

	it("sets og:type to article when article:published_time is present", () => {
		const html = `<html><head><title>Blog Post</title><meta name="description" content="A post" /><meta property="article:published_time" content="2026-01-01" /></head><body></body></html>`;
		const result = injectMetaTags(html, "/blog/post", baseSeoConfig);
		expect(result).toContain('property="og:type" content="article"');
	});
});

describe("extractMetadataFromHtml", () => {
	it("extracts title and description", () => {
		const meta = extractMetadataFromHtml(minimalHtml);
		expect(meta.title).toBe("Test Page");
		expect(meta.description).toBe("A test page");
	});

	it("extracts OG metadata", () => {
		const html = `<html><head><title>T</title><meta property="og:title" content="OG Title" /><meta property="og:image" content="/img.png" /></head><body></body></html>`;
		const meta = extractMetadataFromHtml(html);
		expect(meta.openGraph?.title).toBe("OG Title");
		expect(meta.openGraph?.image).toBe("/img.png");
	});
});

describe("extractArticleMetaFromHtml", () => {
	it("extracts article meta tags", () => {
		const html = `<html><head>
      <meta property="article:published_time" content="2026-01-01" />
      <meta property="article:modified_time" content="2026-01-15" />
      <meta property="article:author" content="John Doe" />
      <meta property="article:section" content="Tech" />
      <meta property="article:tag" content="javascript" />
      <meta property="article:tag" content="seo" />
    </head><body></body></html>`;

		const meta = extractArticleMetaFromHtml(html);
		expect(meta.datePublished).toBe("2026-01-01");
		expect(meta.dateModified).toBe("2026-01-15");
		expect(meta.author).toBe("John Doe");
		expect(meta.section).toBe("Tech");
		expect(meta.tags).toEqual(["javascript", "seo"]);
	});

	it("returns empty object when no article meta present", () => {
		const html = `<html><head><title>Test</title></head><body></body></html>`;
		const meta = extractArticleMetaFromHtml(html);
		expect(meta).toEqual({});
	});
});
