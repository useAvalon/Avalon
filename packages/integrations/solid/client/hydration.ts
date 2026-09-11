/**
 * Solid client-side hydration
 *
 * Solid's hydrate() reads globalThis._$HY for the hydration context
 * (events, completed set, resource cache). The SSR output injects a
 * script that initialises _$HY before any island scripts run.
 *
 * In per-island mode each island is a separate ES module with its own
 * Solid runtime. Before calling hydrate() we ensure _$HY exists and
 * reset _$HY.done so Solid enters hydration mode rather than falling
 * back to client render.
 *
 * @module solid/client/hydration
 */

import { createComponent, hydrate as solidHydrate } from "solid-js/web";
import type { SolidComponent, SolidHydrationOptions } from "../types.ts";

/**
 * Initialise the Solid hydration context on globalThis if absent,
 * and reset the `done` flag so each island hydrates independently.
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
	(globalThis as any)._$HY.done = false;
}

/**
 * Hydrate a Solid component into an existing server-rendered container.
 *
 * @param container - The `<avalon-island>` element with SSR content
 * @param Component - Solid component function
 * @param props     - Component props (serialised from SSR)
 */
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

	ensureHydrationContext();
	solidHydrate(() => createComponent(Component, props), element, { renderId: renderId || "" });
}

export function getHydrationScript(): string {
	return "";
}
