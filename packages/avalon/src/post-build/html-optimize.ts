import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectFiles } from "./fs-utils.ts";
import { hoistBodyStylesToHead } from "./hoist-body-styles.ts";

/** Maximum CSS size (in bytes) to inline into HTML. */
const CSS_INLINE_THRESHOLD = 14_336;

const GLOBAL_STYLESHEET_LINK_RE =
	/<link\s+rel="stylesheet"\s+href="(\/assets\/(?:ssr-)?index-[^"]+\.css)">/i;

export function minifyCSS(css: string): string {
	let out = css.replaceAll(/\/\*[\s\S]*?\*\//g, "").replaceAll(/\s+/g, " ");
	for (const ch of ["{", "}", ":", ";", ","]) {
		out = out.replaceAll(new RegExp(String.raw`\s*${ch}\s*`, "g"), ch);
	}
	return out.trim();
}

function buildCSSCache(htmlDirs: string[]): Map<string, string> {
	const cache = new Map<string, string>();
	for (const htmlDir of htmlDirs) {
		const assetsDir = join(htmlDir, "assets");
		if (!existsSync(assetsDir)) continue;
		for (const file of readdirSync(assetsDir)) {
			if (file.endsWith(".css")) {
				cache.set(`/assets/${file}`, readFileSync(join(assetsDir, file), "utf-8"));
			}
		}
	}
	return cache;
}

function inlineOrPreloadGlobalCSS(html: string, cssCache: Map<string, string>): string {
	const match = GLOBAL_STYLESHEET_LINK_RE.exec(html);
	if (!match) return html;

	const href = match[1];
	const cssContent = cssCache.get(href);
	if (!cssContent) return html;

	if (Buffer.byteLength(cssContent, "utf-8") <= CSS_INLINE_THRESHOLD) {
		const inlineStyle = `<style data-inlined-from="${href}">${cssContent}</style>`;
		return html.replace(match[0], inlineStyle);
	}

	const preloadHint = `<link rel="preload" href="${href}" as="style">`;
	if (html.includes("</title>") && !html.includes(`preload" href="${href}"`)) {
		return html.replace("</title>", `</title>\n${preloadHint}`);
	}
	return html;
}

function findLinkTags(html: string): Array<{ start: number; end: number; attrs: string }> {
	const tags: Array<{ start: number; end: number; attrs: string }> = [];
	let i = 0;
	while (i < html.length) {
		const start = html.indexOf("<link", i);
		if (start === -1) break;
		const end = html.indexOf(">", start);
		if (end === -1) break;
		const raw = html.slice(start, end + 1);
		const attrs = raw.slice("<link".length, -1).trim();
		tags.push({ start, end: end + 1, attrs });
		i = end + 1;
	}
	return tags;
}

function deferNonCriticalStylesheets(html: string): string {
	const tags = findLinkTags(html);
	if (tags.length === 0) return html;

	let result = "";
	let cursor = 0;
	for (const tag of tags) {
		result += html.slice(cursor, tag.start);
		cursor = tag.end;

		const fullMatch = html.slice(tag.start, tag.end);
		const relMatch = /\brel=["']stylesheet["']/i.test(tag.attrs);
		if (!relMatch) {
			result += fullMatch;
			continue;
		}

		const before = html.slice(Math.max(0, tag.start - 32), tag.start).toLowerCase();
		if (before.includes("<noscript")) {
			result += fullMatch;
			continue;
		}

		const trimmedAttrs = tag.attrs.trim();
		const normalizedAttrs = trimmedAttrs.endsWith("/")
			? trimmedAttrs.slice(0, -1).trimEnd()
			: trimmedAttrs;
		if (/\bmedia\s*=/i.test(normalizedAttrs)) {
			result += fullMatch;
			continue;
		}
		if (/data-critical/i.test(normalizedAttrs)) {
			result += fullMatch;
			continue;
		}

		const hrefResult = /href=["']([^"']+)["']/i.exec(normalizedAttrs);
		if (!hrefResult) {
			result += fullMatch;
			continue;
		}

		const href = hrefResult[1];
		const isExternal = href.startsWith("https://") || href.startsWith("http://");
		if (!isExternal) {
			result += fullMatch;
			continue;
		}

		result += `<link ${normalizedAttrs} media="print" onload="this.media='all'">\n<noscript><link ${normalizedAttrs}></noscript>`;
	}
	result += html.slice(cursor);
	return result;
}

function addFontPreloadHints(html: string): string {
	const fontUrls = new Set<string>();
	let i = 0;
	while (i < html.length) {
		const hrefIdx = html.indexOf("href=", i);
		if (hrefIdx === -1) break;
		const quote = html[hrefIdx + 5];
		if (quote !== '"' && quote !== "'") {
			i = hrefIdx + 5;
			continue;
		}
		const urlStart = hrefIdx + 6;
		const urlEnd = html.indexOf(quote, urlStart);
		if (urlEnd === -1) break;
		const url = html.slice(urlStart, urlEnd);
		if (url.startsWith("https://fonts.googleapis.com/css2")) {
			fontUrls.add(url);
		}
		i = urlEnd + 1;
	}

	if (fontUrls.size === 0) return html;

	const preloadHints: string[] = [];
	for (const url of fontUrls) {
		const escapedUrl = url.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
		const existingPreload = new RegExp(
			String.raw`<link\s+[^>]*rel=["']preload["'][^>]*href=["']${escapedUrl}["'][^>]*>`,
			"i",
		);
		if (existingPreload.test(html)) continue;
		preloadHints.push(`<link rel="preload" href="${url}" as="style">`);
	}

	if (preloadHints.length === 0) return html;

	const preloadBlock = preloadHints.join("\n");
	if (html.includes("</title>")) {
		return html.replace("</title>", `</title>\n${preloadBlock}`);
	}
	return html;
}

/** Optimize prerendered HTML: inline CSS, defer external stylesheets, font preloads. */
export function optimizePrerenderedHtml(cwd: string, distDir: string): void {
	const htmlDirs = [join(cwd, ".output", "public"), distDir];
	const cssCache = buildCSSCache(htmlDirs);

	let patchedCount = 0;

	for (const htmlDir of htmlDirs) {
		if (!existsSync(htmlDir)) continue;
		const htmlFiles = collectFiles(htmlDir, (n) => n === "index.html");

		for (const htmlFile of htmlFiles) {
			let html = readFileSync(htmlFile, "utf-8");
			const original = html;

			html = inlineOrPreloadGlobalCSS(html, cssCache);
			html = hoistBodyStylesToHead(html);
			html = deferNonCriticalStylesheets(html);
			html = addFontPreloadHints(html);

			if (html !== original) {
				writeFileSync(htmlFile, html);
				patchedCount++;
			}
		}
	}

	if (patchedCount > 0) {
		console.log(
			`[post-build] Optimized ${patchedCount} HTML file(s) — deferred non-critical CSS, added font preload hints`,
		);
	}
}
