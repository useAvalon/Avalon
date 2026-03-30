/**
 * Critical CSS Extraction and Inlining
 *
 * Collects CSS generated during SSR (via the universal CSS collector),
 * inlines it as a <style> tag in <head>, and defers external stylesheets
 * using the media="print" swap pattern for async loading.
 *
 * This eliminates render-blocking CSS requests, improving FCP and LCP.
 */

import { getUniversalCSS } from "./universal-css-collector.ts";
import { minifyCSS } from "./css-utils.ts";

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
 * Convert external third-party <link rel="stylesheet"> tags to use the
 * media="print" swap pattern for async/non-blocking loading.
 *
 * Only defers stylesheets from external origins (https://) — local asset
 * stylesheets (e.g., /assets/entry-client-*.css) are never deferred since
 * they contain essential layout CSS that would cause FOUC if delayed.
 *
 * Stylesheets that already have a media attribute or are marked as critical
 * (data-critical) are left untouched.
 */
export function deferNonCriticalStylesheets(html: string): string {
	const linkRegex = /<link\s+([^>]*rel=["']stylesheet["'][^>]*)>/gi;

	return html.replaceAll(linkRegex, (fullMatch, attrs: string) => {
		// Skip if already has a media attribute or is marked critical
		if (/\bmedia\s*=/i.test(attrs)) return fullMatch;
		if (/data-critical/i.test(attrs)) return fullMatch;

		// Extract the href
		const hrefRegex = /href=["']([^"']+)["']/i;
		const hrefResult = hrefRegex.exec(attrs);
		if (!hrefResult) return fullMatch;

		const href = hrefResult[1];

		// Only defer external (third-party) stylesheets.
		// Local stylesheets (/assets/*, relative paths) are essential and must not be deferred.
		if (!href.startsWith("https://") && !href.startsWith("http://")) {
			return fullMatch;
		}

		const deferredLink = `<link ${attrs} media="print" onload="this.media='all'">`;
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
 *
 * @param html - The rendered HTML string
 * @returns The HTML with critical CSS inlined and external stylesheets deferred
 */
export function inlineCriticalCSS(html: string): string {
	// Step 1: Extract and inline SSR-collected CSS
	const criticalStyle = extractCriticalCSS(true);

	let result = html;

	if (criticalStyle) {
		// Inject the critical CSS into <head>, before </head>
		if (result.includes("</head>")) {
			result = result.replace("</head>", `${criticalStyle}\n</head>`);
		}
	}

	// Step 2: Defer non-critical external stylesheets
	result = deferNonCriticalStylesheets(result);

	return result;
}
