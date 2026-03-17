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

import type { Plugin } from 'vite';
import { dirname } from 'node:path';

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
}

/**
 * Find all default imports in the code
 */
function findAllDefaultImports(code: string): Map<string, string> {
	const imports = new Map<string, string>();
	const re = /import\s+([A-Z]\w*)\s+from\s+(['"][^'"]+['"])/g;
	let m;
	while ((m = re.exec(code)) !== null) {
		const localName = m[1];
		const importPath = m[2].slice(1, -1);
		imports.set(localName, importPath);
	}
	return imports;
}

/**
 * Find components used with the island prop in the code
 * Handles both raw JSX (<Component island={...}) and compiled JSX (_jsxDEV(Component, { island:)
 */
function findIslandPropUsage(code: string): Set<string> {
	const components = new Set<string>();
	
	// Match raw JSX: <ComponentName ... island={...} or <ComponentName ... island ...
	const rawJsxRe = /<([A-Z]\w*)\s+[^>]*\bisland\s*[={]/g;
	let m;
	while ((m = rawJsxRe.exec(code)) !== null) {
		components.add(m[1]);
	}
	
	// Match compiled JSX: _jsxDEV(ComponentName, { island: or jsxDEV(ComponentName, { island:
	// Also handles jsx() and jsxs() variants
	const compiledJsxRe = /(?:_?jsxs?(?:DEV)?)\s*\(\s*([A-Z]\w*)\s*,\s*\{[^}]*\bisland\s*:/g;
	while ((m = compiledJsxRe.exec(code)) !== null) {
		components.add(m[1]);
	}
	
	return components;
}

function findIslandImports(code: string, patterns: RegExp[]): IslandImport[] {
	const imports: IslandImport[] = [];
	const allImports = findAllDefaultImports(code);
	const islandPropComponents = findIslandPropUsage(code);
	
	for (const [localName, importPath] of allImports) {
		const quotedPath = `"${importPath}"`;
		const isFromIslandsDir = patterns.some(p => p.test(quotedPath));
		const hasIslandProp = islandPropComponents.has(localName);
		
		if (isFromIslandsDir || hasIslandProp) {
			imports.push({ localName, importPath, islandPropUsage: hasIslandProp });
		}
	}
	
	return imports;
}

/**
 * Resolve an import path to an absolute src path for renderIsland
 */
function resolveIslandSrc(importPath: string, fileId: string): string {
	// Already absolute
	if (importPath.startsWith('/src/')) return importPath;
	if (importPath.startsWith('/app/')) return importPath;
	if (importPath.startsWith('/')) return importPath;
	
	// Handle aliases - convert to absolute paths
	if (importPath.startsWith('@/')) {
		return '/app/' + importPath.slice(2);
	}
	if (importPath.startsWith('@shared/')) {
		return '/app/shared/' + importPath.slice(8);
	}
	if (importPath.startsWith('@modules/')) {
		return '/app/modules/' + importPath.slice(9);
	}
	if (importPath.startsWith('$components/')) {
		return '/src/components/' + importPath.slice(12);
	}
	if (importPath.startsWith('$islands/')) {
		return '/src/islands/' + importPath.slice(9);
	}
	if (importPath.startsWith('~/')) {
		return '/src/' + importPath.slice(2);
	}
	
	// Relative import - resolve relative to the file
	if (importPath.startsWith('.')) {
		const normalized = fileId.replaceAll('\\', '/');
		
		// Try to find /app/ or /src/ in the path
		let baseIndex = normalized.indexOf('/app/');
		if (baseIndex === -1) baseIndex = normalized.indexOf('/src/');
		
		if (baseIndex !== -1) {
			const fileDir = dirname(normalized.slice(baseIndex));
			// Simple path resolution
			const parts = fileDir.split('/');
			const importParts = importPath.split('/');
			
			for (const part of importParts) {
				if (part === '..') {
					parts.pop();
				} else if (part !== '.') {
					parts.push(part);
				}
			}
			
			return parts.join('/');
		}
	}
	
	// Fallback for islands directory pattern
	if (importPath.includes('/islands/')) {
		const parts = importPath.split('/');
		return '/src/islands/' + parts.at(-1);
	}
	
	// Fallback: return as-is with /src/ prefix
	return '/src/' + importPath.split('/').pop();
}

function detectFramework(src: string): string | undefined {
	if (src.endsWith('.vue')) return 'vue';
	if (src.endsWith('.svelte')) return 'svelte';
	if (src.includes('.solid.')) return 'solid';
	if (src.includes('.lit.')) return 'lit';
	if (src.includes('.qwik.')) return 'qwik';
	if (src.endsWith('.tsx') || src.endsWith('.jsx')) return 'preact';
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
		if (ch === '{') {
			depth++;
			pos++;
		} else if (ch === '}') {
			depth--;
			if (depth > 0) pos++;
		} else if (ch === "'" || ch === '"' || ch === '`') {
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
		if (code[pos] === '\\') pos++; // skip escaped char
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
	
	// Find the opening parenthesis
	while (pos < code.length && code[pos] !== '(') pos++;
	if (pos >= code.length) return startIdx;
	
	// Now track parentheses depth
	while (pos < code.length) {
		const ch = code[pos];
		if (ch === '(') {
			depth++;
			pos++;
		} else if (ch === ')') {
			depth--;
			pos++;
			if (depth === 0) return pos;
		} else if (ch === '{') {
			pos = skipBracedExpression(code, pos);
		} else if (ch === "'" || ch === '"' || ch === '`') {
			pos = skipStringLiteral(code, pos);
		} else {
			pos++;
		}
	}
	return pos;
}

/**
 * Extract the island prop value from a JSX props object.
 * Given `{ island: { condition: 'on:interaction' }, other: 1 }`, returns `{ condition: 'on:interaction' }`
 */
function extractIslandProp(propsStr: string): { islandValue: string; otherProps: string } | null {
	// Find `island:` or `island :` in the props
	const islandMatch = propsStr.match(/\bisland\s*:\s*/);
	if (!islandMatch) return null;
	
	const islandStart = islandMatch.index! + islandMatch[0].length;
	
	// The island value could be:
	// 1. An object literal: { condition: 'on:interaction' }
	// 2. A variable reference: islandOpts
	// 3. A more complex expression
	
	let islandEnd: number;
	if (propsStr[islandStart] === '{') {
		// Object literal - find matching closing brace
		islandEnd = skipBracedExpression(propsStr, islandStart);
	} else {
		// Find the next comma or closing brace
		let pos = islandStart;
		let depth = 0;
		while (pos < propsStr.length) {
			const ch = propsStr[pos];
			if (ch === '{' || ch === '[' || ch === '(') {
				depth++;
				pos++;
			} else if (ch === '}' || ch === ']' || ch === ')') {
				if (depth === 0) break;
				depth--;
				pos++;
			} else if (ch === ',' && depth === 0) {
				break;
			} else {
				pos++;
			}
		}
		islandEnd = pos;
	}
	
	const islandValue = propsStr.slice(islandStart, islandEnd).trim();
	
	// Build other props by removing the island prop
	const beforeIsland = propsStr.slice(0, islandMatch.index!).trim();
	const afterIsland = propsStr.slice(islandEnd).trim();
	
	// Clean up: remove trailing/leading commas
	let otherProps = beforeIsland;
	if (afterIsland.startsWith(',')) {
		otherProps += afterIsland.slice(1);
	} else {
		otherProps += afterIsland;
	}
	
	// Remove trailing comma before closing brace
	otherProps = otherProps.replace(/,\s*}$/, '}').replace(/{\s*,/, '{');
	
	return { islandValue, otherProps };
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
): string {
	// Match patterns like: _jsxDEV(ComponentName, or jsxDEV(ComponentName, or jsx(ComponentName,
	const jsxCallPattern = new RegExp(
		'(_?jsxs?(?:DEV)?)\\s*\\(\\s*' + componentName + '\\s*,',
		'g'
	);
	
	let result = '';
	let lastIndex = 0;
	let match;
	
	while ((match = jsxCallPattern.exec(code)) !== null) {
		const matchStart = match.index;
		const jsxFn = match[1];
		
		// Find the end of this JSX call
		const callEnd = findJsxCallEnd(code, matchStart);
		const fullCall = code.slice(matchStart, callEnd);
		
		// Check if this call has an island prop
		if (!fullCall.includes('island')) {
			// No island prop, keep as-is
			result += code.slice(lastIndex, callEnd);
			lastIndex = callEnd;
			continue;
		}
		
		// Extract the props object - it's the second argument
		// Pattern: jsxFn(Component, { props }, key, isStatic, source, self)
		const propsStart = fullCall.indexOf('{');
		if (propsStart === -1) {
			result += code.slice(lastIndex, callEnd);
			lastIndex = callEnd;
			continue;
		}
		
		const propsEnd = skipBracedExpression(fullCall, propsStart);
		const propsStr = fullCall.slice(propsStart, propsEnd);
		
		const extracted = extractIslandProp(propsStr);
		if (!extracted) {
			result += code.slice(lastIndex, callEnd);
			lastIndex = callEnd;
			continue;
		}
		
		const { islandValue, otherProps } = extracted;
		const fwArg = framework ? `framework: "${framework}",` : '';
		
		// Check if otherProps is empty (just `{}`)
		const hasOtherProps = otherProps.trim() !== '{}' && otherProps.trim() !== '';
		const propsArg = hasOtherProps ? `props: ${otherProps},` : '';
		
		// Build the renderIsland call
		// We spread the island value to get condition, ssr, etc.
		const renderCall = `(await __AvalonRenderIsland({ src: "${srcPath}", ${fwArg} ...(${islandValue}), ${propsArg} ssr: (${islandValue}).ssr !== undefined ? (${islandValue}).ssr : true }))`;
		
		result += code.slice(lastIndex, matchStart) + renderCall;
		lastIndex = callEnd;
	}
	
	result += code.slice(lastIndex);
	return result;
}

export function mdxIslandTransform(options: MDXIslandTransformOptions = {}): Plugin {
	const { islandPathPatterns = DEFAULT_ISLAND_PATTERNS, verbose = false } = options;

	return {
		name: 'avalon:mdx-island-transform',
		enforce: 'post',

		transform(code: string, id: string) {
			if (!id.endsWith('.mdx') && !id.includes('.mdx?')) {
				return null;
			}

			const islandImports = findIslandImports(code, islandPathPatterns);
			if (islandImports.length === 0) {
				return null;
			}

			if (verbose) {
				console.log('[mdx-island-transform] Found ' + islandImports.length + ' island import(s) in ' + id);
				for (const imp of islandImports) {
					console.log('  - ' + imp.localName + ' from ' + imp.importPath + (imp.islandPropUsage ? ' (island prop)' : ' (islands dir)'));
				}
			}

			let transformed = code;

			// Add the renderIsland import for async SSR
			const hasAvalonImport =
				transformed.includes('from "@useavalon/avalon"') || transformed.includes("from '@useavalon/avalon'");

			if (!hasAvalonImport) {
				const firstImport = /^(import\s.+?from\s+.+?\n)/m.exec(transformed);
				if (firstImport) {
					const pos = transformed.indexOf(firstImport[0]) + firstImport[0].length;
					const line = 'import { renderIsland as __AvalonRenderIsland } from "@useavalon/avalon";\n';
					transformed = transformed.slice(0, pos) + line + transformed.slice(pos);
				}
			}

			// Replace JSX calls with renderIsland await expressions
			for (const island of islandImports) {
				const srcPath = resolveIslandSrc(island.importPath, id);
				const fw = detectFramework(srcPath);
				
				transformed = replaceJsxCalls(transformed, island.localName, srcPath, fw);
			}

			// Comment out the original imports (keep for CSS graph but don't use the binding)
			for (const island of islandImports) {
				const importRe = new RegExp(
					`import\\s+${island.localName}\\s+from\\s+(['"][^'"]+['"])`,
					'g'
				);
				transformed = transformed.replace(
					importRe,
					`import $1; // [mdx-island-transform] kept for CSS: ${island.localName}`
				);
			}

			// Make the MDX content function async so we can use await
			// Transform: function _createMdxContent(props) {
			// Into: async function _createMdxContent(props) {
			transformed = transformed.replace(
				/function\s+_createMdxContent\s*\(/g,
				'async function _createMdxContent('
			);

			// Also make the default export async if it wraps _createMdxContent
			// Transform: export default function MDXContent(props = {}) {
			// Into: export default async function MDXContent(props = {}) {
			transformed = transformed.replace(
				/export\s+default\s+function\s+MDXContent\s*\(/g,
				'export default async function MDXContent('
			);

			if (verbose) {
				console.log('[mdx-island-transform] Transformed ' + id);
			}

			return { code: transformed, map: null };
		},
	};
}
