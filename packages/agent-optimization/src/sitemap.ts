/**
 * Sitemap generation utilities.
 *
 * Converts discovered routes into sitemap entries and serializes them
 * to XML conforming to the Sitemap Protocol 0.9.
 */

// ---------------------------------------------------------------------------
// Local types — kept self-contained so the module is testable without
// importing from @useavalon/avalon.
// ---------------------------------------------------------------------------

/** Minimal route shape needed by the sitemap generator. */
export interface DiscoveredRoute {
	pattern: string;
}

/** Resolved configuration consumed by `routesToSitemapEntries`. */
export interface ResolvedSitemapConfig {
	siteUrl: string;
	changefreq?: string;
	priority?: number;
	dynamicPaths?: Record<string, string[]>;
	/** Glob patterns or path prefixes to exclude from the sitemap. */
	exclude?: string[];
	/** ISO 8601 date string used for `<lastmod>`. Injectable for testing. */
	lastmod?: string;
}

/** A single `<url>` entry in the sitemap. */
export interface SitemapEntry {
	loc: string;
	lastmod?: string;
	changefreq?: string;
	priority?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DYNAMIC_SEGMENT_RE = /(?:^|\/):\w+|(?:^|\/)(\*\*)/;
const PRIVATE_SEGMENT_RE = /(?:^|\/)_[^/]*/;

/** Returns `true` when the route pattern contains a dynamic segment. */
function isDynamic(pattern: string): boolean {
	return DYNAMIC_SEGMENT_RE.test(pattern);
}

/** Returns `true` when the route pattern contains a private `_`-prefixed segment. */
function isPrivate(pattern: string): boolean {
	return PRIVATE_SEGMENT_RE.test(pattern);
}

/** Escape special XML characters in a string. */
function escapeXml(str: string): string {
	return str
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

/** Resolve the base URL, warning and falling back when missing. */
function resolveBaseUrl(siteUrl: string | undefined): string {
	if (!siteUrl) {
		console.warn(
			"[agent-optimization] siteUrl is not configured — falling back to http://localhost",
		);
		return "http://localhost";
	}
	return siteUrl.replace(/\/+$/, ""); // strip trailing slashes
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Build a single entry with the shared defaults. */
function makeEntry(
	baseUrl: string,
	path: string,
	defaults: { lastmod: string; changefreq: string; priority: number },
): SitemapEntry {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return {
		loc: `${baseUrl}${normalizedPath}`,
		lastmod: defaults.lastmod,
		changefreq: defaults.changefreq,
		priority: defaults.priority,
	};
}

/** Expand a dynamic route pattern into entries using `dynamicPaths`. */
function expandDynamicRoute(
	pattern: string,
	baseUrl: string,
	dynamicPaths: Record<string, string[]>,
	defaults: { lastmod: string; changefreq: string; priority: number },
): SitemapEntry[] {
	const expansions = dynamicPaths[pattern];
	if (!expansions || expansions.length === 0) return [];
	return expansions.map((path) => makeEntry(baseUrl, path, defaults));
}

/**
 * Check if a route pattern matches any of the exclude patterns.
 * Supports exact prefix matching and simple glob patterns with `**`.
 */
function isExcluded(pattern: string, excludePatterns: string[]): boolean {
	for (const exclude of excludePatterns) {
		if (exclude.endsWith("/**")) {
			// Glob: /admin/** matches /admin, /admin/foo, /admin/foo/bar
			const prefix = exclude.slice(0, -3);
			if (pattern === prefix || pattern.startsWith(prefix + "/")) return true;
		} else if (pattern === exclude) {
			// Exact match
			return true;
		}
	}
	return false;
}

/**
 * Convert an array of discovered routes into sitemap entries.
 *
 * - Private routes (paths with `_`-prefixed segments) are excluded.
 * - Dynamic routes (`:param`, `**`) are excluded unless `dynamicPaths`
 *   provides static expansions for the pattern.
 * - Routes matching `exclude` patterns are excluded.
 */
export function routesToSitemapEntries(
	routes: DiscoveredRoute[],
	config: ResolvedSitemapConfig,
): SitemapEntry[] {
	const baseUrl = resolveBaseUrl(config.siteUrl);
	const defaults = {
		lastmod: config.lastmod ?? new Date().toISOString(),
		changefreq: config.changefreq ?? "weekly",
		priority: config.priority ?? 0.5,
	};
	const dynamicPaths = config.dynamicPaths ?? {};
	const excludePatterns = config.exclude ?? [];

	const entries: SitemapEntry[] = [];

	for (const route of routes) {
		const { pattern } = route;

		if (isPrivate(pattern)) continue;
		if (excludePatterns.length > 0 && isExcluded(pattern, excludePatterns)) continue;

		if (isDynamic(pattern)) {
			entries.push(...expandDynamicRoute(pattern, baseUrl, dynamicPaths, defaults));
			continue;
		}

		entries.push(makeEntry(baseUrl, pattern, defaults));
	}

	return entries;
}

/**
 * Serialize an array of sitemap entries into a Sitemap Protocol 0.9 XML string.
 */
export function buildSitemapXml(entries: SitemapEntry[]): string {
	const urls = entries
		.map((entry) => {
			const parts = [`    <loc>${escapeXml(entry.loc)}</loc>`];

			if (entry.lastmod) {
				parts.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
			}
			if (entry.changefreq) {
				parts.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
			}
			if (entry.priority != null) {
				parts.push(`    <priority>${entry.priority}</priority>`);
			}

			return `  <url>\n${parts.join("\n")}\n  </url>`;
		})
		.join("\n");

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		urls,
		"</urlset>",
		"", // trailing newline
	].join("\n");
}
