import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { SeoConfig } from "./config.ts";
import { SEO_ERROR_PAGE_PATH, SEO_TRANSFORM_MARKER } from "./constants.ts";
import { transformSeoHtml } from "./transform.ts";

/** Longest first so `http://localhost` never corrupts `http://localhost:8012`. */
const DEV_SITE_ORIGINS = ["http://localhost:8012", "http://localhost:3000"];

/** Strip the SEO idempotency marker so post-build can re-apply with production config. */
export function stripSeoTransformMarker(html: string): string {
	return html.replaceAll(`${SEO_TRANSFORM_MARKER}\n`, "").replaceAll(SEO_TRANSFORM_MARKER, "");
}

/** Rewrite dev localhost origins baked in at SSR time to the configured production site URL. */
export function rewriteDevSiteUrls(html: string, siteUrl: string): string {
	const target = siteUrl.replace(/\/+$/, "");
	let out = html;
	for (const dev of DEV_SITE_ORIGINS) {
		if (dev === target || !out.includes(dev)) continue;
		out = out.replaceAll(dev, target);
	}
	return out;
}

function walkHtmlFiles(dir: string, files: string[] = []): string[] {
	if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return files;
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		const stat = statSync(path);
		if (stat.isDirectory()) walkHtmlFiles(path, files);
		else if (name.endsWith(".html")) files.push(path);
	}
	return files;
}

/**
 * Map a prerendered file path under `dist/` to a URL pathname.
 * Returns {@link SEO_ERROR_PAGE_PATH} for `404.html` (skip canonical / breadcrumbs).
 */
export function htmlFileToPathname(distDir: string, filePath: string): string {
	const rel = relative(distDir, filePath).replaceAll("\\", "/");
	if (rel === "404.html" || rel.endsWith("/404.html")) return SEO_ERROR_PAGE_PATH;
	if (rel === "index.html") return "/";
	if (rel.endsWith("/index.html")) {
		const base = rel.slice(0, -"/index.html".length);
		return base ? `/${base}/` : "/";
	}
	const withoutExt = rel.replace(/\.html$/i, "");
	return `/${withoutExt}/`;
}

function stripSeoJsonLd(html: string): string {
	return html.replaceAll(
		/<script\s+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
		"",
	);
}

/** Re-run transform when the marker is present but newer config tags are still missing. */
export function needsSeoDistRefresh(html: string, config: SeoConfig): boolean {
	if (!html.includes(SEO_TRANSFORM_MARKER)) return true;
	if (config.hreflang && !html.includes("hreflang=")) return true;
	if (config.themeColor && !html.includes('name="theme-color"')) return true;
	if (config.appleTouchIcon && !html.includes("apple-touch-icon")) return true;
	if (config.webFontStylesheet && !html.includes(config.webFontStylesheet)) return true;
	if (config.contentModified && !html.includes('"dateModified"')) return true;
	if (config.publisher?.sameAs?.length && !html.includes('"sameAs"')) return true;
	const target = config.siteUrl.replace(/\/+$/, "");
	for (const dev of DEV_SITE_ORIGINS) {
		if (dev !== target && html.includes(dev)) return true;
	}
	return false;
}

/** Apply SEO transforms to every HTML file under a build output directory. */
export function applySeoToDist(distDir: string, config: SeoConfig): number {
	let count = 0;
	for (const file of walkHtmlFiles(distDir)) {
		const pathname = htmlFileToPathname(distDir, file);
		const original = readFileSync(file, "utf-8");
		let next: string;
		if (needsSeoDistRefresh(original, config)) {
			const prepared = stripSeoJsonLd(stripSeoTransformMarker(original));
			next = rewriteDevSiteUrls(transformSeoHtml(prepared, pathname, config), config.siteUrl);
		} else {
			next = rewriteDevSiteUrls(original, config.siteUrl);
		}
		if (next !== original) {
			writeFileSync(file, next, "utf-8");
			count++;
		}
	}
	return count;
}
