/**
 * Solid client-side hydration
 *
 * Solid's hydrate() requires globalThis._$HY to exist (set up by
 * generateHydrationScript in the <head>). In islands architecture,
 * the script may not have executed yet when the island hydrates.
 *
 * We ensure _$HY exists before calling hydrate(). No render()
 * fallback — SSR hydration is reliable and render() pulls in
 * extra DOM runtime code (~1-2 KiB).
 */

import type { SolidComponent, SolidHydrationOptions } from "../types.ts";

/**
 * Ensure the Solid hydration context exists on globalThis.
 * This mirrors what generateHydrationScript() sets up.
 */
function ensureHydrationContext(): void {
	if (!(globalThis as any)._$HY) {
		(globalThis as any)._$HY = {
			events: [],
			completed: new WeakSet(),
			r: {},
			fe() {},
		};
	}
}

export async function hydrate(
	container: Element,
	Component: SolidComponent,
	props: Record<string, unknown> = {},
	_options: SolidHydrationOptions = {},
): Promise<void> {
	if (!container) {
		throw new Error("Container element is required for hydration");
	}

	if (!Component || typeof Component !== "function") {
		throw new Error(`Invalid Solid component: expected function, got ${typeof Component}`);
	}

	const element = container as HTMLElement;
	const renderId = element.dataset.solidRenderId || element.dataset.renderId;

	const solidWeb = await import("solid-js/web");
	const { hydrate: solidHydrate, createComponent } = solidWeb;

	// Ensure _$HY exists before calling solidHydrate
	ensureHydrationContext();

	solidHydrate(() => createComponent(Component, props), element, { renderId: renderId || "" });
}

export function getHydrationScript(): string {
	return "";
}
