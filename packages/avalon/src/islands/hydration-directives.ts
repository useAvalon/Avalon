/**
 * Custom Hydration Directives
 *
 * Allows users to define custom hydration strategies for islands.
 * A directive controls _when_ an island hydrates on the client.
 *
 * Built-in directives (on:client, on:visible, on:interaction, on:idle, media:*)
 * are handled natively in main.js. This module enables user-defined directives
 * that extend the system with arbitrary trigger logic.
 *
 * @example
 * @example
 * ```ts
 * // Register a directive that hydrates after a delay
 * registerHydrationDirective('on:delay', {
 *   name: 'on:delay',
 *   // Runs on the client — receives the island element and a hydrate callback
 *   script: (el, hydrate, arg) => {
 *     const ms = parseInt(arg || '1000', 10);
 *     setTimeout(hydrate, ms);
 *   },
 * });
 *
 * // Use in a page via the island prop
 * <Counter island={{ condition: 'on:delay', conditionArg: '2000' }} />
 * ```
 * @module islands/hydration-directives
 */

/**
 * A client-side hydration directive function.
 *
 * Called once per island element when the page initializes.
 * The function must call `hydrate()` exactly once when the island
 * should become interactive.
 *
 * @param el - The `<avalon-island>` DOM element
 * @param hydrate - Callback that triggers hydration. Call it once.
 * @param arg - Optional argument string from `conditionArg` prop
 */
export type HydrationDirectiveFn = (
	el: HTMLElement,
	hydrate: () => void,
	arg?: string,
) => void | (() => void);

/**
 * Definition of a custom hydration directive.
 */
export interface HydrationDirectiveDefinition {
	/** Directive name — must match the `condition` prop value (e.g. "on:delay") */
	name: string;

	/**
	 * Client-side script that controls when hydration fires.
	 *
	 * Can be either:
	 * - A function (will be serialized to the client)
	 * - A string of JavaScript (inlined directly)
	 */
	script: HydrationDirectiveFn | string;
}

// ---------------------------------------------------------------------------
// Server-side registry
// ---------------------------------------------------------------------------

// One Map on globalThis so `server/renderer.ts` (`@useavalon/avalon`) and the
// Nitro renderer bundle share registrations. Separate module copies would
// otherwise drop app directives from the client bootstrap.
const REGISTRY_KEY = "__AVALON_HYDRATION_DIRECTIVE_REGISTRY__";

type RegistryGlobal = typeof globalThis & {
	[REGISTRY_KEY]?: Map<string, HydrationDirectiveDefinition>;
};

function directiveRegistry(): Map<string, HydrationDirectiveDefinition> {
	const g = globalThis as RegistryGlobal;
	g[REGISTRY_KEY] ??= new Map();
	return g[REGISTRY_KEY];
}

/**
 * Register a custom hydration directive.
 *
 * @param name - Directive name (e.g. "on:delay", "on:event")
 * @param definition - The directive definition
 */
export function registerHydrationDirective(
	name: string,
	definition: HydrationDirectiveDefinition,
): void {
	// Vite evaluates the SSR renderer once per environment (and again on HMR).
	// Re-registering the same name is expected — keep the first definition.
	if (directiveRegistry().has(name)) return;
	directiveRegistry().set(name, definition);
}

/**
 * Unregister a custom hydration directive.
 */
export function unregisterHydrationDirective(name: string): boolean {
	return directiveRegistry().delete(name);
}

/**
 * Check whether a condition string maps to a registered custom directive.
 */
export function isCustomDirective(condition: string): boolean {
	return directiveRegistry().has(condition);
}

/**
 * Get a registered directive definition by name.
 */
export function getDirective(name: string): HydrationDirectiveDefinition | undefined {
	return directiveRegistry().get(name);
}

/**
 * Get all registered custom directive names.
 */
export function getRegisteredDirectives(): string[] {
	return [...directiveRegistry().keys()];
}

/**
 * Serialize a directive's script to an inline-safe string.
 * Used by the SSR renderer to embed the directive logic in the HTML
 * so the client can execute it without an extra network request.
 */
export function serializeDirectiveScript(name: string): string | null {
	const directive = directiveRegistry().get(name);
	if (!directive) return null;

	if (typeof directive.script === "string") {
		return directive.script;
	}

	// Serialize the function body so it can be reconstructed on the client
	return directive.script.toString();
}

/**
 * Turn a serialized `script` into a function expression so it is valid as an
 * object-literal value. String bodies and method-shorthand `toString()` output
 * are not safe to wrap in bare parentheses.
 */
function asFunctionExpression(source: string): string {
	const trimmed = source.trim();
	if (
		trimmed.startsWith("function") ||
		trimmed.startsWith("async function") ||
		trimmed.startsWith("(") ||
		trimmed.includes("=>")
	) {
		return `(${trimmed})`;
	}
	const method = trimmed.match(/^(async\s+)?[\w$]+\s*\([^)]*\)\s*\{/);
	if (method) {
		const asyncKw = method[1] ? "async " : "";
		return `(${asyncKw}function${trimmed.slice(trimmed.indexOf("("))})`;
	}
	return `(function(el,hydrate,arg){${trimmed}})`;
}

/** Keep `</script` / `<!--` from breaking out of the bootstrap module. */
function escapeInlineModule(source: string): string {
	return source
		.replaceAll(/<\/script/gi, String.raw`<\/script`)
		.replaceAll("<!--", String.raw`<\!--`);
}

function escapeHtmlAttr(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function nonceAttribute(nonce: string | undefined): string {
	if (!nonce) return "";
	return ` nonce="${escapeHtmlAttr(nonce)}"`;
}

/** JavaScript body assigned on `globalThis.__AVALON_DIRECTIVES__` (no `<script>` wrapper). */
export function customDirectiveBootstrapModule(): string | null {
	const parts: string[] = [];
	for (const name of getRegisteredDirectives()) {
		const src = serializeDirectiveScript(name);
		if (!src) continue;
		parts.push(
			`${escapeInlineModule(JSON.stringify(name))}:${escapeInlineModule(asFunctionExpression(src))}`,
		);
	}
	if (parts.length === 0) return null;
	return `globalThis.__AVALON_DIRECTIVES__=Object.assign(globalThis.__AVALON_DIRECTIVES__||{},{${parts.join(",")}});`;
}

export type DirectiveBootstrapOptions = {
	/**
	 * CSP `script-src` nonce for the bootstrap tag. Required when the policy
	 * blocks inline scripts and does not use `'unsafe-inline'` / a script hash.
	 */
	nonce?: string;
	/**
	 * Same-origin URL of a JS module that evaluates {@link customDirectiveBootstrapModule}.
	 * Emits `<script type="module" src>` instead of an inline module.
	 */
	src?: string;
};

/**
 * Script tag that assigns registered directive functions on `globalThis`.
 * The body is parsed as a module, not `eval` / `new Function`. An inline
 * tag still needs CSP `script-src` `'unsafe-inline'`, a matching nonce, or a
 * script hash — `'self'` alone does not execute inline modules. Use `src` or
 * `registerClientDirective` in the client entry for `'self'`-only policies.
 */
export function customDirectiveBootstrapScript(options?: DirectiveBootstrapOptions): string | null {
	const js = customDirectiveBootstrapModule();
	if (!js) return null;
	const nonce = nonceAttribute(options?.nonce);
	if (options?.src) {
		return `<script type="module" src="${escapeHtmlAttr(options.src)}"${nonce}></script>`;
	}
	return `<script type="module"${nonce}>${js}</script>`;
}

/**
 * Clear all registered directives. Useful for testing.
 * @internal
 */
export function clearDirectives(): void {
	directiveRegistry().clear();
}
