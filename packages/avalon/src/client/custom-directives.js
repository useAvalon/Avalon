/**
 * Client-side custom hydration directives.
 *
 * Server-registered directives are serialized onto the island as
 * `data-directive-script`. App code can also register handlers at runtime
 * with `registerClientDirective`.
 */

/** @type {Map<string, (el: HTMLElement, hydrate: () => void, arg?: string) => void>} */
const directives = new Map();

/**
 * @param {string} name
 * @param {(el: HTMLElement, hydrate: () => void, arg?: string) => void} fn
 */
export function registerClientDirective(name, fn) {
	directives.set(name, fn);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function hasClientDirective(name) {
	return directives.has(name);
}

/**
 * @param {HTMLElement} island
 * @param {string} directiveName
 * @param {() => void} hydrateFn
 * @returns {boolean}
 */
export function executeCustomDirective(island, directiveName, hydrateFn) {
	const registered = directives.get(directiveName);
	const arg = island.dataset.conditionArg;
	if (registered) {
		registered(island, hydrateFn, arg);
		return true;
	}

	const serialized = island.dataset.directiveScript;
	if (!serialized) return false;

	try {
		const dir = new Function(`return (${serialized})`)();
		if (typeof dir !== "function") return false;
		dir(island, hydrateFn, arg);
		return true;
	} catch (error) {
		console.warn(`[avalon] Failed to execute custom directive "${directiveName}":`, error);
		return false;
	}
}
