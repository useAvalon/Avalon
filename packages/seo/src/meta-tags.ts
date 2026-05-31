/**
 * Meta tag injection for SEO.
 *
 * Handles Open Graph, Twitter cards, canonical URLs, robots directives,
 * article meta tags, og:image dimensions, and font preconnect links.
 *
 * The plugin reads existing meta tags from the HTML and injects missing
 * ones based on the SEO config. It never overwrites user-provided tags.
 */

import type { SeoConfig } from "./config.ts";
import type { PageMetadata } from "./structured-data.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtractedMeta {
	title?: string;
	description?: string;
	canonical?: string;
	robots?: string;
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	ogImageWidth?: string;
	ogImageHeight?: string;
	ogUrl?: string;
	ogType?: string;
	ogLocale?: string;
	ogSiteName?: string;
	twitterCard?: string;
	twitterSite?: string;
	twitterCreator?: string;
	twitterTitle?: string;
	twitterDescription?: string;
	twitterImage?: string;
	articlePublishedTime?: string;
	articleModifiedTime?: string;
	articleAuthor?: string;
	articleSection?: string;
	articleTags?: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inject missing SEO meta tags into the HTML <head>.
 *
 * Reads existing tags to avoid duplication, then injects:
 * - Canonical URL
 * - Open Graph tags (title, description, image with dimensions, url, type, locale, site_name)
 * - Twitter card tags
 * - Font preconnect links
 *
 * Does NOT inject article:* meta tags — those should be set by the page
 * via frontmatter/metadata. The plugin reads them for JSON-LD generation.
 */
export function injectMetaTags(html: string, url: string, config: SeoConfig): string {
	const existing = extractExistingMeta(html);
	const tags: string[] = [];
	const siteUrl = config.siteUrl.replace(/\/+$/, "");
	const fullUrl = url.startsWith("http") ? url : `${siteUrl}${url}`;

	// Canonical URL
	if (config.canonical && !existing.canonical) {
		tags.push(`<link rel="canonical" href="${escapeAttr(fullUrl)}" />`);
	}

	// Open Graph
	if (config.openGraph) {
		const title = existing.ogTitle || existing.title;
		const description = existing.ogDescription || existing.description || config.defaultDescription;
		const image = existing.ogImage || config.defaultOgImage?.url;

		if (!existing.ogTitle && title) {
			tags.push(`<meta property="og:title" content="${escapeAttr(title)}" />`);
		}
		if (!existing.ogDescription && description) {
			tags.push(`<meta property="og:description" content="${escapeAttr(description)}" />`);
		}
		if (!existing.ogUrl) {
			tags.push(`<meta property="og:url" content="${escapeAttr(fullUrl)}" />`);
		}
		if (!existing.ogType) {
			// Default to 'article' if page has published_time, otherwise 'website'
			const type = existing.articlePublishedTime ? "article" : "website";
			tags.push(`<meta property="og:type" content="${type}" />`);
		}
		if (!existing.ogLocale && config.locale) {
			tags.push(`<meta property="og:locale" content="${escapeAttr(config.locale)}" />`);
		}
		if (!existing.ogSiteName && config.siteName) {
			tags.push(`<meta property="og:site_name" content="${escapeAttr(config.siteName)}" />`);
		}

		// OG Image with dimensions
		if (!existing.ogImage && image) {
			const imgUrl = image.startsWith("http") ? image : `${siteUrl}${image}`;
			tags.push(`<meta property="og:image" content="${escapeAttr(imgUrl)}" />`);
		}
		// Always inject dimensions if we have an image (existing or default)
		const finalImage = existing.ogImage || image;
		if (finalImage) {
			if (!existing.ogImageWidth) {
				const width = config.defaultOgImage?.width || 1200;
				tags.push(`<meta property="og:image:width" content="${width}" />`);
			}
			if (!existing.ogImageHeight) {
				const height = config.defaultOgImage?.height || 630;
				tags.push(`<meta property="og:image:height" content="${height}" />`);
			}
		}
	}

	// Twitter Cards
	if (config.twitterCards) {
		const title = existing.twitterTitle || existing.ogTitle || existing.title;
		const description =
			existing.twitterDescription ||
			existing.ogDescription ||
			existing.description ||
			config.defaultDescription;
		const image = existing.twitterImage || existing.ogImage || config.defaultOgImage?.url;

		if (!existing.twitterCard) {
			const cardType = image ? "summary_large_image" : "summary";
			tags.push(`<meta name="twitter:card" content="${cardType}" />`);
		}
		if (!existing.twitterSite && config.twitterSite) {
			tags.push(`<meta name="twitter:site" content="${escapeAttr(config.twitterSite)}" />`);
		}
		if (!existing.twitterCreator && config.twitterCreator) {
			tags.push(`<meta name="twitter:creator" content="${escapeAttr(config.twitterCreator)}" />`);
		}
		if (!existing.twitterTitle && title) {
			tags.push(`<meta name="twitter:title" content="${escapeAttr(title)}" />`);
		}
		if (!existing.twitterDescription && description) {
			tags.push(`<meta name="twitter:description" content="${escapeAttr(description)}" />`);
		}
		if (!existing.twitterImage && image) {
			const imgUrl = image.startsWith("http") ? image : `${siteUrl}${image}`;
			tags.push(`<meta name="twitter:image" content="${escapeAttr(imgUrl)}" />`);
		}
	}

	// Font preconnect links
	if (config.fontPreconnect?.length) {
		for (const url of config.fontPreconnect) {
			if (!html.includes(url)) {
				tags.push(`<link rel="preconnect" href="${escapeAttr(url)}" />`);
				// Add crossorigin variant for font CDNs
				if (url.includes("fonts.gstatic") || url.includes("cdn.fonts")) {
					tags.push(`<link rel="preconnect" href="${escapeAttr(url)}" crossorigin />`);
				}
			}
		}
	}

	if (tags.length === 0) return html;

	// Inject before </head>
	const closingHeadIdx = html.toLowerCase().indexOf("</head>");
	if (closingHeadIdx === -1) return html;

	return html.slice(0, closingHeadIdx) + tags.join("\n") + "\n" + html.slice(closingHeadIdx);
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract page metadata from HTML for use by structured data builders.
 */
export function extractMetadataFromHtml(html: string): PageMetadata {
	const metadata: PageMetadata = {};

	const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	if (titleMatch) metadata.title = titleMatch[1].trim();

	const descMatch = html.match(
		/<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*\/?>/i,
	);
	if (descMatch) {
		metadata.description = descMatch[1];
	} else {
		const descMatch2 = html.match(
			/<meta\s[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*\/?>/i,
		);
		if (descMatch2) metadata.description = descMatch2[1];
	}

	const ogTitle = extractMetaProperty(html, "og:title");
	const ogDesc = extractMetaProperty(html, "og:description");
	const ogImage = extractMetaProperty(html, "og:image");
	const ogImageWidth = extractMetaProperty(html, "og:image:width");
	const ogImageHeight = extractMetaProperty(html, "og:image:height");

	if (ogTitle || ogDesc || ogImage) {
		metadata.openGraph = {};
		if (ogTitle) metadata.openGraph.title = ogTitle;
		if (ogDesc) metadata.openGraph.description = ogDesc;
		if (ogImage) metadata.openGraph.image = ogImage;
		if (ogImageWidth) metadata.openGraph.imageWidth = parseInt(ogImageWidth, 10);
		if (ogImageHeight) metadata.openGraph.imageHeight = parseInt(ogImageHeight, 10);
	}

	return metadata;
}

/**
 * Extract article-specific metadata from HTML meta tags.
 */
export function extractArticleMetaFromHtml(html: string): {
	datePublished?: string;
	dateModified?: string;
	author?: string;
	section?: string;
	tags?: string[];
} {
	const datePublished = extractMetaProperty(html, "article:published_time");
	const dateModified = extractMetaProperty(html, "article:modified_time");
	const author = extractMetaProperty(html, "article:author");
	const section = extractMetaProperty(html, "article:section");

	// Collect all article:tag values
	const tagRegex =
		/<meta\s[^>]*property\s*=\s*["']article:tag["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*\/?>/gi;
	const tags: string[] = [];
	for (let match = tagRegex.exec(html); match !== null; match = tagRegex.exec(html)) {
		tags.push(match[1]);
	}

	return {
		...(datePublished && { datePublished }),
		...(dateModified && { dateModified }),
		...(author && { author }),
		...(section && { section }),
		...(tags.length > 0 && { tags }),
	};
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function extractExistingMeta(html: string): ExtractedMeta {
	const meta: ExtractedMeta = {};

	const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	if (titleMatch) meta.title = titleMatch[1].trim();

	meta.description = extractMetaName(html, "description");
	meta.robots = extractMetaName(html, "robots");

	// Check for canonical link
	const canonicalMatch = html.match(
		/<link\s[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']*)["'][^>]*\/?>/i,
	);
	if (canonicalMatch) meta.canonical = canonicalMatch[1];

	// Open Graph
	meta.ogTitle = extractMetaProperty(html, "og:title");
	meta.ogDescription = extractMetaProperty(html, "og:description");
	meta.ogImage = extractMetaProperty(html, "og:image");
	meta.ogImageWidth = extractMetaProperty(html, "og:image:width");
	meta.ogImageHeight = extractMetaProperty(html, "og:image:height");
	meta.ogUrl = extractMetaProperty(html, "og:url");
	meta.ogType = extractMetaProperty(html, "og:type");
	meta.ogLocale = extractMetaProperty(html, "og:locale");
	meta.ogSiteName = extractMetaProperty(html, "og:site_name");

	// Twitter
	meta.twitterCard = extractMetaName(html, "twitter:card");
	meta.twitterSite = extractMetaName(html, "twitter:site");
	meta.twitterCreator = extractMetaName(html, "twitter:creator");
	meta.twitterTitle = extractMetaName(html, "twitter:title");
	meta.twitterDescription = extractMetaName(html, "twitter:description");
	meta.twitterImage = extractMetaName(html, "twitter:image");

	// Article
	meta.articlePublishedTime = extractMetaProperty(html, "article:published_time");
	meta.articleModifiedTime = extractMetaProperty(html, "article:modified_time");
	meta.articleAuthor = extractMetaProperty(html, "article:author");
	meta.articleSection = extractMetaProperty(html, "article:section");

	return meta;
}

export function extractMetaProperty(html: string, property: string): string | undefined {
	const escaped = escapeForRegex(property);
	const patternA =
		String.raw`<meta\s[^>]*property\s*=\s*["']` +
		escaped +
		String.raw`["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*/?>`;
	const patternB =
		String.raw`<meta\s[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']` +
		escaped +
		String.raw`["'][^>]*/?>`;

	const m1 = html.match(new RegExp(patternA, "i"));
	if (m1) return m1[1];

	const m2 = html.match(new RegExp(patternB, "i"));
	return m2 ? m2[1] : undefined;
}

function extractMetaName(html: string, name: string): string | undefined {
	const escaped = escapeForRegex(name);
	const patternA =
		String.raw`<meta\s[^>]*name\s*=\s*["']` +
		escaped +
		String.raw`["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*/?>`;
	const patternB =
		String.raw`<meta\s[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']` +
		escaped +
		String.raw`["'][^>]*/?>`;

	const m1 = html.match(new RegExp(patternA, "i"));
	if (m1) return m1[1];

	const m2 = html.match(new RegExp(patternB, "i"));
	return m2 ? m2[1] : undefined;
}

function escapeForRegex(str: string): string {
	return str.replaceAll(/[.*+?^${}()|[\]\\]/g, (match) => "\\" + match);
}

function escapeAttr(str: string): string {
	return str
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}
