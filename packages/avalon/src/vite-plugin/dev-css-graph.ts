/**
 * Dev CSS for Nitro SSR is collected from each page's static import graph
 * (plus layouts and global CSS), not by globbing every `.css` file on disk.
 * The layouts virtual module lives in Nitro's realm, so this walk is filesystem
 * based — Vite's module graph is not available there.
 */

import { readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import {
	type DevCssRouteEntry,
	type DevCssRouteTable,
	stripTrailingSlash,
} from "../render/dev-css-select.ts";

export { matchPathPattern, selectDevCssHrefs } from "../render/dev-css-select.ts";
export type { DevCssRouteEntry, DevCssRouteTable };

const FOLLOW_EXTENSIONS = [
	".tsx",
	".ts",
	".jsx",
	".js",
	".mjs",
	".cjs",
	".vue",
	".svelte",
	".mdx",
	".md",
	".css",
	".scss",
	".sass",
	".less",
	".styl",
	".stylus",
];

const CSS_EXTENSIONS = new Set([".css", ".scss", ".sass", ".less", ".styl", ".stylus"]);

const INDEX_NAMES = FOLLOW_EXTENSIONS.map((ext) => `index${ext}`);

const JS_FROM_RE = /(?:from|import)\s+['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const CSS_IMPORT_RE = /@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]/g;

export interface LayoutCssEntry {
	prefix: string;
	filePath: string;
	isRoot: boolean;
	skipRoot: boolean;
}

function isCssPath(file: string): boolean {
	return CSS_EXTENSIONS.has(extname(file.split("?")[0]).toLowerCase());
}

function toHref(cwd: string, absPath: string): string {
	const rel = relative(cwd, absPath).replaceAll("\\", "/");
	return rel.startsWith("/") ? rel : `/${rel}`;
}

function tryFile(abs: string): string | null {
	const clean = abs.split("?")[0];
	try {
		if (!statSync(clean).isFile()) return null;
	} catch {
		return null;
	}
	return clean;
}

function firstExisting(candidates: string[]): string | null {
	for (const candidate of candidates) {
		const found = tryFile(candidate);
		if (found) return found;
	}
	return null;
}

export interface CssGraphAlias {
	find: string | RegExp;
	replacement: string;
}

/** Same fallbacks as `mdx-island-transform` so MDX `import X from '@shared/…'` reaches CSS. */
export function defaultCssGraphAliases(cwd: string): CssGraphAlias[] {
	return [
		{ find: "@shared", replacement: join(cwd, "app/shared") },
		{ find: "@modules", replacement: join(cwd, "app/modules") },
		{ find: "@/", replacement: `${join(cwd, "app")}/` },
		{ find: "$islands", replacement: join(cwd, "src/islands") },
		{ find: "$components", replacement: join(cwd, "src/components") },
		{ find: "~/", replacement: `${join(cwd, "src")}/` },
	];
}

function applyStringAlias(spec: string, find: string, replacement: string): string | null {
	if (spec === find) return replacement;
	const prefix = find.endsWith("/") ? find : `${find}/`;
	if (!spec.startsWith(prefix)) return null;
	const rest = spec.slice(prefix.length);
	if (replacement.endsWith("/")) return `${replacement}${rest}`;
	return rest ? `${replacement}/${rest}` : replacement;
}

function resolveAliasedSpec(spec: string, aliases: CssGraphAlias[]): string | null {
	for (const alias of aliases) {
		const find = alias.find;
		if (typeof find === "string") {
			const mapped = applyStringAlias(spec, find, alias.replacement);
			if (mapped) return mapped;
			continue;
		}
		if (find.test(spec)) {
			return spec.replace(find, alias.replacement);
		}
	}
	return null;
}

function resolveExistingFile(base: string): string | null {
	const direct = tryFile(base);
	if (direct) return direct;
	if (extname(base.split("?")[0])) return null;
	return firstExisting([
		...FOLLOW_EXTENSIONS.map((ext) => base + ext),
		...INDEX_NAMES.map((name) => join(base, name)),
	]);
}

/** Resolve a relative, root-absolute, or aliased specifier to an existing file. */
export function resolveProjectImport(
	fromFile: string,
	spec: string,
	cwd: string,
	aliases: CssGraphAlias[] = [],
): string | null {
	const bare = spec.split("?")[0].split("#")[0];
	if (!bare) return null;
	if (/^(https?:|data:|virtual:)/i.test(bare)) return null;
	if (bare.startsWith("\0")) return null;

	const aliased = resolveAliasedSpec(bare, [...aliases, ...defaultCssGraphAliases(cwd)]);
	if (aliased) return resolveExistingFile(aliased);

	if (!(bare.startsWith(".") || bare.startsWith("/"))) return null;

	const base = bare.startsWith("/") ? join(cwd, bare.slice(1)) : resolve(dirname(fromFile), bare);
	return resolveExistingFile(base);
}

function captureGroups(source: string, re: RegExp): string[] {
	return [...source.matchAll(re)].flatMap((m) => (m[1] ? [m[1]] : []));
}

function specifiersInSource(source: string, isCss: boolean): string[] {
	if (isCss) return captureGroups(source, CSS_IMPORT_RE);
	return [
		...captureGroups(source, JS_FROM_RE),
		...captureGroups(source, DYNAMIC_IMPORT_RE),
		...captureGroups(source, CSS_IMPORT_RE),
	];
}

function isNodeModules(file: string): boolean {
	return file.includes("/node_modules/") || file.includes("\\node_modules\\");
}

function readText(file: string): string | null {
	try {
		return readFileSync(file, "utf8");
	} catch {
		return null;
	}
}

/**
 * Collect `/`-rooted CSS hrefs reachable from `entryFile` via static imports
 * and CSS `@import`. Skips `node_modules`.
 */
export function collectCssHrefsFromEntry(
	entryFile: string,
	cwd: string,
	aliases: CssGraphAlias[] = [],
): string[] {
	const hrefs: string[] = [];
	const visited = new Set<string>();
	const queue = [resolve(entryFile)];

	while (queue.length > 0) {
		const file = queue.pop();
		if (!file || visited.has(file) || isNodeModules(file)) continue;
		visited.add(file);

		const source = readText(file);
		if (source === null) continue;

		const css = isCssPath(file);
		if (css) hrefs.push(toHref(cwd, file));

		for (const spec of specifiersInSource(source, css)) {
			const resolved = resolveProjectImport(file, spec, cwd, aliases);
			if (resolved && !visited.has(resolved) && !isNodeModules(resolved)) {
				queue.push(resolved);
			}
		}
	}

	return unique(hrefs);
}

function unique(items: string[]): string[] {
	return [...new Set(items)];
}

function merge(...lists: string[][]): string[] {
	return unique(lists.flat());
}

function layoutMatchesPath(pathname: string, prefix: string): boolean {
	if (prefix === "/") return true;
	const clean = stripTrailingSlash(pathname);
	const norm = stripTrailingSlash(prefix);
	return clean === norm || clean.startsWith(`${norm}/`);
}

function collectGlobalCssHrefs(cwd: string, globalCSS: string[]): string[] {
	const hrefs: string[] = [];
	for (const entry of globalCSS) {
		const spec = entry.startsWith("/") ? entry : `/${entry}`;
		const abs = resolve(cwd, spec.slice(1));
		const found = tryFile(abs);
		if (found) {
			hrefs.push(...collectCssHrefsFromEntry(found, cwd));
			continue;
		}
		hrefs.push(spec);
	}
	return unique(hrefs);
}

function hrefsForRoute(
	route: { pattern: string; filePath: string },
	cwd: string,
	globalHrefs: string[],
	layoutHrefs: Array<LayoutCssEntry & { hrefs: string[] }>,
	aliases: CssGraphAlias[],
): DevCssRouteEntry {
	const pageHrefs = collectCssHrefsFromEntry(route.filePath, cwd, aliases);
	const matching = layoutHrefs.filter((l) => layoutMatchesPath(route.pattern, l.prefix));
	const skipRoot = matching.some((l) => !l.isRoot && l.skipRoot);
	const layoutCss = matching.filter((l) => !(l.isRoot && skipRoot)).flatMap((l) => l.hrefs);
	return {
		pattern: route.pattern,
		pageHrefs: merge(globalHrefs, pageHrefs),
		hrefs: merge(globalHrefs, layoutCss, pageHrefs),
	};
}

/**
 * Build the per-route CSS table used by `virtual:avalon/layouts` in development.
 */
export function buildDevCssRouteTable(options: {
	cwd: string;
	routes: Array<{ pattern: string; filePath: string }>;
	layouts: LayoutCssEntry[];
	globalCSS: string[];
	aliases?: CssGraphAlias[];
}): DevCssRouteTable {
	const aliases = options.aliases ?? [];
	const globalHrefs = collectGlobalCssHrefs(options.cwd, options.globalCSS);

	const layoutHrefs = options.layouts.map((layout) => ({
		...layout,
		hrefs: collectCssHrefsFromEntry(layout.filePath, options.cwd, aliases),
	}));

	const rootHrefs = merge(...layoutHrefs.filter((l) => l.isRoot).map((l) => l.hrefs));

	return {
		globalHrefs,
		fallbackHrefs: merge(globalHrefs, rootHrefs),
		routes: options.routes.map((route) =>
			hrefsForRoute(route, options.cwd, globalHrefs, layoutHrefs, aliases),
		),
	};
}
