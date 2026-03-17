import { FALLBACK_PROPS, type PropExtractionResult } from "./vue.ts";

/** Mapping from Lit type constructors to TypeScript type strings */
const LIT_TYPE_MAP: Record<string, string> = {
	String: "string",
	Number: "number",
	Boolean: "boolean",
	Array: "unknown[]",
	Object: "Record<string, unknown>",
};

/**
 * Extract props from a Lit element source string.
 *
 * Parses `static properties = { ... }` blocks and maps Lit type
 * constructors to TypeScript types. Properties with `state: true`
 * are excluded (internal state, not public props).
 *
 * Never throws — returns fallback on any failure.
 */
export function extractLitProps(source: string): PropExtractionResult {
	try {
		const block = extractStaticPropertiesBlock(source);
		if (block === null) {
			return { propsType: FALLBACK_PROPS, fallback: true };
		}

		const props = parsePropertyEntries(block);
		if (props.length === 0) {
			return { propsType: FALLBACK_PROPS, fallback: true };
		}

		const fields = props.map((p) => p.name + "?: " + p.tsType).join("; ");
		const propsType = "{ " + fields + " }";
		return { propsType, fallback: false };
	} catch {
		console.warn(
			"[avalon] Failed to extract Lit props — falling back to Record<string, unknown>",
		);
		return { propsType: FALLBACK_PROPS, fallback: true };
	}
}

/**
 * Extract the content inside `static properties = { ... }`.
 * Uses brace-counting to handle nested objects.
 * Returns the inner content (without outer braces), or null if not found.
 */
function extractStaticPropertiesBlock(source: string): string | null {
	const marker = /static\s+properties\s*=\s*\{/;
	const match = marker.exec(source);
	if (!match) {
		return null;
	}

	// Position of the opening brace
	const openBrace = match.index + match[0].length - 1;
	let depth = 1;
	let i = openBrace + 1;

	while (i < source.length && depth > 0) {
		if (source[i] === "{") depth++;
		else if (source[i] === "}") depth--;
		i++;
	}

	if (depth !== 0) {
		return null;
	}

	// Return content between the outer braces
	return source.slice(openBrace + 1, i - 1);
}

interface ParsedProp {
	name: string;
	tsType: string;
}

/**
 * Parse individual property entries from the static properties block content.
 * Each entry looks like: `propName: { type: Constructor, ... }`
 * Filters out entries with `state: true`.
 */
function parsePropertyEntries(block: string): ParsedProp[] {
	const props: ParsedProp[] = [];

	// Match each property entry: name: { ... }
	// We use a regex to find property names followed by `{`, then brace-count
	const entryRegex = /(\w+)\s*:\s*\{/g;
	let entryMatch: RegExpExecArray | null;

	while ((entryMatch = entryRegex.exec(block)) !== null) {
		const name = entryMatch[1];
		const openIdx = entryMatch.index + entryMatch[0].length - 1;

		// Extract the balanced { ... } for this entry
		const entryBody = extractBalancedBraces(block, openIdx);
		if (entryBody === null) continue;

		// Skip state properties
		if (/\bstate\s*:\s*true\b/.test(entryBody)) continue;

		// Extract the type constructor
		const typeMatch = new RegExp(/\btype\s*:\s*(\w+)/).exec(entryBody);
		const litType = typeMatch ? typeMatch[1] : null;
		const tsType = litType && litType in LIT_TYPE_MAP
			? LIT_TYPE_MAP[litType]
			: "unknown";

		props.push({ name, tsType });

		// Advance regex past this entry to avoid re-matching nested braces
		entryRegex.lastIndex = openIdx + (entryBody.length);
	}

	return props;
}

/**
 * Extract a balanced `{ ... }` block starting at the given index.
 * Returns the content between the braces (excluding outer braces), or null.
 */
function extractBalancedBraces(source: string, startIdx: number): string | null {
	if (source[startIdx] !== "{") return null;

	let depth = 0;
	let i = startIdx;

	while (i < source.length) {
		if (source[i] === "{") depth++;
		else if (source[i] === "}") depth--;
		if (depth === 0) {
			return source.slice(startIdx + 1, i);
		}
		i++;
	}

	return null;
}
