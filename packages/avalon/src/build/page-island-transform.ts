/**
 * Page Island Transform Plugin
 *
 * Transforms components with an `island` prop in TSX/JSX page files so that developers
 * can use any component as an island by simply adding the `island` prop.
 *
 * Before (manual):
 *   import { renderIsland } from '@useavalon/avalon';
 *   {await renderIsland({ src: '/src/components/Counter.tsx', condition: 'on:interaction', framework: 'preact' })}
 *
 * After (auto-wrapped):
 *   import Counter from '../components/Counter.tsx';
 *   <Counter island={{ condition: 'on:interaction' }} someProp={42} />
 *
 * How it works:
 *   The plugin rewrites each `<Component island={opts} ...props />` JSX usage
 *   into an `{await renderIsland({...})}` expression inline in the JSX.
 *   Enclosing functions are marked `async`; `.map()` callbacks are wrapped in
 *   `await Promise.all(...)`. Any component can be an island — no special
 *   directory required.
 *
 *   Preact's renderToString does NOT support async child components in the JSX
 *   tree, so we cannot use async wrapper functions. Instead we directly replace
 *   the JSX element with an await expression.
 *
 * Only applies to files inside the configured pages or layouts directories.
 */

import { dirname } from "node:path";
import type { Plugin } from "vite";
import { addToManifest, generateComponentId } from "../server-islands/manifest.ts";
import { islandSsrExpression, isStaticallyClientOnly } from "./island-ssr-flag.ts";
import { ensureAwaitContextsAsync } from "./page-island-await.ts";

export interface PageIslandTransformOptions {
	/** Directory containing page files (default: src/pages/) */
	pagesDir?: string;
	/** Directory containing layout files (default: src/layouts/) */
	layoutsDir?: string;
	/** Modules configuration for modular architecture */
	modules?: {
		dir: string;
		pagesDirName: string;
		layoutsDirName: string;
	} | null;
	/** Whether to enable verbose logging */
	verbose?: boolean;
}

interface ComponentImport {
	localName: string;
	importPath: string;
	fullMatch: string;
}

interface ParsedJSXElement {
	endIdx: number;
	islandProp: string | null;
	serverProp: string | null;
	keyProp: string | null;
	otherProps: string[];
}

interface ParsedAttribute {
	name: string;
	value: string | null;
	endIdx: number;
}

// ─── Import Discovery ────────────────────────────────────────────────

/**
 * Find all default imports in the code (any component import, not filtered by path)
 */
function findAllDefaultImports(code: string): ComponentImport[] {
	const imports: ComponentImport[] = [];
	const re = /^[ \t]*import\s+([A-Z]\w*)\s+from\s+(['"][^'"]+['"])/gm;
	let m: RegExpExecArray | null = null;
	for (m = re.exec(code); m !== null; m = re.exec(code)) {
		imports.push({
			localName: m[1],
			importPath: m[2].slice(1, -1),
			fullMatch: m[0].trimStart(),
		});
	}
	return imports;
}

/**
 * Fallback prefix aliases used when no matching Vite `resolve.alias` is
 * configured. Order-independent: none is a prefix of another.
 */
const FALLBACK_ALIASES: Array<{ prefix: string; map: (rest: string) => string }> = [
	{ prefix: "@shared/", map: (rest) => `/app/shared/${rest}` },
	{ prefix: "@modules/", map: (rest) => `/app/modules/${rest}` },
	{ prefix: "@/", map: (rest) => `/app/${rest}` },
	{ prefix: "$components/", map: (rest) => `/src/components/${rest}` },
	{ prefix: "$islands/", map: (rest) => `/src/islands/${rest}` },
	{ prefix: "~/", map: (rest) => `/src/${rest}` },
];

/** Prepend a leading slash to an alias replacement if it lacks one. */
function normalizeReplacement(replacement: string): string {
	return replacement.startsWith("/") ? replacement : `/${replacement}`;
}

/** Resolve an import via the user-configured Vite `resolve.alias` entries. */
function resolveViaAliases(
	importPath: string,
	aliases: Array<{ find: string | RegExp; replacement: string }>,
): string | null {
	for (const { find, replacement } of aliases) {
		const target = normalizeReplacement(replacement);
		if (typeof find === "string") {
			if (importPath === find || importPath.startsWith(`${find}/`)) {
				return `${target}${importPath.slice(find.length)}`;
			}
		} else if (find.test(importPath)) {
			return importPath.replace(find, target);
		}
	}
	return null;
}

/** Resolve an import via the built-in fallback prefix aliases. */
function resolveViaFallbackAliases(importPath: string): string | null {
	for (const { prefix, map } of FALLBACK_ALIASES) {
		if (importPath.startsWith(prefix)) return map(importPath.slice(prefix.length));
	}
	return null;
}

/** Resolve a relative import against the file's `/app/` or `/src/` base. */
function resolveRelative(importPath: string, fileId: string): string | null {
	if (!importPath.startsWith(".")) return null;

	const normalized = fileId.replaceAll("\\", "/");
	let baseIndex = normalized.indexOf("/app/");
	if (baseIndex === -1) baseIndex = normalized.indexOf("/src/");
	if (baseIndex === -1) return null;

	const parts = dirname(normalized.slice(baseIndex)).split("/");
	for (const part of importPath.split("/")) {
		if (part === "..") parts.pop();
		else if (part !== ".") parts.push(part);
	}
	return parts.join("/");
}

/**
 * Resolve an import path to an absolute src path for renderIsland.
 * Tries, in order: already-absolute, user Vite aliases, built-in fallback
 * aliases, relative resolution, then a last-resort `/src/<basename>`.
 */
function resolveIslandSrc(
	importPath: string,
	fileId: string,
	aliases: Array<{ find: string | RegExp; replacement: string }> = [],
): string {
	// Already absolute (covers /src/, /app/, and any other root-absolute path).
	if (importPath.startsWith("/")) return importPath;

	return (
		resolveViaAliases(importPath, aliases) ??
		resolveViaFallbackAliases(importPath) ??
		resolveRelative(importPath, fileId) ??
		`/src/${importPath.split("/").pop()}`
	);
}

function detectFramework(src: string): string | undefined {
	if (src.endsWith(".vue")) return "vue";
	if (src.endsWith(".svelte")) return "svelte";
	if (src.includes(".solid.")) return "solid";
	if (src.includes(".lit.")) return "lit";
	if (src.includes(".qwik.")) return "qwik";
	if (src.includes(".react.")) return "react";
	// Default .tsx/.jsx to preact — matches the runtime fallback in
	// detectFrameworkFromFallback and avoids the slow-path file-read
	// detection that fails in production builds.
	if (src.endsWith(".tsx") || src.endsWith(".jsx")) return "preact";
	return undefined;
}

function isPageFile(
	id: string,
	pagesDir: string,
	modules?: PageIslandTransformOptions["modules"],
): boolean {
	const normalized = id.replaceAll("\\", "/");

	// Check traditional pages directory
	const dir = pagesDir.replace(/^\//, "");
	if (normalized.includes(`/${dir}/`) && /\.(tsx|jsx)$/.test(normalized)) {
		return true;
	}

	// Check modular pages directories
	if (modules) {
		const modulesDir = modules.dir.replace(/^\//, "");
		// Pattern: /modules/*/pages/
		const modulePagePattern = new RegExp(`/${modulesDir}/[^/]+/${modules.pagesDirName}/`);
		if (modulePagePattern.test(normalized) && /\.(tsx|jsx)$/.test(normalized)) {
			return true;
		}
	}

	return false;
}

/** Check whether a file is inside the layouts directory */
function isLayoutFile(
	id: string,
	layoutsDir: string,
	modules?: PageIslandTransformOptions["modules"],
): boolean {
	const normalized = id.replaceAll("\\", "/");

	// Check traditional layouts directory
	const dir = layoutsDir.replace(/^\//, "");
	if (normalized.includes(`/${dir}/`) && /\.(tsx|jsx)$/.test(normalized)) {
		return true;
	}

	// Check modular layouts directories
	if (modules) {
		const modulesDir = modules.dir.replace(/^\//, "");
		// Pattern: /modules/*/layouts/
		const moduleLayoutPattern = new RegExp(`/${modulesDir}/[^/]+/${modules.layoutsDirName}/`);
		if (moduleLayoutPattern.test(normalized) && /\.(tsx|jsx)$/.test(normalized)) {
			return true;
		}
	}

	return false;
}

/** Frameworks that are auto-wrapped as islands without requiring the `island` prop.
 *  Qwik components are auto-wrapped with ssrOnly — Qwik's qwikloader handles resumability natively. */
const AUTO_ISLAND_FRAMEWORKS = new Set(["qwik"]);

/** Check if a component import is for an auto-island framework */
function isAutoIslandImport(importPath: string): boolean {
	const src = importPath; // raw import path, not resolved
	const framework = detectFramework(src);
	return framework !== undefined && AUTO_ISLAND_FRAMEWORKS.has(framework);
}

// Regex fragments matching a JSX opening tag with a given attribute. Kept as
// plain constants (not inlined) so the RegExp templates below don't nest a
// `String.raw` template inside another template literal.
const ISLAND_ATTR_PATTERN = String.raw`[\s][^>]*island[\s]*[={]`;
const SERVER_ATTR_PATTERN = String.raw`[\s][^>]*server[\s]*[={]`;
const TAG_BOUNDARY_PATTERN = String.raw`[\s/>]`;

function hasIslandPropUsage(code: string, componentNames: string[]): boolean {
	return componentNames.some((name) => {
		const pattern = new RegExp(`<${name}${ISLAND_ATTR_PATTERN}`);
		return pattern.test(code);
	});
}

/** Check if any components are used with the `server` prop */
function hasServerPropUsage(code: string, componentNames: string[]): boolean {
	return componentNames.some((name) => {
		const pattern = new RegExp(`<${name}${SERVER_ATTR_PATTERN}`);
		return pattern.test(code);
	});
}

/** Check if any auto-island components are used as JSX elements */
function hasAutoIslandUsage(code: string, imports: ComponentImport[]): boolean {
	return imports.some((imp) => {
		if (!isAutoIslandImport(imp.importPath)) return false;
		const pattern = new RegExp(`<${imp.localName}${TAG_BOUNDARY_PATTERN}`);
		return pattern.test(code);
	});
}

/**
 * Build metadata for components that are used with island prop
 */
function buildIslandMeta(
	code: string,
	imports: ComponentImport[],
	fileId: string,
	aliases: Array<{ find: string | RegExp; replacement: string }> = [],
): Map<
	string,
	{
		srcPath: string;
		framework: string | undefined;
		importPath: string;
		autoIsland: boolean;
		hasServerProp: boolean;
	}
> {
	const meta = new Map<
		string,
		{
			srcPath: string;
			framework: string | undefined;
			importPath: string;
			autoIsland: boolean;
			hasServerProp: boolean;
		}
	>();
	for (const imp of imports) {
		const srcPath = resolveIslandSrc(imp.importPath, fileId, aliases);
		const framework = detectFramework(srcPath);

		// Check for explicit island prop usage
		const islandPattern = new RegExp(`<${imp.localName}${ISLAND_ATTR_PATTERN}`);
		// Check for server prop usage
		const serverPattern = new RegExp(`<${imp.localName}${SERVER_ATTR_PATTERN}`);
		const hasIsland = islandPattern.test(code);
		const hasServer = serverPattern.test(code);

		if (hasIsland || hasServer) {
			meta.set(imp.localName, {
				srcPath,
				framework,
				importPath: imp.importPath,
				autoIsland: false,
				hasServerProp: hasServer,
			});
			// Register server islands in the manifest at transform time. This is the
			// reliable detection point: it runs (enforce: "pre") before the JSX is
			// compiled, on the same `srcPath` the runtime renderer hashes. The
			// build-time manifest is read when generating the Nitro server bundle's
			// `virtual:server-island-manifest`, so the endpoint can import components.
			if (hasServer) {
				addToManifest(generateComponentId(srcPath), srcPath);
			}
			continue;
		}

		// Check for auto-island frameworks (e.g. Qwik) used as JSX without island prop
		if (framework && AUTO_ISLAND_FRAMEWORKS.has(framework)) {
			const usagePattern = new RegExp(`<${imp.localName}${TAG_BOUNDARY_PATTERN}`);
			if (usagePattern.test(code)) {
				meta.set(imp.localName, {
					srcPath,
					framework,
					importPath: imp.importPath,
					autoIsland: true,
					hasServerProp: false,
				});
			}
		}
	}
	return meta;
}

// ─── Low-level string scanning helpers ───────────────────────────────

function skipWhitespace(code: string, pos: number): number {
	while (pos < code.length && /\s/.test(code[pos])) pos++;
	return pos;
}

/** Skip a string literal (single, double, or backtick). Returns index after closing quote. */
function skipStringLiteral(code: string, pos: number): number {
	const quote = code[pos];
	pos++;
	while (pos < code.length && code[pos] !== quote) {
		if (code[pos] === "\\") pos++; // skip escaped char
		pos++;
	}
	return pos < code.length ? pos + 1 : pos;
}

/** Skip a template literal including ${...} expressions. Returns index after closing backtick. */
function skipTemplateLiteral(code: string, pos: number): number {
	pos++; // skip opening backtick
	while (pos < code.length && code[pos] !== "`") {
		if (code[pos] === "\\") {
			pos += 2;
			continue;
		}
		if (code[pos] === "$" && code[pos + 1] === "{") {
			pos = skipBracedExpression(pos + 1, code);
			continue;
		}
		pos++;
	}
	return pos < code.length ? pos + 1 : pos;
}

/** Skip a brace-delimited expression `{...}`, handling nested braces and strings. */
function skipBracedExpression(openBraceIdx: number, code: string): number {
	let pos = openBraceIdx + 1;
	let depth = 1;
	while (pos < code.length && depth > 0) {
		const ch = code[pos];
		if (ch === "{") {
			depth++;
			pos++;
		} else if (ch === "}") {
			depth--;
			if (depth > 0) pos++;
		} else if (ch === "'" || ch === '"' || ch === "`") {
			pos = skipStringLiteral(code, pos);
		} else {
			pos++;
		}
	}
	return pos < code.length ? pos + 1 : pos;
}

// ─── JSX Attribute Parsing ───────────────────────────────────────────

/** Parse a JSX expression value `{...}`. Returns the inner expression and end index (after `}`). */
function parseJSXExpressionValue(code: string, pos: number): { value: string; endIdx: number } {
	const exprStart = pos + 1;
	const endIdx = skipBracedExpression(pos, code);
	// endIdx is after the closing }, inner content is between { and }
	return { value: code.slice(exprStart, endIdx - 1), endIdx };
}

/** Parse a quoted string value `"..."` or `'...'`. Returns the value (with double quotes) and end index. */
function parseQuotedValue(code: string, pos: number): { value: string; endIdx: number } {
	const quote = code[pos];
	let i = pos + 1;
	while (i < code.length && code[i] !== quote) {
		if (code[i] === "\\") i++;
		i++;
	}
	const value = `"${code.slice(pos + 1, i)}"`;
	return { value, endIdx: i + 1 };
}

/** Parse a single JSX attribute (name + optional value). Returns null on failure. */
function parseAttribute(code: string, pos: number): ParsedAttribute | null {
	const nameStart = pos;
	let i = pos;
	while (i < code.length && /[a-zA-Z0-9_$]/.test(code[i])) i++;
	const name = code.slice(nameStart, i);
	if (!name) return null;

	i = skipWhitespace(code, i);

	// Boolean attribute (no `=`)
	if (code[i] !== "=") {
		return { name, value: null, endIdx: i };
	}
	i = skipWhitespace(code, i + 1); // skip `=` and whitespace

	// Expression value: {expr}
	if (code[i] === "{") {
		const parsed = parseJSXExpressionValue(code, i);
		return { name, value: parsed.value, endIdx: parsed.endIdx };
	}

	// Quoted string value
	if (code[i] === '"' || code[i] === "'") {
		const parsed = parseQuotedValue(code, i);
		return { name, value: parsed.value, endIdx: parsed.endIdx };
	}

	return null; // unexpected token
}

// ─── JSX Element Parsing ─────────────────────────────────────────────

/** Find the end of a JSX tag — either self-closing `/>` or `>...</Component>`. */
function findTagEnd(
	code: string,
	pos: number,
	componentName: string,
): { endIdx: number; selfClosing: boolean } | null {
	if (code[pos] === "/" && code[pos + 1] === ">") {
		return { endIdx: pos + 2, selfClosing: true };
	}
	if (code[pos] === ">") {
		const closeTag = `</${componentName}>`;
		const closeIdx = code.indexOf(closeTag, pos + 1);
		if (closeIdx === -1) return null;
		return { endIdx: closeIdx + closeTag.length, selfClosing: false };
	}
	return null;
}

/**
 * Parse a JSX element starting at `<ComponentName`.
 * Returns the end index and extracted props, or null if parsing fails.
 */
function parseJSXElement(
	code: string,
	startIdx: number,
	componentName: string,
): ParsedJSXElement | null {
	let i = skipWhitespace(code, startIdx + 1 + componentName.length);

	let islandProp: string | null = null;
	let serverProp: string | null = null;
	let keyProp: string | null = null;
	const otherProps: string[] = [];

	while (i < code.length) {
		i = skipWhitespace(code, i);

		// Check for end of opening tag
		const tagEnd = findTagEnd(code, i, componentName);
		if (tagEnd) {
			return { endIdx: tagEnd.endIdx, islandProp, serverProp, keyProp, otherProps };
		}

		// Parse next attribute
		const attr = parseAttribute(code, i);
		if (!attr) return null;
		i = attr.endIdx;

		if (attr.name === "island") {
			islandProp = attr.value ?? "{}";
		} else if (attr.name === "server") {
			serverProp = attr.value ?? "{}";
		} else if (attr.name === "key") {
			keyProp = attr.value;
		} else {
			const propValue = attr.value === null ? `${attr.name}: true` : `${attr.name}: ${attr.value}`;
			otherProps.push(propValue);
		}
	}

	return null;
}

// ─── JSX Replacement ─────────────────────────────────────────────────

/**
 * Build the bare `await __pageRenderIsland({...})` call from parsed element data.
 *
 * The caller (`replaceIslandJSX`) wraps this in a JSX expression container `{…}`
 * only when the island sits in JSX *child* position. When it's already inside a
 * JSX expression (a ternary/logical branch, `.map()` return, attribute value,
 * etc.) the bare form is emitted so we don't produce invalid `{ … : ({await …}) }`.
 */
function escapeIdent(name: string): string {
	return name.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** True when `name` appears as an identifier outside the excluded source ranges. */
function identifierUsedOutside(
	code: string,
	name: string,
	exclude: Array<[number, number]>,
): boolean {
	const re = new RegExp(String.raw`\b${escapeIdent(name)}\b`, "g");
	for (let m = re.exec(code); m !== null; m = re.exec(code)) {
		const idx = m.index;
		if (exclude.some(([start, end]) => idx >= start && idx < end)) continue;
		return true;
	}
	return false;
}

/**
 * Names whose only runtime uses are statically client-only islands.
 * Those imports can be stripped from the SSR module so browser-only
 * libraries in the island file are not evaluated on the server.
 */
function collectClientOnlyOnlyNames(code: string, names: string[]): Set<string> {
	const result = new Set<string>();
	for (const name of names) {
		const ranges = findComponentTagRanges(code, name);
		const clientOnlyUsages = ranges.filter(
			(r) => r.islandProp && !r.serverProp && isStaticallyClientOnly(r.islandProp),
		);
		if (clientOnlyUsages.length === 0) continue;
		const allIslandUsages = ranges.filter((r) => r.islandProp);
		if (allIslandUsages.length !== clientOnlyUsages.length) continue;

		const exclude: Array<[number, number]> = clientOnlyUsages.map((r) => [r.start, r.end]);
		const importRe = new RegExp(
			String.raw`^[ \t]*import\s+${escapeIdent(name)}\s+from\s+['"][^'"]+['"];?`,
			"m",
		);
		const importMatch = importRe.exec(code);
		if (importMatch) {
			exclude.push([importMatch.index, importMatch.index + importMatch[0].length]);
		}
		if (!identifierUsedOutside(code, name, exclude)) {
			result.add(name);
		}
	}
	return result;
}

function findComponentTagRanges(
	code: string,
	componentName: string,
): Array<{
	start: number;
	end: number;
	islandProp: string | null;
	serverProp: string | null;
}> {
	const tag = `<${componentName}`;
	const ranges: Array<{
		start: number;
		end: number;
		islandProp: string | null;
		serverProp: string | null;
	}> = [];
	let i = 0;
	while (i < code.length) {
		const verbatimEnd = skipVerbatimRegion(code, i);
		if (verbatimEnd !== -1) {
			i = verbatimEnd;
			continue;
		}
		if (!isComponentTagStart(code, i, tag)) {
			i++;
			continue;
		}
		const parsed = parseJSXElement(code, i, componentName);
		if (!parsed) {
			i++;
			continue;
		}
		ranges.push({
			start: i,
			end: parsed.endIdx,
			islandProp: parsed.islandProp,
			serverProp: parsed.serverProp,
		});
		i = parsed.endIdx;
	}
	return ranges;
}

function stripUnusedClientOnlyImports(code: string, names: Iterable<string>): string {
	let result = code;
	for (const name of names) {
		if (result.includes(`component: ${name}`)) continue;
		result = result.replace(
			new RegExp(
				String.raw`^[ \t]*import\s+${escapeIdent(name)}\s+from\s+['"][^'"]+['"];?\s*\n?`,
				"m",
			),
			"",
		);
	}
	return result;
}

function buildRenderCall(
	parsed: ParsedJSXElement,
	srcPath: string,
	framework: string | undefined,
	autoIsland: boolean,
	componentName: string,
	omitComponent: boolean,
): string {
	const fwArg = framework ? `, framework: "${framework}"` : "";
	const propsArg =
		parsed.otherProps.length > 0 ? `, props: { ${parsed.otherProps.join(", ")} }` : "";
	const keyArg = parsed.keyProp != null ? `, key: (${parsed.keyProp})` : "";
	// Pass the component reference so the SSR bundle doesn't need to
	// dynamically import it at runtime (the import is already in scope).
	// Client-only-only islands omit it so the island module is not evaluated on the server.
	const compArg = omitComponent ? "" : `, component: ${componentName}`;

	if (autoIsland) {
		// Auto-island (e.g. Qwik): SSR + resumability via Qwik's native qwikloader.
		// The Qwik Vite plugin transforms component$() / onClick$() etc. into
		// lazy-loadable QRL chunks that the qwikloader resolves at runtime.
		return (
			'await __pageRenderIsland({ src: "' +
			srcPath +
			'"' +
			fwArg +
			compArg +
			propsArg +
			keyArg +
			", ssr: true, ssrOnly: true" +
			" })"
		);
	}

	// Server island (with or without island prop for combined islands)
	if (parsed.serverProp) {
		const serverArg = `, server: (${parsed.serverProp})`;
		const islandArg = parsed.islandProp ? `, island: (${parsed.islandProp})` : "";
		return (
			'await __pageRenderIsland({ src: "' +
			srcPath +
			'"' +
			fwArg +
			compArg +
			serverArg +
			islandArg +
			propsArg +
			keyArg +
			" })"
		);
	}

	const islandValue = parsed.islandProp ?? "";

	return (
		'await __pageRenderIsland({ src: "' +
		srcPath +
		'"' +
		fwArg +
		compArg +
		", ...(" +
		islandValue +
		")" +
		propsArg +
		", ssr: " +
		islandSsrExpression(islandValue) +
		keyArg +
		" })"
	);
}

/**
 * Determines whether a JSX element at `pos` sits in JSX *child* position
 * (needs `{…}` wrapping) or inside a JSX *expression* container (bare).
 *
 * Looks at the last non-whitespace character before the tag:
 * - `>` (a real tag close, not `=>`) or `}` (after a sibling `{expr}`) → child
 * - anything else (`{`, `(`, `?`, `:`, `,`, `&`, `|`, `=>`, `return …`) → expression
 */
function isJSXChildPosition(code: string, pos: number): boolean {
	let j = pos - 1;
	while (j >= 0 && /\s/.test(code[j])) j--;
	if (j < 0) return false;
	const ch = code[j];
	if (ch === ">") {
		// Distinguish an arrow `=>` (expression) from a tag close `>` (child).
		return code[j - 1] !== "=";
	}
	// `}` closes a preceding `{expr}` sibling in a children list → child position.
	return ch === "}";
}

/**
 * If `pos` starts a region that must be copied verbatim (a template literal or a
 * comment — JSX `{/* *​/}`, line `//`, or block `/* *​/`), returns the index just
 * past it; otherwise returns -1. Keeps the main scanner loop flat.
 */
function skipVerbatimRegion(code: string, pos: number): number {
	const two = code.slice(pos, pos + 2);

	// Template literal — avoid transforming code examples inside backticks.
	if (code[pos] === "`") return skipTemplateLiteral(code, pos);

	// JSX comment: {/* ... */}
	if (code[pos] === "{" && two === "{/" && code[pos + 2] === "*") {
		return skipJSXComment(code, pos);
	}

	// Single-line comment: // ...
	if (two === "//") {
		const lineEnd = code.indexOf("\n", pos);
		return lineEnd === -1 ? code.length : lineEnd + 1;
	}

	// Block comment: /* ... */
	if (two === "/*") {
		const commentEnd = code.indexOf("*/", pos + 2);
		return commentEnd === -1 ? code.length : commentEnd + 2;
	}

	return -1;
}

/** Skip a JSX comment (a curly-wrapped block comment) starting at `pos`; returns index after `}` or -1. */
function skipJSXComment(code: string, pos: number): number {
	const commentEnd = code.indexOf("*/", pos + 3);
	if (commentEnd === -1) return -1;
	let after = commentEnd + 2;
	while (after < code.length && /\s/.test(code[after])) after++;
	return after < code.length && code[after] === "}" ? after + 1 : -1;
}

/** Check if position `i` is the start of a `<ComponentName` tag (not a longer identifier). */
function isComponentTagStart(code: string, pos: number, tag: string): boolean {
	if (!code.startsWith(tag, pos)) return false;
	const afterTag = pos + tag.length;
	return afterTag >= code.length || !/[a-zA-Z0-9_$]/.test(code[afterTag]);
}

/**
 * Replace all `<Component island={...} />` JSX usages with `{await __pageRenderIsland({...})}`.
 */
function replaceIslandJSX(
	code: string,
	componentName: string,
	srcPath: string,
	framework: string | undefined,
	autoIsland: boolean,
	omitComponent: boolean,
): string {
	const tag = `<${componentName}`;
	let result = "";
	let i = 0;

	while (i < code.length) {
		// Copy template literals and comments verbatim (don't transform code
		// examples or commented-out island usage).
		const verbatimEnd = skipVerbatimRegion(code, i);
		if (verbatimEnd !== -1) {
			result += code.slice(i, verbatimEnd);
			i = verbatimEnd;
			continue;
		}

		const { text, next } = replaceTagAt(code, i, {
			tag,
			componentName,
			srcPath,
			framework,
			autoIsland,
			omitComponent,
		});
		result += text;
		i = next;
	}

	return result;
}

interface ReplaceTagContext {
	tag: string;
	componentName: string;
	srcPath: string;
	framework: string | undefined;
	autoIsland: boolean;
	omitComponent: boolean;
}

/**
 * Handles a single position `pos`: if it starts an island `<Component …>` usage,
 * returns the replacement call (wrapped in `{…}` only in JSX child position);
 * otherwise returns the source char(s) unchanged. Returns the text to append and
 * the next scan index.
 */
function replaceTagAt(
	code: string,
	pos: number,
	ctx: ReplaceTagContext,
): { text: string; next: number } {
	if (!isComponentTagStart(code, pos, ctx.tag)) {
		return { text: code[pos], next: pos + 1 };
	}

	const parsed = parseJSXElement(code, pos, ctx.componentName);
	if (!parsed || (!parsed.islandProp && !parsed.serverProp && !ctx.autoIsland)) {
		// Not parseable, or no island/server prop and not an auto-island — emit as-is.
		const end = parsed ? parsed.endIdx : pos + 1;
		return { text: code.slice(pos, end), next: end };
	}

	const call = buildRenderCall(
		parsed,
		ctx.srcPath,
		ctx.framework,
		ctx.autoIsland && !parsed.islandProp,
		ctx.componentName,
		ctx.omitComponent && isStaticallyClientOnly(parsed.islandProp),
	);
	// Wrap in a JSX expression container only when the island is a bare JSX child.
	// In expression positions (ternary/logical branch, .map return, attribute
	// value, `return <Island/>`) emit the call bare, or the extra braces would
	// produce invalid syntax like `cond ? a : ({await …})`.
	const text = isJSXChildPosition(code, pos) ? `{${call}}` : call;
	return { text, next: parsed.endIdx };
}

/**
 * Ensures the page/layout's default-export component is `async`, so the injected
 * `await __pageRenderIsland(...)` calls are valid (the SSR renderer awaits page
 * and layout components). Handles the common default-export forms and is a no-op
 * if the component is already async or no recognizable default export is found.
 *
 * Covered forms:
 *   export default function Page() {}          → export default async function …
 *   export default () => {}                    → export default async () => {}
 *   export default props => {}                 → export default async props => {}
 *   export default Page;  (+ decl elsewhere)   → async function Page / const Page = async …
 */
function ensureDefaultExportAsync(code: string): string {
	// export default [async] function …  (not function*)
	if (/\bexport\s+default\s+function\b(?!\s*\*)/.test(code)) {
		return code.replace(
			/\bexport\s+default\s+function\b(?!\s*\*)/,
			"export default async function",
		);
	}

	// export default (params) => …   or   export default param => …
	const arrowRe = /\bexport\s+default\s+(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/;
	if (arrowRe.test(code)) {
		return code.replace(arrowRe, "export default async $1 =>");
	}

	// export default Identifier;  — make the referenced declaration async.
	const refMatch = /\bexport\s+default\s+([A-Za-z_$][\w$]*)\s*;/.exec(code);
	if (refMatch) {
		const name = refMatch[1];
		const escaped = name.replaceAll("$", String.raw`\$&`);

		// function Name( … )  (not already async)
		const fnDeclRe = new RegExp(String.raw`(^|[^.\w])function\s+${escaped}\s*\(`, "m");
		const alreadyAsyncFn = new RegExp(String.raw`\basync\s+function\s+${escaped}\b`);
		if (fnDeclRe.test(code) && !alreadyAsyncFn.test(code)) {
			return code.replace(fnDeclRe, (m) => m.replace("function", "async function"));
		}

		// const Name = (…) => …  |  const Name = function  |  const Name = param => …
		const constDeclRe = new RegExp(
			String.raw`(\b(?:const|let|var)\s+${escaped}\s*=\s*)(?!async\b)(\([^)]*\)\s*=>|function\b|[A-Za-z_$][\w$]*\s*=>)`,
		);
		if (constDeclRe.test(code)) {
			return code.replace(constDeclRe, "$1async $2");
		}
	}

	return code;
}

// ─── Vite Plugin ─────────────────────────────────────────────────────

export function pageIslandTransform(options: PageIslandTransformOptions = {}): Plugin {
	const { pagesDir = "src/pages", layoutsDir = "src/layouts", modules = null } = options;

	let resolvedAliases: Array<{ find: string | RegExp; replacement: string }> = [];

	return {
		name: "avalon:page-island-transform",
		enforce: "pre",

		configResolved(config) {
			resolvedAliases = config.resolve?.alias ?? [];
		},

		transform(code: string, id: string) {
			const isLayout = isLayoutFile(id, layoutsDir, modules);
			if (!isPageFile(id, pagesDir, modules) && !isLayout) return null;

			// Find all component imports (PascalCase default imports)
			const componentImports = findAllDefaultImports(code);
			if (componentImports.length === 0) return null;

			const componentNames = componentImports.map((i) => i.localName);
			if (
				!hasIslandPropUsage(code, componentNames) &&
				!hasServerPropUsage(code, componentNames) &&
				!hasAutoIslandUsage(code, componentImports)
			)
				return null;

			// Build metadata only for components actually used with island prop
			const islandMeta = buildIslandMeta(code, componentImports, id, resolvedAliases);
			if (islandMeta.size === 0) return null;

			const clientOnlyOnlyNames = collectClientOnlyOnlyNames(code, [...islandMeta.keys()]);

			let transformed = `import { renderIsland as __pageRenderIsland } from '@useavalon/avalon';\n${code}`;

			for (const [name, meta] of islandMeta) {
				transformed = replaceIslandJSX(
					transformed,
					name,
					meta.srcPath,
					meta.framework,
					meta.autoIsland,
					clientOnlyOnlyNames.has(name),
				);
			}

			transformed = stripUnusedClientOnlyImports(transformed, clientOnlyOnlyNames);

			// Remaining island imports stay in the module so renderIsland() can
			// SSR the in-scope component without a dynamic import() in the server bundle.

			// Injected `await` calls require async enclosing functions. The
			// default export is marked async; nested helpers and list maps are
			// handled by ensureAwaitContextsAsync.
			if (transformed.includes("__pageRenderIsland(")) {
				transformed = ensureDefaultExportAsync(transformed);
				transformed = ensureAwaitContextsAsync(transformed, id);
			}

			if (transformed.includes("__pageKeyed(")) {
				transformed = transformed.replace(
					"import { renderIsland as __pageRenderIsland } from '@useavalon/avalon';",
					"import { renderIsland as __pageRenderIsland, withListKey as __pageKeyed } from '@useavalon/avalon';",
				);
			}

			return { code: transformed, map: null };
		},
	};
}
