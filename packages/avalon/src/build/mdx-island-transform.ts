/**
 * MDX Island Transform Plugin
 *
 * Transforms island component usage in MDX files into renderIsland() calls.
 *
 * Supports two patterns:
 * 1. Imports from islands/ directories (legacy pattern)
 * 2. Components used with the `island` prop (preferred pattern)
 *
 * Problem: MDX files import island components directly and render them as raw JSX.
 * After MDX compilation, these become jsxDEV(ComponentName, ...) calls. Preact's
 * renderToString doesn't support async components, so we can't use async wrappers.
 *
 * Solution: Replaces the compiled JSX calls (_jsxDEV(Component, { island: ... }))
 * with await expressions that call renderIsland() directly. This allows proper
 * async SSR rendering of islands in MDX files.
 */

import { dirname } from "node:path";
import type { Plugin } from "vite";
import { islandSsrExpression } from "./island-ssr-flag.ts";

export interface MDXIslandTransformOptions {
	islandPathPatterns?: RegExp[];
	verbose?: boolean;
}

const DEFAULT_ISLAND_PATTERNS = [
	/['"]\.\.\/islands\//,
	/['"]\.\/islands\//,
	/['"]\.\.\/\.\.\/islands\//,
	/['"]\$islands\//,
	/['"]@\/islands\//,
	/['"]\/src\/islands\//,
];

interface IslandImport {
	localName: string;
	importPath: string;
	islandPropUsage: boolean;
	autoIsland: boolean;
}

type ViteAlias = { find: string | RegExp; replacement: string };

/** Qwik uses resumability — auto-wrap as ssrOnly without an `island` prop. */
const AUTO_ISLAND_FRAMEWORKS = new Set(["qwik"]);

const FALLBACK_ALIASES: Array<{ prefix: string; map: (rest: string) => string }> = [
	{ prefix: "@shared/", map: (rest) => `/app/shared/${rest}` },
	{ prefix: "@modules/", map: (rest) => `/app/modules/${rest}` },
	{ prefix: "@/", map: (rest) => `/app/${rest}` },
	{ prefix: "$components/", map: (rest) => `/src/components/${rest}` },
	{ prefix: "$islands/", map: (rest) => `/src/islands/${rest}` },
	{ prefix: "~/", map: (rest) => `/src/${rest}` },
];

const ISLAND_PROP_IN_PROPS_RE = /\bisland\s*:\s*/;
const FIRST_IMPORT_LINE_RE = /^import [^\n]+from [^\n]+\n/m;
function compiledJsxStartRe(): RegExp {
	return /(?:_?jsxs?(?:DEV)?)\s*\(\s*([A-Z]\w*)\s*,/g;
}

/**
 * Find all default imports in the code
 */
function findAllDefaultImports(code: string): Map<string, string> {
	const imports = new Map<string, string>();
	const re = /import\s+([A-Z]\w*)\s+from\s+(['"][^'"]+['"])/g;
	for (let m = re.exec(code); m !== null; m = re.exec(code)) {
		const localName = m[1];
		const importPath = m[2].slice(1, -1);
		imports.set(localName, importPath);
	}
	return imports;
}

function isTopLevelPropertyKey(propsStr: string, pos: number, key: string): boolean {
	const rest = propsStr.slice(pos);
	if (!rest.startsWith(key)) return false;
	if (!/^\s*:/.test(rest.slice(key.length))) return false;
	const prev = propsStr[pos - 1];
	return pos === 1 || !/\w/.test(prev);
}

/**
 * True when `key` is a top-level property of a `{ ... }` object literal.
 * Nested objects (including compiled child JSX props) do not count.
 */
function hasTopLevelKey(propsStr: string, key: string): boolean {
	let pos = 1;
	let depth = 1;
	while (pos < propsStr.length && depth > 0) {
		if (depth === 1 && isTopLevelPropertyKey(propsStr, pos, key)) {
			return true;
		}
		const ch = propsStr[pos];
		if (ch === "{" || ch === "(" || ch === "[") {
			depth++;
			pos++;
		} else if (ch === "}" || ch === ")" || ch === "]") {
			depth--;
			pos++;
		} else if (ch === "'" || ch === '"' || ch === "`") {
			pos = skipStringLiteral(propsStr, pos);
		} else {
			pos++;
		}
	}
	return false;
}

/** Raw MDX/JSX tags whose attributes include an `island` prop. */
function findRawJsxIslandComponents(code: string): Set<string> {
	const components = new Set<string>();
	const tagStartRe = /<([A-Z]\w*)\b/g;
	for (let m = tagStartRe.exec(code); m !== null; m = tagStartRe.exec(code)) {
		let i = m.index + m[0].length;
		while (i < code.length) {
			const ch = code[i];
			if (ch === ">") break;
			if (ch === "/" && code[i + 1] === ">") break;
			if (ch === "'" || ch === '"' || ch === "`") {
				i = skipStringLiteral(code, i);
				continue;
			}
			i++;
		}
		const attrs = code.slice(m.index + m[0].length, i);
		if (/\bisland\s*[={]/.test(attrs)) {
			components.add(m[1]);
		}
	}
	return components;
}

/**
 * Find components used with the island prop in the code
 * Handles both raw JSX (<Component island={...}) and compiled JSX (_jsxDEV(Component, { island:)
 */
function findIslandPropUsage(code: string): Set<string> {
	const components = findRawJsxIslandComponents(code);

	// Match each compiled jsx(Component, { ... }) and only count a top-level island key.
	// A flat `[^}]*island` scan would also match a child's island inside `children:`.
	const compiledJsxRe = compiledJsxStartRe();
	for (let m = compiledJsxRe.exec(code); m !== null; m = compiledJsxRe.exec(code)) {
		let pos = m.index + m[0].length;
		while (pos < code.length && /\s/.test(code[pos])) pos++;
		if (code[pos] !== "{") continue;
		const propsEnd = skipBracedExpression(code, pos);
		if (hasTopLevelKey(code.slice(pos, propsEnd), "island")) {
			components.add(m[1]);
		}
	}

	return components;
}

/** Components referenced in compiled MDX jsx/jsxs calls (_jsxDEV(Foo, …)). */
function findCompiledJsxUsage(code: string): Set<string> {
	const components = new Set<string>();
	const compiledJsxRe = compiledJsxStartRe();
	for (let m = compiledJsxRe.exec(code); m !== null; m = compiledJsxRe.exec(code)) {
		components.add(m[1]);
	}
	return components;
}

function findIslandImports(code: string, patterns: RegExp[]): IslandImport[] {
	const imports: IslandImport[] = [];
	const allImports = findAllDefaultImports(code);
	const islandPropComponents = findIslandPropUsage(code);
	const jsxComponents = findCompiledJsxUsage(code);

	for (const [localName, importPath] of allImports) {
		const quotedPath = `"${importPath}"`;
		const isFromIslandsDir = patterns.some((p) => p.test(quotedPath));
		const hasIslandProp = islandPropComponents.has(localName);
		const framework = detectFramework(importPath);
		const autoIsland =
			Boolean(framework && AUTO_ISLAND_FRAMEWORKS.has(framework)) &&
			jsxComponents.has(localName) &&
			!hasIslandProp;

		if (isFromIslandsDir || hasIslandProp || autoIsland) {
			imports.push({ localName, importPath, islandPropUsage: hasIslandProp, autoIsland });
		}
	}

	return imports;
}

function normalizeReplacement(replacement: string): string {
	return replacement.startsWith("/") ? replacement : `/${replacement}`;
}

function resolveViaAliases(importPath: string, aliases: ViteAlias[]): string | null {
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

function resolveViaFallbackAliases(importPath: string): string | null {
	for (const { prefix, map } of FALLBACK_ALIASES) {
		if (importPath.startsWith(prefix)) return map(importPath.slice(prefix.length));
	}
	return null;
}

function resolveRelativeImport(importPath: string, fileId: string): string | null {
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

function resolveIslandsDirFallback(importPath: string): string | null {
	if (!importPath.includes("/islands/")) return null;
	return `/src/islands/${importPath.split("/").at(-1)}`;
}

/**
 * Resolve an import path to an absolute src path for renderIsland
 */
function resolveIslandSrc(importPath: string, fileId: string, aliases: ViteAlias[] = []): string {
	if (importPath.startsWith("/")) return importPath;

	return (
		resolveViaAliases(importPath, aliases) ??
		resolveViaFallbackAliases(importPath) ??
		resolveRelativeImport(importPath, fileId) ??
		resolveIslandsDirFallback(importPath) ??
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
	if (src.endsWith(".tsx") || src.endsWith(".jsx")) return "preact";
	return undefined;
}

/**
 * Skip a brace-delimited expression `{...}`, handling nested braces and strings.
 * Returns the index after the closing brace.
 */
function skipBracedExpression(code: string, openBraceIdx: number): number {
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

/**
 * Skip a string literal (single, double, or backtick).
 * Returns index after closing quote.
 */
function skipStringLiteral(code: string, pos: number): number {
	const quote = code[pos];
	pos++;
	while (pos < code.length && code[pos] !== quote) {
		if (code[pos] === "\\") pos++; // skip escaped char
		pos++;
	}
	return pos < code.length ? pos + 1 : pos;
}

/**
 * Find the end of a JSX function call: _jsxDEV(Component, {...}, ...)
 * Returns the index after the closing parenthesis.
 */
function findJsxCallEnd(code: string, startIdx: number): number {
	let pos = startIdx;
	let depth = 0;

	while (pos < code.length && code[pos] !== "(") pos++;
	if (pos >= code.length) return startIdx;

	while (pos < code.length) {
		const ch = code[pos];
		if (ch === "(") {
			depth++;
			pos++;
		} else if (ch === ")") {
			depth--;
			pos++;
			if (depth === 0) return pos;
		} else if (ch === "{") {
			pos = skipBracedExpression(code, pos);
		} else if (ch === "'" || ch === '"' || ch === "`") {
			pos = skipStringLiteral(code, pos);
		} else {
			pos++;
		}
	}
	return pos;
}

function findIslandValueEnd(propsStr: string, islandStart: number): number {
	if (propsStr[islandStart] === "{") {
		return skipBracedExpression(propsStr, islandStart);
	}

	let pos = islandStart;
	let depth = 0;
	while (pos < propsStr.length) {
		const ch = propsStr[pos];
		if (ch === "{" || ch === "[" || ch === "(") {
			depth++;
			pos++;
		} else if (ch === "}" || ch === "]" || ch === ")") {
			if (depth === 0) break;
			depth--;
			pos++;
		} else if (ch === "," && depth === 0) {
			break;
		} else {
			pos++;
		}
	}
	return pos;
}

function mergePropsWithoutIsland(propsStr: string, islandIndex: number, islandEnd: number): string {
	const beforeIsland = propsStr.slice(0, islandIndex).trim();
	const afterIsland = propsStr.slice(islandEnd).trim();
	let otherProps = beforeIsland;
	if (afterIsland.startsWith(",")) {
		otherProps += afterIsland.slice(1);
	} else {
		otherProps += afterIsland;
	}
	return otherProps.replace(/,\s*}$/, "}").replace(/{\s*,/, "{");
}

/**
 * Extract the island prop value from a JSX props object.
 * Given `{ island: { condition: 'on:interaction' }, other: 1 }`, returns `{ condition: 'on:interaction' }`
 */
function extractIslandProp(propsStr: string): { islandValue: string; otherProps: string } | null {
	const islandMatch = ISLAND_PROP_IN_PROPS_RE.exec(propsStr);
	if (!islandMatch) return null;

	const islandIndex = islandMatch.index;
	const islandStart = islandIndex + islandMatch[0].length;
	const islandEnd = findIslandValueEnd(propsStr, islandStart);
	const islandValue = propsStr.slice(islandStart, islandEnd).trim();
	const otherProps = mergePropsWithoutIsland(propsStr, islandIndex, islandEnd);

	return { islandValue, otherProps };
}

function jsxCallPatternFor(componentName: string): RegExp {
	return new RegExp(String.raw`(_?jsxs?(?:DEV)?)\s*\(\s*${componentName}\s*,`, "g");
}

function buildAutoIslandRenderCall(
	componentName: string,
	srcPath: string,
	fwArg: string,
	propsStr: string,
): string {
	const hasOtherProps = propsStr.trim() !== "{}" && propsStr.trim() !== "";
	const propsArg = hasOtherProps ? `props: ${propsStr},` : "";
	return `(await __AvalonRenderIsland({ src: "${srcPath}", ${fwArg} component: ${componentName}, ${propsArg} ssr: true, ssrOnly: true }))`;
}

function buildIslandRenderCall(
	componentName: string,
	srcPath: string,
	fwArg: string,
	islandValue: string,
	otherProps: string,
): string {
	const hasOtherProps = otherProps.trim() !== "{}" && otherProps.trim() !== "";
	const propsArg = hasOtherProps ? `props: ${otherProps},` : "";
	const omitComponent = /\bclientOnly\s*:\s*true\b/.test(islandValue);
	const compArg = omitComponent ? "" : `component: ${componentName},`;
	return `(await __AvalonRenderIsland({ src: "${srcPath}", ${fwArg} ${compArg} ...(${islandValue}), ${propsArg} ssr: ${islandSsrExpression(islandValue)} }))`;
}

function renderCallForJsxMatch(
	fullCall: string,
	componentName: string,
	srcPath: string,
	framework: string | undefined,
	autoIsland: boolean,
): string | null {
	const propsStart = fullCall.indexOf("{");
	if (propsStart === -1) return null;

	const propsStr = fullCall.slice(propsStart, skipBracedExpression(fullCall, propsStart));
	const fwArg = framework ? `framework: "${framework}",` : "";

	if (autoIsland) {
		return buildAutoIslandRenderCall(componentName, srcPath, fwArg, propsStr);
	}

	if (!fullCall.includes("island")) return null;

	const extracted = extractIslandProp(propsStr);
	if (!extracted) return null;

	return buildIslandRenderCall(
		componentName,
		srcPath,
		fwArg,
		extracted.islandValue,
		extracted.otherProps,
	);
}

/**
 * Replace JSX calls for a component with renderIsland await expressions.
 * Transforms: _jsxDEV(Component, { island: {...}, prop: 1 }, ...)
 * Into: (await __AvalonRenderIsland({ src: "...", ...island, props: { prop: 1 } }))
 */
function replaceJsxCalls(
	code: string,
	componentName: string,
	srcPath: string,
	framework: string | undefined,
	autoIsland: boolean,
): string {
	const jsxCallPattern = jsxCallPatternFor(componentName);

	let result = "";
	let lastIndex = 0;

	for (let match = jsxCallPattern.exec(code); match !== null; match = jsxCallPattern.exec(code)) {
		const matchStart = match.index;
		const callEnd = findJsxCallEnd(code, matchStart);
		const fullCall = code.slice(matchStart, callEnd);
		const renderCall = renderCallForJsxMatch(
			fullCall,
			componentName,
			srcPath,
			framework,
			autoIsland,
		);

		if (renderCall) {
			result += code.slice(lastIndex, matchStart) + renderCall;
		} else {
			result += code.slice(lastIndex, callEnd);
		}
		lastIndex = callEnd;
	}

	result += code.slice(lastIndex);
	return result;
}

function ensureRenderIslandImport(code: string): string {
	const hasAvalonImport =
		code.includes('from "@useavalon/avalon"') || code.includes("from '@useavalon/avalon'");
	if (hasAvalonImport) return code;

	const firstImport = FIRST_IMPORT_LINE_RE.exec(code);
	if (!firstImport) return code;

	const pos = firstImport.index + firstImport[0].length;
	const line = 'import { renderIsland as __AvalonRenderIsland } from "@useavalon/avalon";\n';
	return code.slice(0, pos) + line + code.slice(pos);
}

function makeMdxExportsAsync(code: string): string {
	let transformed = code.replace(
		/function\s+_createMdxContent\s*\(/g,
		"async function _createMdxContent(",
	);
	transformed = transformed.replace(
		/export\s+default\s+function\s+MDXContent\s*\(/g,
		"export default async function MDXContent(",
	);
	return transformed;
}

function applyIslandImportTransforms(
	code: string,
	islandImports: IslandImport[],
	fileId: string,
	aliases: ViteAlias[],
	onQwikIslandProp: (island: IslandImport) => void,
): string {
	let transformed = code;
	for (const island of islandImports) {
		const srcPath = resolveIslandSrc(island.importPath, fileId, aliases);
		const fw = detectFramework(srcPath);

		if (fw === "qwik" && island.islandPropUsage) {
			onQwikIslandProp(island);
		}

		transformed = replaceJsxCalls(transformed, island.localName, srcPath, fw, island.autoIsland);
	}
	return transformed;
}

export function mdxIslandTransform(options: MDXIslandTransformOptions = {}): Plugin {
	const { islandPathPatterns = DEFAULT_ISLAND_PATTERNS, verbose = false } = options;

	let resolvedAliases: ViteAlias[] = [];

	return {
		name: "avalon:mdx-island-transform",
		enforce: "post",

		configResolved(config) {
			resolvedAliases = (config.resolve?.alias as ViteAlias[]) ?? [];
		},

		transform(code: string, id: string) {
			if (!id.endsWith(".mdx") && !id.includes(".mdx?")) {
				return null;
			}

			const islandImports = findIslandImports(code, islandPathPatterns);
			if (islandImports.length === 0) {
				return null;
			}

			if (verbose) {
				console.log(
					`[mdx-island-transform] Found ${islandImports.length} island import(s) in ${id}`,
				);
				for (const imp of islandImports) {
					console.log(
						`  - ${imp.localName} from ${imp.importPath}${imp.islandPropUsage ? " (island prop)" : " (islands dir)"}`,
					);
				}
			}

			let transformed = ensureRenderIslandImport(code);
			transformed = applyIslandImportTransforms(
				transformed,
				islandImports,
				id,
				resolvedAliases,
				(island) => {
					this.error(
						`<${island.localName}> is a Qwik component and cannot use the \`island\` prop. ` +
							`Qwik uses resumability — the Qwikloader activates it automatically. ` +
							`Remove the \`island\` prop from <${island.localName}>.`,
					);
				},
			);
			transformed = makeMdxExportsAsync(transformed);

			if (verbose) {
				console.log(`[mdx-island-transform] Transformed ${id}`);
			}

			return { code: transformed, map: null };
		},
	};
}
