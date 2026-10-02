/**
 * Svelte Client-Side Hydration
 *
 * Handles hydration of server-rendered Svelte components in the browser.
 *
 *
 * Svelte 5 HMR Notes:
 * - HMR is controlled via compilerOptions.hmr in the Vite plugin config
 * - Local state is NOT preserved during HMR (by design in Svelte 5)
 * - CSS-only changes DO preserve state
 * - The hydrate() function reuses SSR HTML, mount() creates fresh DOM
 */

/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import type { Component } from "svelte";
import { hydrate as svelteHydrate, mount as svelteMount, unmount as svelteUnmount } from "svelte";

/**
 * Svelte 5 component type
 */
type SvelteComponent = Component<Record<string, unknown>, Record<string, unknown>, string>;

const instances = new WeakMap<HTMLElement, Record<string, unknown>>();

/**
 * Check if we're in development mode
 * Works in both Node.js/Bun and browser environments
 */
function isDev(): boolean {
	// Check Vite's __DEV__ global (set in vite.config.ts)
	if (typeof globalThis !== "undefined" && "__DEV__" in globalThis) {
		return !!(globalThis as Record<string, unknown>).__DEV__;
	}
	// Check browser/Node/Bun environment via globalThis
	try {
		const proc = (globalThis as Record<string, unknown>).process as
			| { env?: { NODE_ENV?: string } }
			| undefined;
		if (proc?.env?.NODE_ENV) {
			return proc.env.NODE_ENV !== "production";
		}
	} catch {
		// Ignore errors accessing process
	}
	return true; // Default to dev
}

/**
 * Hydrate a Svelte component
 *
 * Attaches client-side interactivity to server-rendered Svelte content.
 * Automatically decides between mount (empty container) and hydrate (SSR content).
 *
 * @param container - DOM element containing the server-rendered content
 * @param Component - Svelte component class
 * @param props - Component props
 * @returns The hydrated component instance
 */
function mountFresh(
	container: HTMLElement,
	Component: SvelteComponent,
	props: Record<string, unknown>,
): Record<string, unknown> {
	container.innerHTML = "";
	return svelteMount(Component, { target: container, props });
}

function storeInstance(container: HTMLElement, instance: Record<string, unknown>): void {
	instances.set(container, instance);
}

export function hydrate(
	container: HTMLElement,
	Component: SvelteComponent,
	props: Record<string, unknown>,
) {
	const hasSSRContent = detectSSRContent(container);

	try {
		if (hasSSRContent) {
			const componentDiv = container.querySelector("[data-svelte-component]");
			const targetElement = (componentDiv as HTMLElement | null) ?? container;
			const instance = svelteHydrate(Component, { target: targetElement, props });
			storeInstance(container, instance as Record<string, unknown>);
			return instance;
		}
		return mount(container, Component, props);
	} catch (error) {
		if (!hasSSRContent) {
			if (isDev()) console.error(`Svelte hydration failed:`, error);
			throw error;
		}
		try {
			const instance = mountFresh(container, Component, props);
			storeInstance(container, instance);
			return instance;
		} catch (mountError) {
			if (isDev()) console.error(`Svelte mount fallback failed:`, mountError);
			throw mountError;
		}
	}
}

/** Tear down a hydrated Svelte component before a client-navigation DOM swap. */
export function unmount(container: HTMLElement): void {
	const instance = instances.get(container);
	if (!instance) return;
	svelteUnmount(instance);
	instances.delete(container);
}

/**
 * Detect if an element has existing SSR content vs being an empty container
 *
 * @param element - DOM element to check
 * @returns True if element has SSR content
 */
function detectSSRContent(element: HTMLElement) {
	// Check if element has any meaningful content
	const hasTextContent = element.textContent && element.textContent.trim().length > 0;
	const hasChildElements = element.children && element.children.length > 0;
	const hasAttributes =
		element.dataset.ssrContent !== undefined || element.dataset.svelteRendered !== undefined;

	// Consider it SSR content if it has text, child elements, or explicit markers
	return hasTextContent || hasChildElements || hasAttributes;
}

/**
 * Mount a Svelte component (client-only, no hydration)
 *
 * Creates a new Svelte component instance without hydration.
 * Used for client-only rendering.
 *
 * @param container - DOM element to mount into
 * @param Component - Svelte component class
 * @param props - Component props
 * @returns The mounted component instance
 */
export function mount(
	container: HTMLElement,
	Component: SvelteComponent,
	props: Record<string, unknown>,
): Record<string, unknown> {
	const instance = svelteMount(Component, {
		target: container,
		props: props || {},
	}) as Record<string, unknown>;
	storeInstance(container, instance);
	return instance;
}
