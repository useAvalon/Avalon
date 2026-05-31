/**
 * Client-side hydration helper for server islands.
 * Supports all hydration strategies and all frameworks via the integration loader.
 * Uses the same loadIntegrationModule that the main island hydration system uses.
 */
import { loadIntegrationModule } from "virtual:avalon/integration-loader";

/**
 * Resolve the default export from a component module.
 */
function resolveComponent(mod: Record<string, unknown>): unknown {
	if (mod.default) return mod.default;
	for (const value of Object.values(mod)) {
		if (typeof value === "function") return value;
	}
	return mod;
}

/** Idle hydration timeout in milliseconds (shared by requestIdleCallback and the setTimeout fallback) */
const IDLE_TIMEOUT_MS = 5000;

/**
 * Hydrate a server island element with a component, respecting the hydration strategy.
 * Uses the framework integration system — same as normal island hydration.
 *
 * @param elementId  - DOM id of the <avalon-server-island> wrapper
 * @param componentPath - Module path to import the component from
 * @param props      - Component props
 * @param condition  - Hydration strategy (on:client, on:visible, on:interaction, on:idle)
 * @param framework  - Framework identifier (preact, react, solid, vue, svelte)
 * @param renderId   - Optional framework hydration key (Solid uses this to match data-hk markers)
 */
export async function hydrateServerIsland(
	elementId: string,
	componentPath: string,
	props: Record<string, unknown>,
	condition: string = "on:client",
	framework: string = "preact",
	renderId?: string,
): Promise<void> {
	const el = document.getElementById(elementId);
	if (!el || el.dataset.hydrated) return;

	// Solid's hydrate() reads the renderId from the element's dataset to match
	// the data-hk markers produced during SSR. Set it before hydrating.
	if (renderId) {
		el.dataset.solidRenderId = renderId;
	}

	const doHydrate = async () => {
		if (el.dataset.hydrated) return;

		const componentModule = await import(/* @vite-ignore */ componentPath);
		const Component = resolveComponent(componentModule);
		const integrationModule = (await loadIntegrationModule(framework)) as {
			hydrate?: (
				el: Element,
				Component: unknown,
				props: Record<string, unknown>,
			) => void | Promise<void>;
		};

		if (!integrationModule.hydrate || typeof integrationModule.hydrate !== "function") {
			throw new Error(`Integration ${framework} does not export a hydrate function`);
		}

		await integrationModule.hydrate(el, Component, props);
		el.dataset.hydrated = "true";
	};

	if (condition === "on:client") {
		await doHydrate();
	} else if (condition === "on:visible") {
		const target = el.firstElementChild || el;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) {
					doHydrate();
					observer.disconnect();
				}
			},
			{ rootMargin: "50px", threshold: 0 },
		);
		observer.observe(target);
	} else if (condition === "on:interaction") {
		const handler = () => {
			doHydrate();
			el.removeEventListener("mouseenter", handler);
			el.removeEventListener("focusin", handler);
			el.removeEventListener("click", handler);
		};
		el.addEventListener("mouseenter", handler);
		el.addEventListener("focusin", handler);
		el.addEventListener("click", handler);
	} else if (condition === "on:idle") {
		if ("requestIdleCallback" in globalThis) {
			requestIdleCallback(() => doHydrate(), { timeout: IDLE_TIMEOUT_MS });
		} else {
			setTimeout(() => doHydrate(), IDLE_TIMEOUT_MS);
		}
	} else {
		await doHydrate();
	}
}
