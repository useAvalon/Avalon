/**
 * Qwik client-side resumability handler
 *
 * Unlike other frameworks, Qwik doesn't hydrate — it resumes.
 * The Qwikloader (~1KB) handles event delegation and lazy-loads
 * component code on demand when events fire.
 *
 * This module provides the Avalon integration layer for Qwik's
 * resumability model within the island architecture.
 */

import type { QwikComponent, QwikResumabilityOptions } from "../types.ts";

const QWIK_CONTAINER = String.raw`[q\:container]`;

/**
 * True when this island is, or contains, a Qwik container.
 * Ancestors are ignored so a page-level container does not mark other islands.
 * Any value counts (`paused` from SSR, `resumed` after Qwik resumes) — both
 * mean the subtree is already Qwik's and must not be client-rendered again.
 */
function hasQwikResumeBoundary(element: HTMLElement): boolean {
	return element.matches(QWIK_CONTAINER) || element.querySelector(QWIK_CONTAINER) !== null;
}

/**
 * Resume a server-rendered Qwik component on the client
 *
 * For Qwik, "hydration" is actually resumption — the framework
 * picks up where the server left off using serialized state in the DOM.
 * The Qwikloader script handles this automatically.
 *
 * This function is provided for API consistency with other integrations
 * but delegates to Qwik's native resumability mechanism.
 *
 * @param container - DOM element containing the server-rendered HTML
 * @param Component - Qwik component (used for client-only rendering)
 * @param props - Component props
 * @param _options - Resumability options
 */
export function hydrate(
	container: Element,
	Component: QwikComponent,
	props: Record<string, unknown> = {},
	_options: QwikResumabilityOptions = {},
): void {
	try {
		if (!container) {
			throw new Error("Container element is required for resumption");
		}

		const element = container as HTMLElement;
		const hasSSRContent = element.children.length > 0;

		if (hasSSRContent && hasQwikResumeBoundary(element)) {
			// Qwik container already exists with serialized state.
			// The Qwikloader handles resumption automatically — mark as done
			// so the interaction observer doesn't fire on every subsequent event.
			element.dataset.hydrated = "true";
			return;
		}

		mount(element, Component, props);
	} catch (error) {
		const element = container as HTMLElement;
		element.dataset.hydrationStatus = "failed";
		element.dataset.hydrationError = error instanceof Error ? error.message : String(error);
		console.error("Qwik resumption setup failed:", error);
	}
}

/** Client-render a Qwik component into an empty container. */
export function mount(
	container: Element,
	Component: QwikComponent,
	props: Record<string, unknown> = {},
): void {
	const element = container as HTMLElement;
	import("@builder.io/qwik")
		.then((qwik) => {
			const qwikModule = qwik as any;

			try {
				if (typeof qwikModule.render !== "function") {
					element.dataset.hydrationStatus = "failed";
					element.dataset.hydrationError = "Qwik render API not available";
					return;
				}
				const jsxNode =
					typeof qwikModule.jsx === "function"
						? qwikModule.jsx(Component, props)
						: Component(props);
				qwikModule.render(element, jsxNode);
			} catch (error) {
				element.dataset.hydrationStatus = "failed";
				element.dataset.hydrationError = error instanceof Error ? error.message : String(error);
				console.error("Qwik client render failed:", error);
			}
		})
		.catch((importError) => {
			element.dataset.hydrationStatus = "failed";
			element.dataset.hydrationError = "Failed to load @builder.io/qwik module";
			console.error("Failed to import @builder.io/qwik:", importError);
		});
}

/** Qwik resumability has no client tree to tear down. */
export function unmount(_container: HTMLElement): void {
	return;
}
