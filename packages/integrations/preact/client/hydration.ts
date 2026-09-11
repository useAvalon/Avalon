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
 * Get the hydration script for Preact islands
 * This script is injected into the page to enable client-side hydration
 */
export function getHydrationScript(): string {
	const script = [
		"import { hydrate } from '@useavalon/preact/client';",
		"",
		"document.querySelectorAll('[data-framework=\"preact\"]').forEach(async (el) => {",
		"  const src = el.getAttribute('data-src');",
		"  const propsStr = el.getAttribute('data-props');",
		"  const props = propsStr ? JSON.parse(propsStr) : {};",
		"  ",
		"  try {",
		"    const module = await import(src);",
		"    const Component = module.default || module;",
		"    hydrate(el, Component, props);",
		"  } catch (error) {",
		"    console.error('Failed to hydrate Preact island:', error);",
		"  }",
		"});",
	].join("\n");

	return script;
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
