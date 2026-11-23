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
import { addToManifest, generateComponentId } from "../server-islands/manifest.ts";
import { islandSsrExpression, isStaticallyClientOnly } from "./island-ssr-flag.ts";

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
	/** The component is used with a `server` prop (a server island). */
	serverPropUsage: boolean;
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
	// A property key follows `{` or `,`; a `:` after `?` belongs to a conditional expression.
	let before = pos - 1;
	while (before >= 0 && /\s/.test(propsStr[before])) before--;
	return before >= 0 && (propsStr[before] === "{" || propsStr[before] === ",");
}

/**
 * Index of `key` as a top-level property of a `{ ... }` object literal, or -1.
 * Nested objects (including compiled child JSX props) do not count.
 */
function findTopLevelKeyIndex(propsStr: string, key: string): number {
	let pos = 1;
	let depth = 1;
	while (pos < propsStr.length && depth > 0) {
		if (depth === 1 && isTopLevelPropertyKey(propsStr, pos, key)) {
			return pos;
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
	return -1;
}

function hasTopLevelKey(propsStr: string, key: string): boolean {
	return findTopLevelKeyIndex(propsStr, key) !== -1;
}

/** Raw MDX/JSX tags whose attributes include the given prop (`island` or `server`). */
function findRawJsxComponentsWithProp(code: string, prop: string): Set<string> {
	const propRe = new RegExp(String.raw`\b${prop}\s*[={]`);
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
		if (propRe.test(attrs)) {
			components.add(m[1]);
		}
	}
	return components;
}

/**
 * Find components used with the given prop (`island` or `server`) in the code.
 * Handles both raw JSX (<Component island={...}) and compiled JSX (_jsxDEV(Component, { island:)
 */
function findPropUsage(code: string, prop: string): Set<string> {
	const components = findRawJsxComponentsWithProp(code, prop);

	// Match each compiled jsx(Component, { ... }) and only count a top-level key.
	// A flat `[^}]*island` scan would also match a child's island inside `children:`.
	const compiledJsxRe = compiledJsxStartRe();
	for (let m = compiledJsxRe.exec(code); m !== null; m = compiledJsxRe.exec(code)) {
		let pos = m.index + m[0].length;
		while (pos < code.length && /\s/.test(code[pos])) pos++;
		if (code[pos] !== "{") continue;
		const propsEnd = skipBracedExpression(code, pos);
		if (hasTopLevelKey(code.slice(pos, propsEnd), prop)) {
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
	const islandPropComponents = findPropUsage(code, "island");
	const serverPropComponents = findPropUsage(code, "server");
	const jsxComponents = findCompiledJsxUsage(code);

	for (const [localName, importPath] of allImports) {
		const quotedPath = `"${importPath}"`;
		const isFromIslandsDir = patterns.some((p) => p.test(quotedPath));
		const hasIslandProp = islandPropComponents.has(localName);
		const hasServerProp = serverPropComponents.has(localName);
		const framework = detectFramework(importPath);
		const autoIsland =
			Boolean(framework && AUTO_ISLAND_FRAMEWORKS.has(framework)) &&
			jsxComponents.has(localName) &&
			!hasIslandProp;

		if (isFromIslandsDir || hasIslandProp || hasServerProp || autoIsland) {
			imports.push({
				localName,
				importPath,
				islandPropUsage: hasIslandProp,
				serverPropUsage: hasServerProp,
				autoIsland,
			});
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

function mergePropsWithoutProp(propsStr: string, propIndex: number, propEnd: number): string {
	const before = propsStr.slice(0, propIndex).trim();
	const after = propsStr.slice(propEnd).trim();
	let otherProps = before;
	if (after.startsWith(",")) {
		otherProps += after.slice(1);
	} else {
		otherProps += after;
	}
	return otherProps.replace(/,\s*}$/, "}").replace(/{\s*,/, "{");
}

/**
 * Extract a prop value from a JSX props object.
 * Given `{ island: { condition: 'on:interaction' }, other: 1 }` and `island`, returns
 * `{ condition: 'on:interaction' }` plus the remaining props.
 */
function extractProp(propsStr: string, key: string): { value: string; otherProps: string } | null {
	const index = findTopLevelKeyIndex(propsStr, key);
	if (index === -1) return null;
	const match = new RegExp(String.raw`^${key}\s*:\s*`).exec(propsStr.slice(index));
	if (!match) return null;

	const valueStart = index + match[0].length;
	const valueEnd = findIslandValueEnd(propsStr, valueStart);
	return {
		value: propsStr.slice(valueStart, valueEnd).trim(),
		otherProps: mergePropsWithoutProp(propsStr, index, valueEnd),
	};
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
	const omitComponent = isStaticallyClientOnly(islandValue);
	const compArg = omitComponent ? "" : `component: ${componentName},`;
	return `(await __AvalonRenderIsland({ src: "${srcPath}", ${fwArg} ${compArg} ...(${islandValue}), ${propsArg} ssr: ${islandSsrExpression(islandValue)} }))`;
}

function buildServerIslandRenderCall(
	componentName: string,
	srcPath: string,
	fwArg: string,
	serverValue: string,
	islandValue: string | null,
	otherProps: string,
): string {
	const hasOtherProps = otherProps.trim() !== "{}" && otherProps.trim() !== "";
	const propsArg = hasOtherProps ? `props: ${otherProps},` : "";
	const islandArg = islandValue ? `island: (${islandValue}),` : "";
	// Register at transform time, on the same path the runtime hashes, so the server bundle's
	// island manifest knows the component before the endpoint is generated.
	addToManifest(generateComponentId(srcPath), srcPath);
	return `(await __AvalonRenderIsland({ src: "${srcPath}", ${fwArg} component: ${componentName}, server: (${serverValue}), ${islandArg} ${propsArg} }))`;
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

	const server = fullCall.includes("server") ? extractProp(propsStr, "server") : null;
	if (server) {
		// A server island may also carry an `island` prop, which hydrates it once it has loaded.
		const island = extractProp(server.otherProps, "island");
		return buildServerIslandRenderCall(
			componentName,
			srcPath,
			fwArg,
			server.value,
			island?.value ?? null,
			island?.otherProps ?? server.otherProps,
		);
	}

	// Decided per call: an auto-island component without a `server` or `island` prop on this call.
	const extracted = fullCall.includes("island") ? extractProp(propsStr, "island") : null;
	if (!extracted) {
		return autoIsland ? buildAutoIslandRenderCall(componentName, srcPath, fwArg, propsStr) : null;
	}

	return buildIslandRenderCall(
		componentName,
		srcPath,
		fwArg,
		extracted.value,
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

/** An import declaration that binds `renderIsland` as `__AvalonRenderIsland`. */
const RENDER_ISLAND_IMPORT_RE =
	/^\s*import\s*\{[^}]*\brenderIsland\s+as\s+__AvalonRenderIsland\b[^}]*\}\s*from\s*["'][^"']+["']/m;

function ensureRenderIslandImport(code: string): string {
	if (RENDER_ISLAND_IMPORT_RE.test(code)) return code;

	const firstImport = FIRST_IMPORT_LINE_RE.exec(code);
	if (!firstImport) return code;

	const pos = firstImport.index + firstImport[0].length;
	// Subpath, not the package barrel: the barrel re-exports the Vite plugin,
	// which would pull build tooling into the server bundle.
	const line =
		'import { renderIsland as __AvalonRenderIsland } from "@useavalon/avalon/islands/island";\n';
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
