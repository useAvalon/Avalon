import type { ComponentType } from "preact";
import { h, hydrate as preactHydrate, render as preactRender } from "preact";
import type { PreactHydrationOptions } from "../types.ts";

/**
 * Hydrate a Preact component on the client
 * Attaches interactivity to server-rendered HTML
 */
export function hydrate(
	container: HTMLElement,
	Component: ComponentType<Record<string, unknown>>,
	props: Record<string, unknown>,
	_options?: PreactHydrationOptions,
): void {
	try {
		const vnode = h(Component, props);
		preactHydrate(vnode, container);
	} catch (error) {
		console.error("Preact hydration failed:", error);
		throw error;
	}
}

/** Mount a Preact component into an empty container (no SSR HTML to hydrate). */
export function mount(
	container: HTMLElement,
	Component: ComponentType<Record<string, unknown>>,
	props: Record<string, unknown>,
	_options?: PreactHydrationOptions,
): void {
	try {
		preactRender(h(Component, props), container);
	} catch (error) {
		console.error("Preact mount failed:", error);
		throw error;
	}
}

/** Tear down a hydrated Preact tree before a client-navigation DOM swap. */
export function unmount(container: HTMLElement): void {
	preactRender(null, container);
}

/**
 * Check if a container is ready for hydration
 */
export function isHydrationReady(container: HTMLElement) {
	return container.hasChildNodes();
}

/**
 * Clean up hydration artifacts
 */
export function cleanupHydration(container: HTMLElement) {
	// Remove hydration-specific attributes
	delete container.dataset.framework;
	delete container.dataset.src;
	delete container.dataset.props;
	delete container.dataset.condition;
}
