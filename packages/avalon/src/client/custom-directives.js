/**
 * Client-side custom hydration directives.
 *
 * Server-registered directives are assigned on `globalThis.__AVALON_DIRECTIVES__`
 * by an inline module (parsed as script, not eval). App code can also register
 * handlers at runtime with `registerClientDirective`.
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
	ingestGlobalDirectives();
	return directives.has(name);
}

function ingestGlobalDirectives() {
	const bag = globalThis.__AVALON_DIRECTIVES__;
	if (!bag || typeof bag !== "object") return;
	for (const name of Object.keys(bag)) {
		const fn = bag[name];
		if (typeof fn === "function") directives.set(name, fn);
	}
}

/**
 * @param {HTMLElement} island
 * @param {string} directiveName
 * @param {() => void} hydrateFn
 * @returns {boolean}
 */
export function executeCustomDirective(island, directiveName, hydrateFn) {
	ingestGlobalDirectives();
	const registered = directives.get(directiveName);
	if (!registered) return false;
	registered(island, hydrateFn, island.dataset.conditionArg);
	return true;
}
