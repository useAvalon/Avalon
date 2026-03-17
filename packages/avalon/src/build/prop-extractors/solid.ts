import { FALLBACK_PROPS, type PropExtractionResult } from "./vue.ts";

/**
 * Extract props from a Solid component source string.
 *
 * Supports two patterns:
 *   1. `export default function Name(props: { ... })` — named function export
 *   2. `export default (props: { ... }) =>` — arrow function export
 *
 * Uses brace-counting to handle nested types in the props parameter.
 * Never throws — returns fallback on any failure.
 */
export function extractSolidProps(source: string): PropExtractionResult {
	try {
		// Try named function pattern first
		const namedResult = extractFromNamedFunction(source);
		if (namedResult !== null) {
			return { propsType: namedResult, fallback: false };
		}

		// Try arrow function pattern
		const arrowResult = extractFromArrowFunction(source);
		if (arrowResult !== null) {
			return { propsType: arrowResult, fallback: false };
		}

		return { propsType: FALLBACK_PROPS, fallback: true };
	} catch {
		console.warn(
			"[avalon] Failed to extract Solid props — falling back to Record<string, unknown>",
		);
		return { propsType: FALLBACK_PROPS, fallback: true };
	}
}

/**
 * Extract props type from `export default function Name(props: { ... })`.
 * Returns the type literal string, or null if not found.
 */
function extractFromNamedFunction(source: string): string | null {
	// Match: export default function <Name>(props:
	const regex = /export\s+default\s+function\s+\w+\s*\(\s*props\s*:\s*/;
	const match = regex.exec(source);
	if (!match) {
		return null;
	}

	const typeStart = match.index + match[0].length;
	return extractPropsType(source, typeStart);
}

/**
 * Extract props type from `export default (props: { ... }) =>`.
 * Returns the type literal string, or null if not found.
 */
function extractFromArrowFunction(source: string): string | null {
	// Match: export default (props:
	const regex = /export\s+default\s+\(\s*props\s*:\s*/;
	const match = regex.exec(source);
	if (!match) {
		return null;
	}

	const typeStart = match.index + match[0].length;
	return extractPropsType(source, typeStart);
}

/**
 * Extract a props type starting at the given index in the source.
 * Handles both inline type literals `{ ... }` using brace-counting
 * and simple type references like `Props`.
 * Returns the trimmed type string, or null if extraction fails.
 */
function extractPropsType(source: string, startIdx: number): string | null {
	// Skip leading whitespace
	let i = startIdx;
	while (i < source.length && /\s/.test(source[i])) {
		i++;
	}

	if (i >= source.length) {
		return null;
	}

	// If it starts with `{`, use brace-counting for inline type literal
	if (source[i] === "{") {
		return extractBalancedBraces(source, i);
	}

	// Otherwise it's a type reference — read until `)` or `,`
	const remaining = source.slice(i);
	const refMatch = new RegExp(/^([A-Za-z_$][\w$]*(?:<[^>]*>)?)/).exec(remaining);
	if (refMatch) {
		return refMatch[1].trim();
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
