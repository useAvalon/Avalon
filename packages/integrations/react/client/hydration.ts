// Client-side hydration logic for React components
/// <reference lib="dom" />

import type { ComponentType } from "react";
import { createElement } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import type { ReactHydrationOptions } from "../types.ts";

const roots = new WeakMap<HTMLElement, Root>();

/**
 * Hydrate a React component on the client
 * Attaches interactivity to server-rendered HTML using React 18's hydrateRoot
 *
 * @param container - DOM element to hydrate into
 * @param Component - React component to hydrate
 * @param props - Component props
 * @param options - Hydration options including error recovery
 */
export function hydrate(
	container: HTMLElement,
	Component: ComponentType<Record<string, unknown>>,
	props: Record<string, unknown>,
	options?: ReactHydrationOptions,
): void {
	try {
		const element = createElement(Component, props);

		const root = hydrateRoot(container, element, {
			onRecoverableError:
				options?.onRecoverableError ||
				((error: unknown) => {
					console.error("React hydration recoverable error:", error);
				}),
		});
		roots.set(container, root);
	} catch (error) {
		console.error("React hydration failed:", error);
		throw error;
	}
}

/** Mount a React component into an empty container (no SSR HTML to hydrate). */
export function mount(
	container: HTMLElement,
	Component: ComponentType<Record<string, unknown>>,
	props: Record<string, unknown>,
): void {
	try {
		const element = createElement(Component, props);
		const root = createRoot(container);
		root.render(element);
		roots.set(container, root);
	} catch (error) {
		console.error("React mount failed:", error);
		throw error;
	}
}

/** Tear down a hydrated React root before a client-navigation DOM swap. */
export function unmount(container: HTMLElement): void {
	const root = roots.get(container);
	if (!root) return;
	root.unmount();
	roots.delete(container);
}

/**
 * Check if a container is ready for hydration
 *
 * @param container - DOM element to check
 * @returns True if container has content to hydrate
 */
export function isHydrationReady(container: HTMLElement): boolean {
	return container.hasChildNodes();
}

/**
 * Clean up hydration artifacts after hydration is complete
 *
 * @param container - DOM element to clean up
 */
export function cleanupHydration(container: HTMLElement): void {
	// Remove hydration-specific attributes
	delete container.dataset.framework;
	delete container.dataset.src;
	delete container.dataset.props;
	delete container.dataset.condition;
}
