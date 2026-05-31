/**
 * llms.txt and llms-full.txt generation utilities.
 *
 * Implements the llms.txt standard (llmstxt.org): a markdown file at the
 * site root that gives LLMs a structured overview of the site's content.
 *
 * - llms.txt:      Concise index with H1, summary, and links to pages
 * - llms-full.txt: Full markdown content of all pages concatenated
 */

import { htmlToMarkdown } from "./markdown.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal route shape needed by the llms.txt generator. */
export interface LlmsRoute {
	pattern: string;
	title?: string;
	description?: string;
}

/** Resolved configuration consumed by the generators. */
export interface ResolvedLlmsConfig {
	siteUrl: string;
	siteName: string;
	siteDescription?: string;
	/** Group routes into named sections. Key = H2 heading, value = path prefixes. */
	sections?: Record<string, string[]>;
	/** Glob patterns or path prefixes to exclude. */
	exclude?: string[];
}

/** A single entry in the llms.txt file list. */
export interface LlmsEntry {
	name: string;
	url: string;
	description?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DYNAMIC_SEGMENT_RE = /(?:^|\/):\w+|(?:^|\/)(\*\*)/;
const PRIVATE_SEGMENT_RE = /(?:^|\/)_[^/]*/;

function isDynamic(pattern: string): boolean {
	return DYNAMIC_SEGMENT_RE.test(pattern);
}

function isPrivate(pattern: string): boolean {
	return PRIVATE_SEGMENT_RE.test(pattern);
}

function isExcluded(pattern: string, exclude?: string[]): boolean {
	if (!exclude?.length) return false;
	return exclude.some((ex) => {
		if (ex.endsWith("/**")) {
			const prefix = ex.slice(0, -3);
			return pattern === prefix || pattern.startsWith(prefix + "/");
		}
		return pattern === ex;
	});
}

/** Convert a route pattern like `/blog` into a human-readable name. */
function patternToName(pattern: string): string {
	if (pattern === "/" || pattern === "") return "Home";
	const segments = pattern.replace(/^\//, "").split("/");
	return segments.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" — ");
}

/** Format a single entry as a markdown list item. */
function formatEntry(entry: LlmsEntry): string {
	const desc = entry.description ? `: ${entry.description}` : "";
	return `- [${entry.name}](${entry.url})${desc}`;
}

/** Build a markdown section: H2 heading + entry list. */
function buildSection(heading: string, entries: LlmsEntry[]): string[] {
	return [`## ${heading}`, "", ...entries.map(formatEntry), ""];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Filter and convert discovered routes into llms.txt entries.
 *
 * Excludes dynamic routes, private routes (`_`-prefixed segments),
 * and routes matching the `exclude` patterns.
 */
export function routesToLlmsEntries(routes: LlmsRoute[], config: ResolvedLlmsConfig): LlmsEntry[] {
	const baseUrl = config.siteUrl.replace(/\/+$/, "");

	return routes
		.filter(
			(route) =>
				!isDynamic(route.pattern) &&
				!isPrivate(route.pattern) &&
				!isExcluded(route.pattern, config.exclude),
		)
		.map((route) => ({
			name: route.title || patternToName(route.pattern),
			url: `${baseUrl}${route.pattern === "/" ? "/" : route.pattern}`,
			description: route.description,
		}));
}

/** Build the header block: H1 + optional blockquote. */
function buildHeader(config: ResolvedLlmsConfig): string[] {
	const lines = [`# ${config.siteName}`, ""];
	if (config.siteDescription) {
		lines.push(`> ${config.siteDescription}`, "");
	}
	return lines;
}

/** Group entries into configured sections, returning lines + set of used URLs. */
function buildGroupedSections(
	entries: LlmsEntry[],
	sections: Record<string, string[]>,
): { lines: string[]; used: Set<string> } {
	const used = new Set<string>();
	const lines: string[] = [];

	for (const [heading, prefixes] of Object.entries(sections)) {
		const matched = entries.filter((e) => {
			const entryPath = new URL(e.url).pathname;
			return prefixes.some((p) => entryPath === p || entryPath.startsWith(p + "/"));
		});

		if (matched.length === 0) continue;

		lines.push(...buildSection(heading, matched));
		for (const entry of matched) used.add(entry.url);
	}

	const remaining = entries.filter((e) => !used.has(e.url));
	if (remaining.length > 0) {
		lines.push(...buildSection("Other", remaining));
	}

	return { lines, used };
}

/**
 * Build the llms.txt markdown string.
 *
 * Format per the llmstxt.org spec:
 * - H1 with site name
 * - Blockquote with site description
 * - H2 sections with categorized link lists
 */
export function buildLlmsTxt(entries: LlmsEntry[], config: ResolvedLlmsConfig): string {
	const lines = buildHeader(config);

	if (entries.length === 0) {
		return lines.join("\n");
	}

	const hasSections = config.sections && Object.keys(config.sections).length > 0;

	if (hasSections) {
		const { lines: sectionLines } = buildGroupedSections(entries, config.sections!);
		lines.push(...sectionLines);
	} else {
		lines.push(...buildSection("Pages", entries));
	}

	return lines.join("\n");
}

/**
 * Build the llms-full.txt markdown string.
 *
 * Concatenates the full markdown content of every page, separated by
 * H2 headings with the page title. Requires pre-rendered HTML for each route.
 */
export function buildLlmsFullTxt(
	pages: Array<{ route: LlmsRoute; html: string }>,
	config: ResolvedLlmsConfig,
): string {
	const lines = buildHeader(config);

	for (const { route, html } of pages) {
		const markdown = htmlToMarkdown(html);
		if (!markdown.trim()) continue;

		const title = route.title || patternToName(route.pattern);
		lines.push("---", "", `## ${title}`, "", markdown.trim(), "");
	}

	return lines.join("\n");
}
