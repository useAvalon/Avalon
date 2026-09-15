/**
 * Critical CSS Extraction and Inlining
 *
 * Collects CSS generated during SSR (via the universal CSS collector),
 * inlines it as a <style> tag in <head>, and defers external stylesheets
 * using the media="print" swap pattern for async loading.
 *
 * This eliminates render-blocking CSS requests, improving FCP and LCP.
 */

import { minifyCSS } from "./css-utils.ts";
import { injectFrameworkBaseCSS } from "./framework-base-css.ts";
import { getUniversalCSS } from "./universal-css-collector.ts";

/**
 * Count brace depth change for a line of CSS.
 */
function braceDepthDelta(line: string): number {
	let delta = 0;
	for (const ch of line) {
		if (ch === "{") delta++;
		else if (ch === "}") delta--;
	}
	return delta;
}

/**
 * Process a completed CSS block: deduplicate by normalized content.
 * Standalone comments (framework markers) are always kept.
 */
function processBlock(block: string, seen: Set<string>, output: string[]): void {
	const normalized = block.replaceAll(/\s+/g, " ").trim();

	// Always keep standalone CSS comments (framework markers)
	if (normalized.startsWith("/*") && normalized.endsWith("*/")) {
		output.push(block.trimEnd());
		return;
	}

	if (!seen.has(normalized)) {
		seen.add(normalized);
		output.push(block.trimEnd());
	}
}

/**
 * Deduplicate CSS rules by normalizing each top-level rule block.
 * Removes exact-duplicate rules while preserving order of first occurrence.
 */
export function deduplicateCSSRules(css: string): string {
	if (!css.trim()) return "";

	const seen = new Set<string>();
	const lines = css.split("\n");
	const output: string[] = [];
	let currentBlock = "";
	let braceDepth = 0;

	for (const line of lines) {
		braceDepth += braceDepthDelta(line);
		currentBlock += `${line}\n`;

		if (braceDepth <= 0 && currentBlock.trim()) {
			processBlock(currentBlock, seen, output);
			currentBlock = "";
			braceDepth = 0;
		}
	}

	// Flush any remaining content
	if (currentBlock.trim()) {
		output.push(currentBlock.trimEnd());
	}

	return output.join("\n");
}

/**
 * Collect SSR-generated CSS from the universal collector, deduplicate it,
 * and return an inline <style> tag suitable for injection into <head>.
 *
 * @param clear - Whether to clear the collector after extraction (default: true)
 * @returns An inline <style> tag string, or empty string if no CSS was collected
 */
export function extractCriticalCSS(clear = true): string {
	const rawCSS = getUniversalCSS(clear);
	if (!rawCSS.trim()) return "";

	const deduped = deduplicateCSSRules(rawCSS);
	const minified = minifyCSS(deduped);

	if (!minified.trim()) return "";

	return `<style data-critical-css="true">${minified}</style>`;
}

/**
 * Convert external third-party <link rel="stylesheet"> tags and explicitly
 * deferred local stylesheets to use the media="print" swap pattern for
 * async/non-blocking loading.
 *
 * Defers:
 * - External stylesheets (https://, http://)
 * - Local stylesheets marked with data-defer attribute
 * - Local stylesheets matching known non-critical patterns (e.g., syntax highlighting)
 *
 * Preserves (never deferred):
 * - Local asset stylesheets (/assets/*) — essential layout CSS
 * - Stylesheets with an existing media attribute
 * - Stylesheets marked as critical (data-critical)
 */
export function deferNonCriticalStylesheets(html: string): string {
	const linkRegex = /<link\s+([^>]*rel=["']stylesheet["'][^>]*)>/gi;

	// Highlight themes paint in the first viewport on docs/blog. Do not
	// auto-defer them. Use data-defer for any other local sheet.

	return html.replaceAll(linkRegex, (fullMatch, attrs: string, offset: number) => {
		const before = html.slice(Math.max(0, offset - 32), offset).toLowerCase();
		if (before.includes("<noscript")) return fullMatch;

		// Preact SSR emits self-closing <link … />; drop the trailing slash from attrs
		const normalizedAttrs = attrs.replace(/\s*\/\s*$/, "").trim();

		// Skip if already has a media attribute or is marked critical
		if (/\bmedia\s*=/i.test(normalizedAttrs)) return fullMatch;
		if (/data-critical/i.test(normalizedAttrs)) return fullMatch;

		// Extract the href
		const hrefRegex = /href=["']([^"']+)["']/i;
		const hrefResult = hrefRegex.exec(normalizedAttrs);
		if (!hrefResult) return fullMatch;

		const href = hrefResult[1];

		// Determine if this stylesheet should be deferred
		const isExternal = href.startsWith("https://") || href.startsWith("http://");
		const isExplicitlyDeferred = /data-defer/i.test(normalizedAttrs);

		if (!isExternal && !isExplicitlyDeferred) {
			return fullMatch;
		}

		// Strip data-defer attribute from output (it was only a signal)
		const cleanAttrs = normalizedAttrs
			.replace(/\s*data-defer(?:=["'][^"']*["'])?\s*/gi, " ")
			.trim();

		const deferredLink = `<link ${cleanAttrs} media="print" onload="this.media='all'">`;
		const noscriptFallback = `<noscript><link rel="stylesheet" href="${href}"></noscript>`;

		return `${deferredLink}\n${noscriptFallback}`;
	});
}

/**
 * Process the full HTML response to inline critical CSS and defer external stylesheets.
 *
 * 1. Extracts SSR-collected CSS from the universal collector
 * 2. Inlines it as a <style> tag in <head>
 * 3. Converts external stylesheet <link> tags to async loading
 * 4. Adds fetchpriority hints for above-the-fold resources
 *
 * @param html - The rendered HTML string
 * @returns The HTML with critical CSS inlined and external stylesheets deferred
 */
export function inlineCriticalCSS(html: string): string {
	// Step 0: Inject framework baseline CSS so <avalon-island>, <avalon-page>,
	// and <avalon-page-content> are transparent in flex/grid layouts.
	let result = injectFrameworkBaseCSS(html);

	// Step 1: Extract and inline SSR-collected CSS
	const criticalStyle = extractCriticalCSS(true);

	if (criticalStyle) {
		// Inject the critical CSS into <head>, before </head>
		if (result.includes("</head>")) {
			result = result.replace("</head>", `${criticalStyle}\n</head>`);
		}
	}

	// Step 2: Defer non-critical external stylesheets
	result = deferNonCriticalStylesheets(result);

	// Step 3: Optimize font preloading — add preload hints for Google Fonts CSS
	// so the browser starts fetching the font CSS earlier (before it encounters
	// the deferred stylesheet link). This reduces the font loading waterfall.
	result = addFontPreloadHints(result);

	return result;
}

/**
 * Add `<link rel="preload" as="style">` hints for Google Fonts CSS URLs.
 *
 * When fonts are loaded via the media="print" async pattern, the browser
 * deprioritizes the fetch. A preload hint tells the browser to start
 * fetching the font CSS at high priority while still not blocking render.
 *
 * This closes the gap between first paint (with fallback font) and
 * font swap, improving Speed Index by reducing the time the page
 * displays with the wrong font metrics.
 */
function addFontPreloadHints(html: string): string {
	// Find Google Fonts CSS URLs that are being loaded (deferred or not)
	const fontUrlRegex = /href=["'](https:\/\/fonts\.googleapis\.com\/css2[^"']+)["']/gi;
	const fontUrls = new Set<string>();

	let match: RegExpExecArray | null;
	for (match = fontUrlRegex.exec(html); match !== null; match = fontUrlRegex.exec(html)) {
		fontUrls.add(match[1]);
	}

	if (fontUrls.size === 0) return html;

	// Don't add preload if one already exists for this URL
	const preloadHints: string[] = [];
	for (const url of fontUrls) {
		// Check for an existing <link rel="preload" ... href="URL"> targeting this exact URL
		const escapedUrl = url.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
		const existingPreload = new RegExp(
			String.raw`<link\s+[^>]*rel=["']preload["'][^>]*href=["']${escapedUrl}["'][^>]*>`,
			"i",
		);
		if (existingPreload.test(html)) continue;

		// No crossorigin — the Google Fonts CSS endpoint is a regular
		// stylesheet request (not CORS). The font *files* referenced
		// inside the CSS use CORS, but the CSS itself does not.
		// A credentials mismatch between preload and the actual request
		// causes the browser to ignore the preload entirely.
		preloadHints.push(`<link rel="preload" href="${url}" as="style">`);
	}

	if (preloadHints.length === 0) return html;

	// Inject preload hints early in <head> (after charset/viewport meta)
	const preloadBlock = preloadHints.join("\n");
	if (html.includes("</title>")) {
		return html.replace("</title>", `</title>\n${preloadBlock}`);
	}

	return html;
}
