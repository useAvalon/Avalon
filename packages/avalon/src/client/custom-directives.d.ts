/**
 * Type declarations for the client-side custom directives module.
 */

/**
 * Register a client-side directive function at runtime.
 */
export declare function registerClientDirective(
	name: string,
	fn: (el: HTMLElement, hydrate: () => void, arg?: string) => void,
): void;

/**
 * Check if a directive is registered on the client.
 */
export declare function hasClientDirective(name: string): boolean;

/**
 * Execute a custom directive for an island element.
 */
export declare function executeCustomDirective(
	island: HTMLElement,
	directiveName: string,
	hydrateFn: () => void,
): boolean;
