/**
 * Type declarations for Vite virtual modules
 *
 * These modules are resolved by Vite at runtime in the browser.
 * They don't exist as actual files but are provided by Vite's plugin system.
 */

declare module '/@useavalon/preact/client' {
	export function hydrate(container: Element, component: unknown, props?: Record<string, unknown>): void;
	export function getHydrationScript(): string;
}

declare module '/@useavalon/react/client' {
	export function hydrate(container: Element, component: unknown, props?: Record<string, unknown>): void;
	export function getHydrationScript(): string;
}

declare module '/@useavalon/vue/client' {
	export function hydrate(container: Element, component: unknown, props?: Record<string, unknown>): void;
	export function getHydrationScript(): string;
}

declare module '/@useavalon/svelte/client' {
	export function hydrate(container: Element, component: unknown, props?: Record<string, unknown>): void;
	export function getHydrationScript(): string;
}

declare module '/@useavalon/solid/client' {
	export function hydrate(container: Element, component: unknown, props?: Record<string, unknown>): void;
	export function getHydrationScript(): string;
}

declare module '/@useavalon/lit/client' {
	export function hydrate(container: Element, component: unknown, props?: Record<string, unknown>): void;
	export function getHydrationScript(): string;
}

declare module '/@useavalon/qwik/client' {
	export function hydrate(container: Element, component: unknown, props?: Record<string, unknown>): void;
	export function getHydrationScript(): string;
}

// HMR adapter virtual modules
declare module '/@useavalon/react/client/hmr' {
	export { reactAdapter } from '@useavalon/react/client/hmr';
}

declare module '/@useavalon/preact/client/hmr' {
	export { preactAdapter } from '@useavalon/preact/client/hmr';
}

declare module '/@useavalon/vue/client/hmr' {
	export { vueAdapter } from '@useavalon/vue/client/hmr';
}

declare module '/@useavalon/svelte/client/hmr' {
	export { svelteAdapter } from '@useavalon/svelte/client/hmr';
}

declare module '/@useavalon/solid/client/hmr' {
	export { solidAdapter } from '@useavalon/solid/client/hmr';
}

declare module '/@useavalon/lit/client/hmr' {
	export { litAdapter } from '@useavalon/lit/client/hmr';
}

declare module '/@useavalon/qwik/client/hmr' {
	export { qwikAdapter } from '@useavalon/qwik/client/hmr';
}
