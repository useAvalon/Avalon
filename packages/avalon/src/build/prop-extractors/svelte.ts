import { FALLBACK_PROPS, type PropExtractionResult } from "./vue.ts";

/**
 * Extract props from a Svelte component source string.
 *
 * Supports three patterns:
 *   1. `let { ... }: { ... } = $props()` — inline type literal
 *   2. `let { ... }: TypeName = $props()` or `let name: TypeName = $props()`
 *      — named type resolved from an interface/type declaration in the script block
 *   3. `export let name: type` — Svelte 4 style, collected into a type literal
 *
 * Never throws — returns fallback on any failure.
 */
export function extractSvelteProps(source: string): PropExtractionResult {
	try {
		const scriptContent = extractScriptContent(source);
		if (scriptContent === null) {
			return { propsType: FALLBACK_PROPS, fallback: true };
		}

		// Try $props() patterns first (Svelte 5)
		const propsResult = extractFromDollarProps(scriptContent);
		if (propsResult !== null) {
			return { propsType: propsResult, fallback: false };
		}

		// Try export let pattern (Svelte 4)
		const exportLetResult = extractFromExportLet(scriptContent);
		if (exportLetResult !== null) {
			return { propsType: exportLetResult, fallback: false };
		}

		return { propsType: FALLBACK_PROPS, fallback: true };
	} catch {
		console.warn(
			"[avalon] Failed to extract Svelte props — falling back to Record<string, unknown>",
		);
		return { propsType: FALLBACK_PROPS, fallback: true };
	}
}

/**
 * Extract the content of the `<script>` or `<script lang="ts">` block.
 * Returns `null` if no script block is found.
 */
function extractScriptContent(source: string): string | null {
	const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/i;
	const match = new RegExp(scriptRegex).exec(source);
	return match ? match[1] : null;
}

/**
 * Extract props type from `$props()` call patterns.
 *
 * Handles:
 *   - `let { ... }: { ... } = $props()` (inline type literal)
 *   - `let { ... }: TypeName = $props()` (named type, destructuring)
 *   - `let name: TypeName = $props()` (named type, non-destructuring)
 */
function extractFromDollarProps(scriptContent: string): string | null {
	// Match: let <binding> : <type> = $props()
	// The binding can be `{ ... }` (destructuring) or a simple identifier
	const propsCallRegex =
		/let\s+(?:\{[^}]*\}|\w+)\s*:\s*([\s\S]*?)\s*=\s*\$props\s*\(\s*\)/;
	const match = new RegExp(propsCallRegex).exec(scriptContent);
	if (!match) {
		return null;
	}

	const typeAnnotation = match[1].trim();
	if (typeAnnotation.length === 0) {
		return null;
	}

	// If it starts with `{`, it's an inline type literal — return as-is
	if (typeAnnotation.startsWith("{")) {
		// Validate balanced braces
		if (!areBracesBalanced(typeAnnotation)) {
			console.warn(
				"[avalon] Unbalanced braces in Svelte $props() type — falling back",
			);
			return null;
		}
		return typeAnnotation;
	}

	// Otherwise it's a named type — resolve from interface/type in the script
	return resolveNamedType(scriptContent, typeAnnotation);
}

/**
 * Resolve a named type (interface or type alias) from the script content.
 * Returns the body as a type literal string, or null if not found.
 */
function resolveNamedType(
	scriptContent: string,
	typeName: string,
): string | null {
	// Try interface first: `interface TypeName { ... }`
	const interfaceRegex = new RegExp(
		String.raw`interface\s+${escapeRegex(typeName)}\s*\{`,
	);
	const interfaceMatch = interfaceRegex.exec(scriptContent);
	if (interfaceMatch) {
		const startIdx = interfaceMatch.index + interfaceMatch[0].length - 1; // position of `{`
		const body = extractBalancedBraces(scriptContent, startIdx);
		if (body !== null) {
			return body;
		}
	}

	// Try type alias: `type TypeName = { ... }`
	const typeAliasRegex = new RegExp(
		String.raw`type\s+${escapeRegex(typeName)}\s*=\s*\{`,
	);
	const typeAliasMatch = typeAliasRegex.exec(scriptContent);
	if (typeAliasMatch) {
		const startIdx =
			typeAliasMatch.index + typeAliasMatch[0].length - 1; // position of `{`
		const body = extractBalancedBraces(scriptContent, startIdx);
		if (body !== null) {
			return body;
		}
	}

	return null;
}

/**
 * Extract a balanced `{ ... }` block starting at the given index.
 * Returns the full string including the outer braces, or null if unbalanced.
 */
function extractBalancedBraces(source: string, startIdx: number): string | null {
	if (source[startIdx] !== "{") {
		return null;
	}

	let depth = 0;
	let i = startIdx;

	while (i < source.length) {
		if (source[i] === "{") {
			depth++;
		} else if (source[i] === "}") {
			depth--;
			if (depth === 0) {
				return source.slice(startIdx, i + 1).trim();
			}
		}
		i++;
	}

	return null; // unbalanced
}

/**
 * Extract props from `export let` declarations (Svelte 4 pattern).
 * Collects all `export let name: type` and builds a type literal.
 */
function extractFromExportLet(scriptContent: string): string | null {
	const exportLetRegex = /export\s+let\s+(\w+)\s*:\s*([^;=]+)/g;
	const props: string[] = [];
	let match: RegExpExecArray | null;

	while ((match = exportLetRegex.exec(scriptContent)) !== null) {
		const name = match[1].trim();
		const type = match[2].trim();
		if (name && type) {
			props.push(`${name}: ${type}`);
		}
	}

	if (props.length === 0) {
		return null;
	}

	return `{ ${props.join("; ")} }`;
}

/** Check if braces are balanced in a string */
function areBracesBalanced(str: string): boolean {
	let depth = 0;
	for (const ch of str) {
		if (ch === "{") depth++;
		else if (ch === "}") depth--;
		if (depth < 0) return false;
	}
	return depth === 0;
}

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
	return str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
