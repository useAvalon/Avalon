/**
 * Modulepreload Collector for SSR
 *
 * Collects island chunk bundle paths during SSR rendering for islands
 * that use `on:client` (immediate hydration). These paths are injected
 * as `<link rel="modulepreload">` tags in `<head>` so the browser starts
 * fetching island JS chunks as soon as it parses the head, eliminating
 * the waterfall delay between HTML parse and island JS fetch.
 *
 * Only `on:client` islands with `preload !== false` are collected —
 * deferred islands (on:visible, on:idle, on:interaction, media:*) are
 * intentionally excluded since preloading them would defeat lazy loading.
 */

export type ModulePreloadFetchPriority = "high" | "low" | "auto";

export type ModulePreloadOptions = {
	fetchPriority?: ModulePreloadFetchPriority;
};

type ModulePreloadEntry = {
	path: string;
	fetchPriority?: ModulePreloadFetchPriority;
};

declare global {
	var __modulepreloadPaths: Map<string, ModulePreloadEntry> | undefined;
}

function initCollector(): Map<string, ModulePreloadEntry> {
	globalThis.__modulepreloadPaths ??= new Map();
	return globalThis.__modulepreloadPaths;
}

const PRIORITY_RANK: Record<ModulePreloadFetchPriority, number> = {
	high: 3,
	auto: 2,
	low: 1,
};

/** Merge explicit fetch priorities when registering the same bundle twice. */
export function mergeModulePreloadFetchPriority(
	a?: ModulePreloadFetchPriority,
	b?: ModulePreloadFetchPriority,
): ModulePreloadFetchPriority | undefined {
	if (a === undefined) return b;
	if (b === undefined) return a;
	return PRIORITY_RANK[a] >= PRIORITY_RANK[b] ? a : b;
}

/** Merge priorities where an omitted value counts as browser default (`auto`, above `low`). */
export function mergeModulePreloadWithDefaultRank(
	a?: ModulePreloadFetchPriority,
	b?: ModulePreloadFetchPriority,
): ModulePreloadFetchPriority | undefined {
	const rankA = a ? PRIORITY_RANK[a] : PRIORITY_RANK.auto;
	const rankB = b ? PRIORITY_RANK[b] : PRIORITY_RANK.auto;
	if (rankA > rankB) return a;
	if (rankB > rankA) return b;
	return a;
}

/** Build a single modulepreload link tag. Shared with post-build island dep injection. */
export function formatModulepreloadLink(
	href: string,
	fetchPriority?: ModulePreloadFetchPriority,
): string {
	if (!fetchPriority || fetchPriority === "auto") {
		return `<link rel="modulepreload" href="${href}">`;
	}
	return `<link rel="modulepreload" href="${href}" fetchpriority="${fetchPriority}">`;
}

/**
 * Register an island's bundle path for modulepreload.
 *
 * Call this during SSR when an island with `on:client` condition is rendered.
 * The path is deduplicated automatically (Map-based).
 *
 * @param bundlePath - The island chunk's bundle path (e.g., "/islands/Counter.abc123.js")
 */
export function addModulepreload(bundlePath: string, options?: ModulePreloadOptions): void {
	if (!bundlePath) return;
	const collector = initCollector();
	const existing = collector.get(bundlePath);
	if (existing) {
		existing.fetchPriority = mergeModulePreloadFetchPriority(
			existing.fetchPriority,
			options?.fetchPriority,
		);
		return;
	}
	collector.set(bundlePath, {
		path: bundlePath,
		fetchPriority: options?.fetchPriority,
	});
}

/**
 * Get all collected modulepreload paths.
 *
 * @param clear - Whether to clear the collector after retrieval (default: true)
 * @returns Array of unique bundle paths
 */
export function getModulepreloadPaths(clear = true): string[] {
	const entries = getModulepreloadEntries(clear);
	return entries.map((e) => e.path);
}

function getModulepreloadEntries(clear = true): ModulePreloadEntry[] {
	const collector = initCollector();
	const entries = Array.from(collector.values());
	if (clear) {
		collector.clear();
	}
	return entries;
}

/**
 * Generate `<link rel="modulepreload">` tags for all collected island chunks.
 *
 * @param clear - Whether to clear the collector after extraction (default: true)
 * @returns A string of modulepreload link tags, or empty string if none collected
 */
export function generateModulepreloadTags(clear = true): string {
	const entries = getModulepreloadEntries(clear);
	if (entries.length === 0) return "";

	return entries.map((e) => formatModulepreloadLink(e.path, e.fetchPriority)).join("\n");
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
