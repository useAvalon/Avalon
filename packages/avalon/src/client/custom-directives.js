/**
 * Client-side custom hydration directive executor.
 *
 * Discovers islands with custom directives (via `data-custom-directive`)
 * and runs the serialized directive script to determine when hydration fires.
 *
 * @module client/custom-directives
 */

/**
 * Registry of directive functions reconstructed on the client.
 * @type {Map<string, Function>}
 */
const clientDirectives = new Map();

/**
 * Register a client-side directive function at runtime.
 * Called by inline scripts emitted during SSR, or manually by users.
 *
 * @param {string} name - Directive name (e.g. "on:delay")
 * @param {Function} fn - The directive function (el, hydrate, arg) => void
 */
export function registerClientDirective(name, fn) {
	clientDirectives.set(name, fn);
}

/**
 * Check if a directive is registered on the client.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function hasClientDirective(name) {
	return clientDirectives.has(name);
}

/**
 * Execute a custom directive for an island element.
 *
 * If the directive was serialized as a `data-directive-script` attribute,
 * it will be reconstructed and cached on first use.
 *
 * @param {HTMLElement} island - The avalon-island element
 * @param {string} directiveName - The directive name
 * @param {() => void} hydrateFn - Callback to trigger hydration
 * @returns {boolean} true if a custom directive was found and executed
 */
export function executeCustomDirective(island, directiveName, hydrateFn) {
	const arg = island.dataset.conditionArg || undefined;

	// 1. Check the runtime registry first
	if (clientDirectives.has(directiveName)) {
		const fn = clientDirectives.get(directiveName);
		try {
			fn(island, hydrateFn, arg);
		} catch (error) {
			console.error(`[avalon] Custom directive "${directiveName}" threw:`, error);
			// Fallback: hydrate immediately on error
			hydrateFn();
		}
		return true;
	}

	// 2. Check for an inline serialized script on the element
	const inlineScript = island.dataset.directiveScript;
	if (inlineScript) {
		try {
			// Reconstruct the function from the serialized string
			// The script is expected to be a function expression or arrow function
			// eslint-disable-next-line no-new-func
			const fn = new Function("return (" + inlineScript + ")")();
			// Cache it for reuse by other islands with the same directive
			clientDirectives.set(directiveName, fn);
			fn(island, hydrateFn, arg);
		} catch (error) {
			console.error(`[avalon] Failed to execute inline directive "${directiveName}":`, error);
			hydrateFn();
		}
		return true;
	}

	return false;
}

/**
 * Expose the registration function globally so SSR-injected scripts can call it.
 */
if (typeof globalThis !== "undefined") {
	globalThis.__avalon_registerDirective = registerClientDirective;
}
