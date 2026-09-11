/**
 * Vue client-side hydration
 *
 * Uses createSSRApp (not createApp) so Vue enters hydration mode.
 * createApp's mount() override clears the container innerHTML and
 * passes isHydrate=false to the internal mount, which discards the
 * server-rendered DOM. createSSRApp preserves the SSR output and
 * attaches reactivity and event listeners to the existing nodes.
 *
 * @module vue/client/hydration
 */

import { type Component, createSSRApp } from "vue";

/**
 * Hydrate a Vue component into an existing server-rendered container.
 *
 * @param container - The `<avalon-island>` element with SSR content
 * @param component - Vue component (SFC options object or setup function)
 * @param props     - Component props (serialised from SSR)
 */
export function hydrate(
	container: Element,
	component: unknown,
	props: Record<string, unknown> = {},
): void {
	try {
		const app = createSSRApp(component as Component, props);
		app.mount(container);
	} catch (error) {
		console.error("Vue hydration failed:", error);
		throw error;
	}
}

export function getHydrationScript(): string {
	return "";
}
