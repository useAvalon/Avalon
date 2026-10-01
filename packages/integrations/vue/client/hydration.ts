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

import { type App, type Component, createApp, createSSRApp } from "vue";

const apps = new WeakMap<Element, App>();

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
		apps.set(container, app);
	} catch (error) {
		console.error("Vue hydration failed:", error);
		throw error;
	}
}

/** Mount a Vue component into an empty container (no SSR HTML to hydrate). */
export function mount(
	container: Element,
	component: unknown,
	props: Record<string, unknown> = {},
): void {
	try {
		const app = createApp(component as Component, props);
		app.mount(container);
		apps.set(container, app);
	} catch (error) {
		console.error("Vue mount failed:", error);
		throw error;
	}
}

/** Tear down a mounted Vue app before a client-navigation DOM swap. */
export function unmount(container: Element): void {
	const app = apps.get(container);
	if (!app) return;
	app.unmount();
	apps.delete(container);
}
