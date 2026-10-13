/**
 * Shared SEO HTML transform used in dev middleware, production SSR, and post-build.
 */

import type { SeoConfig } from "./config.ts";
import { SEO_ERROR_PAGE_PATH, SEO_TRANSFORM_MARKER } from "./constants.ts";
import {
	extractArticleMetaFromHtml,
	extractMetadataFromHtml,
	injectMetaTags,
} from "./meta-tags.ts";
import type { ArticleMetadata } from "./structured-data.ts";
import {
	buildArticleJsonLd,
	buildBreadcrumbListJsonLd,
	buildFaqPageJsonLd,
	buildOrganizationJsonLd,
	buildWebPageJsonLd,
	buildWebSiteJsonLd,
	injectJsonLd,
} from "./structured-data.ts";

export { SEO_ERROR_PAGE_PATH, SEO_TRANSFORM_MARKER } from "./constants.ts";

function normalizePathname(pathname: string): string {
	if (!pathname || pathname === "/") return "/";
	return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function escapeHtmlText(str: string): string {
	return str.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function stampTransformed(html: string): string {
	if (html.includes(SEO_TRANSFORM_MARKER)) return html;
	const closingHeadIdx = html.toLowerCase().indexOf("</head>");
	if (closingHeadIdx === -1) return `${html}\n${SEO_TRANSFORM_MARKER}\n`;
	return html.slice(0, closingHeadIdx) + `${SEO_TRANSFORM_MARKER}\n` + html.slice(closingHeadIdx);
}

/**
 * Inject SEO meta tags and JSON-LD into a rendered HTML document.
 * Idempotent: returns the input unchanged when {@link SEO_TRANSFORM_MARKER} is present.
 */
export function transformSeoHtml(html: string, urlOrPath: string, config: SeoConfig): string {
	if (html.includes(SEO_TRANSFORM_MARKER)) return html;

	const metadata = extractMetadataFromHtml(html);
	if (!metadata.title && !metadata.description) return html;

	const siteUrl = config.siteUrl.replace(/\/+$/, "");
	const path = urlOrPath.startsWith("http")
		? new URL(urlOrPath).pathname
		: urlOrPath.startsWith("/") || urlOrPath === SEO_ERROR_PAGE_PATH
			? urlOrPath
			: `/${urlOrPath}`;
	const isErrorPage = path === SEO_ERROR_PAGE_PATH;
	const pathname = isErrorPage ? "/" : normalizePathname(path);
	const fullUrl = `${siteUrl}${pathname === "/" ? "/" : pathname.replace(/\/$/, "") || "/"}`;

	if (config.titleSuffix !== false && metadata.title) {
		const suffix =
			typeof config.titleSuffix === "string" ? config.titleSuffix : ` — ${config.siteName}`;
		if (!metadata.title.includes(config.siteName)) {
			const newTitle = metadata.title + suffix;
			const escaped = escapeHtmlText(newTitle);
			html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, () => `<title>${escaped}</title>`);
			metadata.title = newTitle;
		}
	}

	html = injectMetaTags(html, isErrorPage ? SEO_ERROR_PAGE_PATH : pathname, config);

	if (config.structuredData) {
		html = injectJsonLd(html, buildWebPageJsonLd(metadata, fullUrl));
		html = injectJsonLd(html, buildWebSiteJsonLd(config));

		if (config.publisher) {
			const org = buildOrganizationJsonLd(config.publisher, siteUrl);
			if (org) html = injectJsonLd(html, org);
		}

		if (config.breadcrumbs && !isErrorPage) {
			const breadcrumbJsonLd = buildBreadcrumbListJsonLd(pathname, siteUrl);
			if (breadcrumbJsonLd) {
				html = injectJsonLd(html, breadcrumbJsonLd);
			}
		}

		if (config.faq?.length && pathname === "/") {
			html = injectJsonLd(html, buildFaqPageJsonLd(config.faq));
		}

		const articleMeta = extractArticleMetaFromHtml(html);
		if (metadata.title && (articleMeta.datePublished || metadata.description)) {
			const article: ArticleMetadata = {
				title: metadata.title,
				description: metadata.description,
				image: metadata.openGraph?.image,
				imageWidth: metadata.openGraph?.imageWidth,
				imageHeight: metadata.openGraph?.imageHeight,
				datePublished: articleMeta.datePublished,
				dateModified: articleMeta.dateModified,
				author: articleMeta.author,
				section: articleMeta.section,
				tags: articleMeta.tags,
			};
			html = injectJsonLd(html, buildArticleJsonLd(article, fullUrl, config));
		}
	}

	return stampTransformed(html);
}
