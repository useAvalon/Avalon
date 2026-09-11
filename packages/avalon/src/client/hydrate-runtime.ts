/**
 * Re-entrant island hydrator.
 *
 * First load and client navigations both call {@link scanAndHydrate}.
 * {@link disposeIslands} tears down every island in a root before a DOM swap.
 */

import { executeCustomDirective, hasClientDirective } from "./custom-directives.js";

export type HydrateFn = (
	el: HTMLElement,
	Component: unknown,
	props: Record<string, unknown>,
) => void | Promise<void>;

export type UnmountFn = (el: HTMLElement) => void | Promise<void>;

export interface IntegrationModule {
	hydrate?: HydrateFn;
	unmount?: UnmountFn;
	preLitHydration?: () => Promise<void>;
}

export interface HydrationLoader {
	loadIntegrationModule: (framework: string) => Promise<IntegrationModule>;
	preLitHydration?: () => Promise<void>;
}

type Cleanup = () => void;

const islandCleanups = new WeakMap<HTMLElement, Cleanup[]>();

let loaderOverride: HydrationLoader | null = null;

/** Test seam — production uses `virtual:avalon/integration-loader`. */
export function setHydrationLoader(loader: HydrationLoader | null): void {
	loaderOverride = loader;
}

async function getLoader(): Promise<HydrationLoader> {
	if (loaderOverride) return loaderOverride;
	return import("virtual:avalon/integration-loader");
}

function addCleanup(island: HTMLElement, cleanup: Cleanup): void {
	const list = islandCleanups.get(island) ?? [];
	list.push(cleanup);
	islandCleanups.set(island, list);
}

function runCleanups(island: HTMLElement): void {
	const list = islandCleanups.get(island);
	if (!list) return;
	for (const cleanup of list) {
		try {
			cleanup();
		} catch (error) {
			console.warn("[avalon] Island cleanup failed:", error);
		}
	}
	islandCleanups.delete(island);
}

function resolveComponent(componentModule: Record<string, unknown>, src: string): unknown {
	let Component: unknown = componentModule.default;

	if (!Component) {
		const exports = Object.keys(componentModule).filter((key) => key !== "default");
		for (const exportName of exports) {
			const exportValue = componentModule[exportName];
			if (typeof exportValue === "function") {
				Component = exportValue;
				break;
			}
		}
		if (!Component) Component = componentModule;
	}

	if (!Component) {
		throw new Error(`Component ${src} has no default export`);
	}

	return Component;
}

async function hydrateIsland(island: HTMLElement, framework: string): Promise<void> {
	if (island.dataset.hydrated) return;

	const src = island.dataset.src;
	if (!src) {
		console.warn("Island missing data-src attribute");
		return;
	}

	try {
		const props = island.dataset.props ? JSON.parse(island.dataset.props) : {};
		const loader = await getLoader();
		if (framework === "lit") {
			await (loader.preLitHydration?.() ??
				loader.loadIntegrationModule("lit").then((m) => m.preLitHydration?.()));
		}

		const componentModule = (await import(/* @vite-ignore */ src)) as Record<string, unknown>;
		const Component = resolveComponent(componentModule, src);
		const integrationModule = await loader.loadIntegrationModule(framework);

		if (!integrationModule.hydrate || typeof integrationModule.hydrate !== "function") {
			throw new Error(`Integration ${framework} does not export a hydrate function`);
		}

		await integrationModule.hydrate(island, Component, props);
		island.dataset.hydrated = "true";
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Hydration error for ${framework} island ${src}:`, error);
		island.dataset.hydrationStatus = "failed";
		island.dataset.renderStrategy = "ssr-only";
		island.dispatchEvent(
			new CustomEvent("hydration-error", {
				detail: { framework, src, error: message, timestamp: Date.now() },
				bubbles: true,
			}),
		);
	}
}

function setupIntersectionObserver(island: HTMLElement, framework: string): void {
	try {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					hydrateIsland(island, framework);
					observer.disconnect();
				}
			},
			{ rootMargin: "50px", threshold: 0 },
		);
		observer.observe(island.firstElementChild || island);
		addCleanup(island, () => observer.disconnect());
	} catch (error) {
		console.error("Failed to setup intersection observer:", error);
		hydrateIsland(island, framework);
	}
}

function setupInteractionObserver(island: HTMLElement, framework: string): void {
	const events = ["click", "touchstart", "mouseenter", "focusin"] as const;
	let hydrated = false;
	const target = island.firstElementChild || island;

	const handleInteraction = () => {
		if (hydrated) return;
		hydrated = true;
		for (const eventType of events) {
			target.removeEventListener(eventType, handleInteraction);
		}
		hydrateIsland(island, framework);
	};

	try {
		for (const eventType of events) {
			target.addEventListener(eventType, handleInteraction, { once: true, passive: true });
		}
		addCleanup(island, () => {
			hydrated = true;
			for (const eventType of events) {
				target.removeEventListener(eventType, handleInteraction);
			}
		});
	} catch (error) {
		console.error("Failed to setup interaction observer:", error);
		hydrateIsland(island, framework);
	}
}

function setupIdleCallback(island: HTMLElement, framework: string): void {
	try {
		if ("requestIdleCallback" in globalThis) {
			const id = globalThis.requestIdleCallback(
				() => {
					hydrateIsland(island, framework);
				},
				{ timeout: 5000 },
			);
			addCleanup(island, () => globalThis.cancelIdleCallback?.(id));
			return;
		}

		const timer = setTimeout(() => {
			hydrateIsland(island, framework);
		}, 200);
		addCleanup(island, () => clearTimeout(timer));
	} catch (error) {
		console.error("Failed to setup idle callback:", error);
		hydrateIsland(island, framework);
	}
}

function setupMediaQuery(island: HTMLElement, framework: string, mediaQuery: string): void {
	try {
		const mql = globalThis.matchMedia(mediaQuery);
		if (mql.matches) {
			hydrateIsland(island, framework);
			return;
		}

		const handleChange = (event: MediaQueryListEvent) => {
			if (event.matches) {
				hydrateIsland(island, framework);
				mql.removeEventListener("change", handleChange);
			}
		};
		mql.addEventListener("change", handleChange);
		addCleanup(island, () => mql.removeEventListener("change", handleChange));
	} catch (error) {
		console.error("Failed to setup media query:", mediaQuery, error);
		hydrateIsland(island, framework);
	}
}

function scheduleIsland(island: HTMLElement): void {
	const framework = island.dataset.framework;
	const condition = island.dataset.condition || "on:client";
	const renderStrategy = island.dataset.renderStrategy;

	if (!framework) return;
	if (renderStrategy === "ssr-only") return;
	if (island.dataset.hydrated) return;

	if (condition === "on:client") {
		hydrateIsland(island, framework);
		return;
	}
	if (condition === "on:visible") {
		setupIntersectionObserver(island, framework);
		return;
	}
	if (condition === "on:interaction") {
		setupInteractionObserver(island, framework);
		return;
	}
	if (condition === "on:idle") {
		setupIdleCallback(island, framework);
		return;
	}
	if (condition.startsWith("media:")) {
		setupMediaQuery(island, framework, condition.slice(6));
		return;
	}
	if (
		island.dataset.customDirective ||
		island.dataset.directiveScript ||
		hasClientDirective(condition)
	) {
		const handled = executeCustomDirective(island, condition, () => {
			hydrateIsland(island, framework);
		});
		if (!handled) {
			console.warn(`[avalon] Unknown hydration condition: "${condition}". Hydrating immediately.`);
			hydrateIsland(island, framework);
		}
		return;
	}

	hydrateIsland(island, framework);
}

/**
 * Discover `[data-framework]` islands under `root` and hydrate them.
 * Safe to call after a body swap. Already-hydrated islands are skipped.
 */
export function scanAndHydrate(root: ParentNode = document): void {
	const islands = root.querySelectorAll<HTMLElement>("[data-framework]");
	for (const island of islands) {
		try {
			scheduleIsland(island);
		} catch (error) {
			console.error("Error processing island:", error);
		}
	}
}

/**
 * Dispose every island under `root`: observers, idle timers, and framework roots.
 * No skip list — the client router extracts persist nodes *before* calling this.
 */
export async function disposeIslands(root: ParentNode = document): Promise<void> {
	const islands = [...root.querySelectorAll<HTMLElement>("[data-framework]")];
	const loader = islands.length > 0 ? await getLoader() : null;

	for (const island of islands) {
		runCleanups(island);
		const framework = island.dataset.framework;
		if (framework && loader) {
			try {
				const integration = await loader.loadIntegrationModule(framework);
				if (typeof integration.unmount === "function") {
					await integration.unmount(island);
				}
			} catch (error) {
				console.warn(`[avalon] Failed to unmount ${framework} island:`, error);
			}
		}
		delete island.dataset.hydrated;
		delete island.dataset.hydrationStatus;
		delete island.dataset.hydrationError;
		delete island.dataset.litHydrated;
	}
}
