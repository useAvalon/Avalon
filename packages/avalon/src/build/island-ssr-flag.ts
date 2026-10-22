/**
 * Shared helpers for computing the `ssr` flag from an `island` prop object.
 * Used by the page and MDX transforms so the expression stays in one place.
 */

/**
 * Runtime expression evaluated against the island directive object.
 * An explicit `ssr` wins; otherwise page usage SSRs.
 */
export function islandSsrExpression(islandValue: string): string {
	return `((__i) => (__i.ssr !== undefined ? __i.ssr : true))(${islandValue})`;
}

/**
 * True when the island prop is an object literal whose effective top-level
 * `ssr` is the boolean `false`. Nested `ssr` keys and a later spread (which
 * can override) are not enough to strip the component binding.
 */
export function isStaticallyClientOnly(islandProp: string | null | undefined): boolean {
	if (!islandProp) return false;
	const trimmed = islandProp.trim();
	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return false;
	let ssrFalse = false;
	for (const prop of splitTopLevelProps(trimmed.slice(1, -1))) {
		if (prop.startsWith("...")) {
			// A later spread can set `ssr` at runtime — keep the binding.
			ssrFalse = false;
			continue;
		}
		const match = /^(?:["']ssr["']|ssr)\s*:/.exec(prop);
		if (!match) continue;
		ssrFalse = prop.slice(match[0].length).trim() === "false";
	}
	return ssrFalse;
}

/** Split an object literal body on top-level commas, respecting quotes and nests. */
function splitTopLevelProps(inner: string): string[] {
	const props: string[] = [];
	let depth = 0;
	let quote: "'" | '"' | "`" | null = null;
	let start = 0;
	for (let i = 0; i < inner.length; i++) {
		const c = inner[i];
		if (quote) {
			if (c === "\\" && i + 1 < inner.length) {
				i++;
				continue;
			}
			if (c === quote) quote = null;
			continue;
		}
		if (c === "'" || c === '"' || c === "`") {
			quote = c;
			continue;
		}
		if (c === "{" || c === "(" || c === "[") depth++;
		else if (c === "}" || c === ")" || c === "]") depth--;
		else if (c === "," && depth === 0) {
			const piece = inner.slice(start, i).trim();
			if (piece) props.push(piece);
			start = i + 1;
		}
	}
	const last = inner.slice(start).trim();
	if (last) props.push(last);
	return props;
}
