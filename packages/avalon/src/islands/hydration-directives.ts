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

const directiveRegistry = new Map<string, HydrationDirectiveDefinition>();

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
	if (directiveRegistry.has(name)) return;
	directiveRegistry.set(name, definition);
}

/**
 * Unregister a custom hydration directive.
 */
export function unregisterHydrationDirective(name: string): boolean {
	return directiveRegistry.delete(name);
}

/**
 * Check whether a condition string maps to a registered custom directive.
 */
export function isCustomDirective(condition: string): boolean {
	return directiveRegistry.has(condition);
}

/**
 * Get a registered directive definition by name.
 */
export function getDirective(name: string): HydrationDirectiveDefinition | undefined {
	return directiveRegistry.get(name);
}

/**
 * Get all registered custom directive names.
 */
export function getRegisteredDirectives(): string[] {
	return [...directiveRegistry.keys()];
}

/**
 * Serialize a directive's script to an inline-safe string.
 * Used by the SSR renderer to embed the directive logic in the HTML
 * so the client can execute it without an extra network request.
 */
export function serializeDirectiveScript(name: string): string | null {
	const directive = directiveRegistry.get(name);
	if (!directive) return null;

	if (typeof directive.script === "string") {
		return directive.script;
	}

	// Serialize the function body so it can be reconstructed on the client
	return directive.script.toString();
}

/**
 * Clear all registered directives. Useful for testing.
 * @internal
 */
export function clearDirectives(): void {
	directiveRegistry.clear();
}
