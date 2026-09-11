/**
 * Shared helpers for computing the `ssr` flag from an `island` prop object.
 * Used by the page and MDX transforms so the expression stays in one place.
 */

/**
 * Runtime expression evaluated against the island directive object.
 * `clientOnly: true` wins, then an explicit `ssr`, otherwise page usage SSRs.
 */
export function islandSsrExpression(islandValue: string): string {
	return `((__i) => __i.clientOnly === true ? false : (__i.ssr !== undefined ? __i.ssr : true))(${islandValue})`;
}

/**
 * True when the island prop is an object literal that statically opts out of SSR.
 * Runtime-computed values (`island={opts}`) cannot be proven client-only.
 */
export function isStaticallyClientOnly(islandProp: string | null | undefined): boolean {
	if (!islandProp) return false;
	const trimmed = islandProp.trim();
	if (!trimmed.startsWith("{")) return false;
	return /\bclientOnly\s*:\s*true\b/.test(trimmed) || /\bssr\s*:\s*false\b/.test(trimmed);
}
