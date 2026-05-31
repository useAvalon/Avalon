/**
 * Svelte CSS Collection Utilities
 *
 * Utilities for collecting and processing CSS from Svelte components during SSR.
 * Svelte 5 automatically handles CSS extraction through the render() function,
 * but these utilities provide additional CSS processing capabilities.
 */

/**
 * CSS collection result
 */
export interface CssCollectionResult {
	/**
	 * Collected CSS code
	 */
	code: string;

	/**
	 * Source map (if available)
	 */
	map?: string;
}

/**
 * Extract CSS from Svelte SSR render result
 *
 * Svelte 5's render() function returns CSS in the result object.
 * This utility extracts and processes it.
 *
 * @param renderResult - The result from Svelte's render() function
 * @returns Processed CSS
 */
export function extractCss(renderResult: { css?: { code: string; map?: string } }) {
	if (!renderResult.css) {
		return null;
	}

	return {
		code: renderResult.css.code,
		map: renderResult.css.map,
	};
}

/**
 * Combine multiple CSS results into a single stylesheet
 *
 * @param cssResults - Array of CSS collection results
 * @returns Combined CSS code
 */
export function combineCss(cssResults: (CssCollectionResult | null)[]) {
	return cssResults
		.filter((result): result is CssCollectionResult => result !== null)
		.map((result) => result.code)
		.join("\n");
}

/**
 * Generate a scoped CSS identifier for a component
 *
 * @param src - Component source path
 * @returns Scoped CSS identifier
 */
export function generateScopeId(src: string) {
	// Create a simple hash from the source path
	const hash = src
		.replaceAll(/[^a-zA-Z0-9]/g, "")
		.toLowerCase()
		.slice(-8);

	return `svelte-${hash}`;
}

/**
 * Wrap CSS with a scope identifier
 *
 * @param css - CSS code to wrap
 * @param scopeId - Scope identifier
 * @returns Scoped CSS
 */
export function scopeCss(css: string, scopeId: string) {
	if (!css) return "";

	// Add scope attribute to all selectors
	return css.replaceAll(/([^{}]+)\{/g, (match, selector) => {
		// Skip @-rules
		if (selector.trim().startsWith("@")) {
			return match;
		}

		// Add scope attribute to selector
		return `${selector.trim()}[${scopeId}] {`;
	});
}

/**
 * Minify CSS by removing unnecessary whitespace and comments
 *
 * @param css - CSS code to minify
 * @returns Minified CSS
 */
export function minifyCss(css: string) {
	return (
		css
			// Remove comments
			.replaceAll(/\/\*[\s\S]*?\*\//g, "")
			// Remove unnecessary whitespace
			.replaceAll(/\s+/g, " ")
			// Remove whitespace around special characters
			.replaceAll(/\s*([{}:;,])\s*/g, "$1")
			.trim()
	);
}

/**
 * Process CSS for production
 *
 * Applies minification and other optimizations for production builds.
 *
 * @param css - CSS code to process
 * @param options - Processing options
 * @returns Processed CSS
 */
export function processCssForProduction(
	css: string,
	options: {
		minify?: boolean;
		scopeId?: string;
	} = {},
) {
	let processed = css;

	// Apply scoping if requested
	if (options.scopeId) {
		processed = scopeCss(processed, options.scopeId);
	}

	// Minify if requested
	if (options.minify) {
		processed = minifyCss(processed);
	}

	return processed;
}
