/**
 * Modulepreload Collector for SSR
 *
 * Collects island chunk bundle paths during SSR rendering for islands
 * that use `on:client` (immediate hydration). These paths are injected
 * as `<link rel="modulepreload">` tags in `<head>` so the browser starts
 * fetching island JS chunks as soon as it parses the head, eliminating
 * the waterfall delay between HTML parse and island JS fetch.
 *
 * Only `on:client` islands are collected — deferred islands (on:visible,
 * on:idle, on:interaction, media:*) are intentionally excluded since
 * preloading them would defeat the purpose of lazy loading.
 */

declare global {
	var __modulepreloadPaths: Set<string> | undefined;
}

/**
 * Initialize the global modulepreload collector if it doesn't exist.
 */
function initCollector(): Set<string> {
	globalThis.__modulepreloadPaths ??= new Set();
	return globalThis.__modulepreloadPaths;
}

/**
 * Register an island's bundle path for modulepreload.
 *
 * Call this during SSR when an island with `on:client` condition is rendered.
 * The path is deduplicated automatically (Set-based).
 *
 * @param bundlePath - The island chunk's bundle path (e.g., "/islands/Counter.abc123.js")
 */
export function addModulepreload(bundlePath: string): void {
	if (!bundlePath) return;
	const collector = initCollector();
	collector.add(bundlePath);
}

/**
 * Get all collected modulepreload paths.
 *
 * @param clear - Whether to clear the collector after retrieval (default: true)
 * @returns Array of unique bundle paths
 */
export function getModulepreloadPaths(clear = true): string[] {
	const collector = initCollector();
	const paths = Array.from(collector);
	if (clear) {
		collector.clear();
	}
	return paths;
}

/**
 * Generate `<link rel="modulepreload">` tags for all collected island chunks.
 *
 * @param clear - Whether to clear the collector after extraction (default: true)
 * @returns A string of modulepreload link tags, or empty string if none collected
 */
export function generateModulepreloadTags(clear = true): string {
	const paths = getModulepreloadPaths(clear);
	if (paths.length === 0) return "";

	return paths.map((path) => `<link rel="modulepreload" href="${path}">`).join("\n");
}

/**
 * Inject modulepreload link tags into the HTML `<head>`.
 *
 * Extracts collected modulepreload paths, generates `<link rel="modulepreload">`
 * tags, and injects them before `</head>`.
 *
 * @param html - The rendered HTML string
 * @returns HTML with modulepreload links injected into `<head>`
 */
export function injectModulepreloadLinks(html: string): string {
	const tags = generateModulepreloadTags(true);
	if (!tags) return html;

	if (html.includes("</head>")) {
		return html.replace("</head>", `${tags}\n</head>`);
	}

	return html;
}

/**
 * Clear all collected modulepreload paths.
 */
export function clearModulepreloads(): void {
	const collector = initCollector();
	collector.clear();
}

/**
 * Get the current number of collected modulepreload paths.
 */
export function getModulepreloadCount(): number {
	const collector = initCollector();
	return collector.size;
}
