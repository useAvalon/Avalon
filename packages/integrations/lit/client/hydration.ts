/**
 * Lit Client-Side Hydration
 *
 * Uses official @lit-labs/ssr-client hydration support.
 */

/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import type { LitElement } from "lit";
import type { LitHydrationOptions } from "../types.ts";

// Import hydration support - MUST be first
import "./lit-hydrate-support.ts";

/**
 * Hydrate a server-rendered Lit component
 */
export function hydrate(
	container: HTMLElement,
	ElementClass: typeof LitElement,
	props: Record<string, unknown>,
	options?: LitHydrationOptions,
): void {
	if (Object.hasOwn(container.dataset, "litHydrated")) return;

	const tagName =
		container.dataset.tagName ||
		(ElementClass as any).elementName ||
		ElementClass.name.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

	if (!tagName) {
		throw new Error("Could not determine tag name for Lit component");
	}

	if (options?.defer) {
		const trigger = () => performHydration(container, ElementClass, tagName, props);
		if (typeof requestIdleCallback === "undefined") {
			setTimeout(trigger, 0);
		} else {
			requestIdleCallback(trigger);
		}
		return;
	}

	performHydration(container, ElementClass, tagName, props);
	container.dataset.litHydrated = "true";
}

/** Mount a Lit element into an empty container (no SSR custom element to hydrate). */
export function mount(
	container: HTMLElement,
	ElementClass: typeof LitElement,
	props: Record<string, unknown>,
): void {
	const tagName =
		container.dataset.tagName ||
		(ElementClass as any).elementName ||
		ElementClass.name.replaceAll(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

	if (!tagName) {
		throw new Error("Could not determine tag name for Lit component");
	}

	if (!customElements.get(tagName)) {
		customElements.define(tagName, ElementClass as any);
	}

	const newElement = document.createElement(tagName);
	for (const [key, value] of Object.entries(props)) {
		(newElement as any)[key] = value;
	}
	container.appendChild(newElement);
	container.dataset.litHydrated = "true";
}

/** Lit has no framework tree to dispose; clear the hydration marker so a later scan can re-run. */
export function unmount(container: HTMLElement): void {
	delete container.dataset.litHydrated;
}

function performHydration(
	container: HTMLElement,
	ElementClass: typeof LitElement,
	tagName: string,
	props: Record<string, unknown>,
): void {
	const element = container.querySelector(tagName);

	if (!element) {
		mount(container, ElementClass, props);
		return;
	}

	// Register custom element if needed
	if (!customElements.get(tagName)) {
		customElements.define(tagName, ElementClass as any);
	}

	// Remove defer-hydration to trigger Lit's hydration
	if (element.hasAttribute("defer-hydration")) {
		element.removeAttribute("defer-hydration");
	}
}
