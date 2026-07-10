/**
 * Astro → Avalon translation knowledge.
 *
 * Agents frequently reach for Astro's `client:*` template directives when
 * writing Avalon code. This module encodes the correct mapping and a scanner
 * that detects Astro-isms in a snippet and rewrites them to Avalon syntax.
 *
 * @module knowledge/astro-map
 */

/** A single Astro directive and its Avalon equivalent. */
export interface DirectiveMapping {
	astro: string;
	avalon: string;
	note: string;
}

/** The canonical mapping table from Astro directives to Avalon's `island` prop. */
export const DIRECTIVE_MAP: DirectiveMapping[] = [
	{
		astro: "client:load",
		avalon: "island={{ condition: 'on:client' }}",
		note: "Hydrate immediately on page load.",
	},
	{
		astro: "client:visible",
		avalon: "island={{ condition: 'on:visible' }}",
		note: "Hydrate when the component scrolls into view.",
	},
	{
		astro: "client:idle",
		avalon: "island={{ condition: 'on:idle' }}",
		note: "Hydrate when the browser is idle.",
	},
	{
		astro: "client:media={QUERY}",
		avalon: "island={{ condition: 'media:QUERY' }}",
		note: "Hydrate when a media query matches. The query moves inline after `media:`.",
	},
	{
		astro: "client:only={FRAMEWORK}",
		avalon: "island={{ condition: 'on:client' }}",
		note: "Avalon has no client-only mode — every island is server-rendered first. Use `on:client` for immediate hydration; the framework is auto-detected from the component file.",
	},
	{
		astro: "client:visible={{ rootMargin }}",
		avalon: "island={{ condition: 'on:visible' }}",
		note: "Avalon's `on:visible` uses a fixed 50px rootMargin and takes no options object.",
	},
];

/** Broader Astro→Avalon concept mapping beyond hydration directives. */
export const CONCEPT_MAP: DirectiveMapping[] = [
	{
		astro: ".astro component files",
		avalon: ".tsx / .jsx / framework files (Preact, React, Vue, Svelte, Solid, Lit, Qwik)",
		note: "Avalon has no `.astro` file format. Pages and components are ordinary framework files.",
	},
	{
		astro: "Astro.props",
		avalon: "ordinary function props: export default function Page(props) { ... }",
		note: "Props are passed and read like normal JSX component props.",
	},
	{
		astro: "Astro.request / Astro.url",
		avalon: "the `event` prop (H3Event): event.context.params, event.path, etc.",
		note: "Pages receive an H3 `event`. Access params via event.context.params.",
	},
	{
		astro: "--- frontmatter code fence --- in .astro files",
		avalon: "normal module scope in .tsx pages; YAML frontmatter only in .mdx pages",
		note: "There is no code fence. Do imports/logic at module scope or inside the component.",
	},
	{
		astro: "src/pages/ (Astro)",
		avalon: "src/pages/ (same idea) with [slug] / [...slug] dynamic segments",
		note: "File-system routing is similar; special files are _layout.tsx, _middleware.ts, _error.tsx, 404.tsx.",
	},
	{
		astro: "getStaticPaths()",
		avalon: "dynamic routes via [slug].tsx reading event.context.params",
		note: "Avalon does not use getStaticPaths; use file-based dynamic segments.",
	},
	{
		astro: "Astro Actions (defineAction from 'astro:actions')",
		avalon: "defineAction from '@useavalon/avalon/actions'; call via the `actions` proxy from 'virtual:avalon/actions'",
		note: "Similar concept, different import. Handlers return values; the client gets { data, error }.",
	},
	{
		astro: "<Fragment slot=...> / named slots",
		avalon: "children props / composition (framework-native)",
		note: "Use the component model of your chosen framework.",
	},
];

/** Result of scanning a snippet for Astro-isms. */
export interface LintFinding {
	/** The problematic text found. */
	found: string;
	/** Suggested Avalon replacement. */
	suggestion: string;
	/** Why this matters. */
	reason: string;
	/** Line number (1-based) where the issue was found, if known. */
	line?: number;
}

const ARG = String.raw`(?:\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*'|[^\s/>]+))?`;
const CLIENT_DIRECTIVE_RE = new RegExp(`client:(load|visible|idle|media|only)${ARG}`, "g");
const CLIENT_DIRECTIVE_SINGLE_RE = new RegExp(`client:(load|visible|idle|media|only)${ARG}`);

/**
 * Rewrite a single Astro `client:*` attribute occurrence to the Avalon
 * `island` prop equivalent.
 */
export function convertClientDirective(match: string): string {
	const m = CLIENT_DIRECTIVE_SINGLE_RE.exec(match);
	if (!m) return match;
	const kind = m[1];
	const rawArg = m[2];

	switch (kind) {
		case "load":
		case "only":
			return "island={{ condition: 'on:client' }}";
		case "visible":
			return "island={{ condition: 'on:visible' }}";
		case "idle":
			return "island={{ condition: 'on:idle' }}";
		case "media": {
			const query = extractQuery(rawArg);
			return `island={{ condition: 'media:${query}' }}`;
		}
		default:
			return match;
	}
}

function extractQuery(rawArg: string | undefined): string {
	if (!rawArg) return "(max-width: 768px)";
	// strip surrounding {} or quotes
	return rawArg
		.replace(/^\{/, "")
		.replace(/\}$/, "")
		.replace(/^['"]/, "")
		.replace(/['"]$/, "")
		.trim();
}

/**
 * Scan a code snippet for Astro-specific syntax that does not exist in Avalon
 * and return findings with suggested rewrites.
 */
export function lintForAstroisms(snippet: string): LintFinding[] {
	const findings: LintFinding[] = [];
	const lines = snippet.split("\n");

	lines.forEach((lineText, index) => {
		const lineNo = index + 1;

		// client:* directives
		for (const match of lineText.matchAll(CLIENT_DIRECTIVE_RE)) {
			findings.push({
				found: match[0],
				suggestion: convertClientDirective(match[0]),
				reason:
					"Astro uses `client:*` template attributes. Avalon uses a single `island={{ condition: '...' }}` prop instead.",
				line: lineNo,
			});
		}

		if (/\bAstro\.(props|request|url|params|redirect|cookies|glob)\b/.test(lineText)) {
			const m = /\bAstro\.(props|request|url|params|redirect|cookies|glob)\b/.exec(lineText);
			findings.push({
				found: m?.[0] ?? "Astro.*",
				suggestion:
					"Use component props and the H3 `event` prop (event.context.params, event.path). There is no global `Astro` object.",
				reason: "`Astro.*` globals do not exist in Avalon.",
				line: lineNo,
			});
		}

		if (/from\s+['"]astro:actions['"]/.test(lineText)) {
			findings.push({
				found: lineText.trim(),
				suggestion: `import { defineAction, ActionError } from '@useavalon/avalon/actions';`,
				reason: "Avalon actions come from `@useavalon/avalon/actions`, not `astro:actions`.",
				line: lineNo,
			});
		}

		if (/\.astro\b/.test(lineText)) {
			findings.push({
				found: (/[\w./-]+\.astro\b/.exec(lineText) ?? [".astro"])[0],
				suggestion:
					"Avalon has no `.astro` files. Use `.tsx`/`.jsx` (or .vue/.svelte/etc.) framework components.",
				reason: "The `.astro` file format is Astro-only.",
				line: lineNo,
			});
		}

		if (/\bgetStaticPaths\b/.test(lineText)) {
			findings.push({
				found: "getStaticPaths",
				suggestion:
					"Use file-based dynamic routes: src/pages/blog/[slug].tsx and read event.context.params.slug.",
				reason: "Avalon does not use `getStaticPaths`.",
				line: lineNo,
			});
		}
	});

	return findings;
}

/**
 * Produce a fully converted snippet by applying the `client:*` rewrites. Note
 * this only rewrites hydration directives (the most common mechanical fix);
 * other Astro-isms are reported via {@link lintForAstroisms}.
 */
export function convertSnippet(snippet: string): string {
	return snippet.replace(CLIENT_DIRECTIVE_RE, (match) => convertClientDirective(match));
}
