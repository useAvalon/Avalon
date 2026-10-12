import type { RenderEngine } from "../types";

/** React `style` must be an object; Preact accepts the HTML string form in JSX. */
function reactStyleProps(source: string): string {
	return source
		.replaceAll(/style="(--[a-zA-Z-]+):([^"]+)"/g, "style={{ '$1': '$2' }}")
		.replaceAll(
			/style=\{`(--[a-zA-Z-]+):\$\{([^}]+)\}([^`]*)`}/g,
			(_match, prop, expr, suffix) => `style={{ '${prop}': \`\${${expr}}${suffix}\` }}`,
		);
}

/**
 * Storefront sources are written as Preact JSX. Plain `.tsx` follows `core`,
 * so a React shell needs the React attribute and hook names in those files.
 */
export function jsxForCore(core: RenderEngine, source: string): string {
	if (core === "preact") {
		return source;
	}

	return reactStyleProps(
		source
			.replaceAll("from 'preact/hooks'", "from 'react'")
			.replaceAll(" class={", " className={")
			.replaceAll(' class="', ' className="')
			.replaceAll("tabindex=", "tabIndex=")
			.replaceAll(' for="', ' htmlFor="')
			.replaceAll("autocomplete=", "autoComplete="),
	);
}
