/**
 * HMR Coordinator
 *
 * Central orchestrator for all HMR operations in Avalon.
 * Integrates with Vite's HMR API and coordinates island updates across frameworks.
 */

/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { getCSSHMRHandler } from "./css-hmr-handler.ts";
import {
	AdapterRegistry,
	type FrameworkHMRAdapter,
	type StateSnapshot,
} from "./framework-adapter.ts";

/**
 * Vite HMR types (defined locally to avoid import issues)
 */
export interface HMRPayload {
	type: string;
	updates?: Update[];
	timestamp?: number;
}

export interface ErrorPayload {
	type: "error";
	err: {
		message: string;
		stack: string;
		id?: string;
		frame?: string;
		plugin?: string;
		pluginCode?: string;
		loc?: {
			file?: string;
			line: number;
			column: number;
		};
	};
}

export interface Update {
	type: "js-update" | "css-update";
	path: string;
	acceptedPath: string;
	timestamp: number;
	explicitImportRequired?: boolean;
}

/**
 * HMR update payload from Vite
 */
export interface HMRUpdatePayload extends HMRPayload {
	type: "update" | "full-reload" | "prune" | "error";
	updates?: ModuleUpdate[];
	timestamp?: number;
	err?: ErrorPayload;
}

/**
 * Individual module update information
 */
export interface ModuleUpdate {
	type: "js-update" | "css-update";
	path: string;
	acceptedPath: string;
	timestamp: number;
}

// Re-export types for backward compatibility
export type { FrameworkHMRAdapter, StateSnapshot } from "./framework-adapter.ts";

/**
 * HMR Coordinator class
 * Manages HMR lifecycle and coordinates updates across islands
 */
export class HMRCoordinator {
	private readonly registry: AdapterRegistry = new AdapterRegistry();
	private readonly stateSnapshots: Map<string, StateSnapshot> = new Map();
	private readonly updateQueue: Set<string> = new Set();
	private isProcessing = false;

	/**
	 * Initialize the HMR coordinator
	 * Sets up Vite HMR listeners and accepts updates
	 */
	initialize(): void {
		// @ts-expect-error - Vite HMR is available in browser context
		if (!import.meta.hot) {
			return;
		}

		// @ts-expect-error - Vite HMR API
		import.meta.hot.accept();

		// @ts-expect-error - Vite HMR event types
		import.meta.hot.on("vite:beforeUpdate", (payload: HMRPayload) => {
			this.handleUpdate(payload as HMRUpdatePayload);
		});

		// @ts-expect-error - Vite HMR event types
		import.meta.hot.on("vite:beforeFullReload", () => {
			this.handleBeforeFullReload();
		});

		// @ts-expect-error - Vite HMR event types
		import.meta.hot.on("vite:error", (payload: ErrorPayload) => {
			console.error("[HMR] error:", payload);
			this.handleError(payload);
		});

		document.addEventListener("hmr-update-required", (event: Event) => {
			const customEvent = event as CustomEvent;
			const { src, reason } = customEvent.detail;

			if (reason === "css-module-update") {
				this.updateQueue.add(this.normalizePath(src));

				if (!this.isProcessing) {
					this.processUpdateQueue().catch((error) => {
						console.error("[HMR] Failed to process CSS module update:", error);
					});
				}
			}
		});
	}

	registerAdapter(framework: string, adapter: FrameworkHMRAdapter): void {
		this.registry.register(framework, adapter);
	}

	getRegistry(): AdapterRegistry {
		return this.registry;
	}

	async handleUpdate(payload: HMRUpdatePayload): Promise<void> {
		if (payload.type !== "update" || !payload.updates) {
			return;
		}

		const cssUpdates: ModuleUpdate[] = [];
		const jsUpdates: ModuleUpdate[] = [];

		for (const update of payload.updates) {
			if (update.type === "css-update") {
				cssUpdates.push(update);
			} else {
				jsUpdates.push(update);
			}
		}

		this.processCSSUpdates(cssUpdates);
		this.queueJSUpdates(jsUpdates);

		if (!this.isProcessing && this.updateQueue.size > 0) {
			await this.processUpdateQueue();
		}
	}

	private processCSSUpdates(cssUpdates: ModuleUpdate[]): void {
		if (cssUpdates.length === 0) return;

		const cssHandler = getCSSHMRHandler();
		for (const cssUpdate of cssUpdates) {
			try {
				cssHandler.handleCSSUpdate(cssUpdate);
			} catch (error) {
				console.error("[HMR] CSS update failed:", error);
			}
		}
	}

	private queueJSUpdates(jsUpdates: ModuleUpdate[]): void {
		for (const update of jsUpdates) {
			const normalizedPath = this.normalizePath(update.path || update.acceptedPath);
			if (this.isIslandModule(normalizedPath)) {
				this.updateQueue.add(normalizedPath);
			}
		}
	}

	private async processUpdateQueue(): Promise<void> {
		if (this.updateQueue.size === 0) return;

		this.isProcessing = true;

		try {
			const paths = Array.from(this.updateQueue);
			this.updateQueue.clear();

			for (const path of paths) {
				const islands = this.findAffectedIslands(path);
				for (const island of islands) {
					try {
						await this.updateIsland(island);
					} catch (error) {
						console.error("[HMR] Failed to update island:", error);
					}
				}
			}
		} finally {
			this.isProcessing = false;
		}
	}

	findAffectedIslands(modulePath: string): HTMLElement[] {
		const islands: HTMLElement[] = [];
		const normalizedPath = this.normalizePath(modulePath);
		const allIslands = document.querySelectorAll<HTMLElement>("[data-src]");

		for (const island of allIslands) {
			const src = island.dataset.src;
			if (!src) continue;

			const normalizedSrc = this.normalizePath(src);
			const isMatch =
				normalizedSrc === normalizedPath ||
				normalizedSrc.endsWith(normalizedPath) ||
				normalizedPath.endsWith(normalizedSrc) ||
				normalizedSrc.split("/").pop() === normalizedPath.split("/").pop();

			if (isMatch) {
				islands.push(island);
			}
		}

		return islands;
	}

	async updateIsland(island: HTMLElement): Promise<void> {
		const framework = island.dataset.framework;
		const src = island.dataset.src;
		const propsAttr = island.dataset.props;

		if (!framework || !src) {
			console.warn("[HMR] Island missing framework or src attribute", island);
			return;
		}

		const adapter = this.registry.get(framework.toLowerCase());
		if (!adapter) {
			console.warn(`[HMR] No adapter registered for framework: ${framework}`);
			return;
		}

		try {
			const props = propsAttr ? JSON.parse(propsAttr) : {};
			const state = adapter.preserveState(island);

			if (state) {
				this.stateSnapshots.set(this.getIslandId(island), state);
			}

			delete island.dataset.hydrated;
			delete island.dataset.hydrationStatus;

			island.querySelector(".hydration-error-indicator, .hmr-error-indicator")?.remove();

			const timestamp = Date.now();
			const freshSrc = src.includes("?") ? `${src}&t=${timestamp}` : `${src}?t=${timestamp}`;
			const componentModule = await import(/* @vite-ignore */ freshSrc);
			const Component = this.resolveComponent(componentModule, src);

			await adapter.update(island, Component, props);

			if (state) {
				adapter.restoreState(island, state);
				this.stateSnapshots.delete(this.getIslandId(island));
			}

			island.dataset.hydrated = "true";

			island.dispatchEvent(
				new CustomEvent("hmr-update", {
					detail: { framework, src, timestamp: Date.now(), success: true },
					bubbles: true,
				}),
			);
		} catch (error) {
			console.error(`[HMR] Failed to update ${framework} island ${src}:`, error);
			adapter.handleError(island, error as Error);

			island.dispatchEvent(
				new CustomEvent("hmr-error", {
					detail: { framework, src, error: (error as Error).message, timestamp: Date.now() },
					bubbles: true,
				}),
			);

			throw error;
		}
	}

	private resolveComponent(componentModule: Record<string, unknown>, src: string): unknown {
		if (componentModule.default) return componentModule.default;

		for (const key of Object.keys(componentModule)) {
			if (key === "default") continue;
			const value = componentModule[key];
			if (typeof value === "function" && value.prototype) {
				return value;
			}
		}

		throw new Error(`Component ${src} has no default export`);
	}

	private handleBeforeFullReload(): void {
		const islands = document.querySelectorAll<HTMLElement>('[data-hydrated="true"]');
		const states: Record<string, StateSnapshot> = {};

		for (const island of islands) {
			const framework = island.dataset.framework;
			const src = island.dataset.src;

			if (!framework || !src) continue;

			const adapter = this.registry.get(framework.toLowerCase());
			if (!adapter) continue;

			const state = adapter.preserveState(island);
			if (state) {
				states[src] = state;
			}
		}

		try {
			sessionStorage.setItem("__avalon_hmr_states__", JSON.stringify(states));
		} catch (error) {
			console.warn("[HMR] Failed to save states:", error);
		}
	}

	private handleError(payload: ErrorPayload): void {
		const error = new Error(payload.err.message);
		error.stack = payload.err.stack;

		console.error("[HMR] Error:", error);

		if (globalThis.window !== undefined) {
			// @ts-expect-error - dynamic import of JS file
			import("./hmr-error-overlay.js")
				.then(
					({
						showHMRErrorOverlay,
					}: {
						showHMRErrorOverlay: (opts: Record<string, unknown>) => void;
					}) => {
						showHMRErrorOverlay({
							framework: "unknown",
							src: "unknown",
							error,
							filePath: payload.err.id || payload.err.loc?.file || "unknown",
							line: payload.err.loc?.line,
							column: payload.err.loc?.column,
						});
					},
				)
				.catch(() => {
					console.error("[HMR] Failed to show error overlay");
				});
		}
	}

	private normalizePath(path: string): string {
		return path
			.replaceAll("\\", "/")
			.replace(/^\//, "")
			.replace(/\?.*$/, "")
			.replace(/#.*$/, "")
			.replace(/^src\//, "");
	}

	private isIslandModule(path: string): boolean {
		return path.includes("/islands/") || path.includes("\\islands\\");
	}

	private getIslandId(island: HTMLElement): string {
		const src = island.dataset.src ?? "";
		const framework = island.dataset.framework ?? "";
		const index = Array.from(document.querySelectorAll(`[data-src="${src}"]`)).indexOf(island);
		return `${framework}:${src}:${index}`;
	}
}

/**
 * Global HMR coordinator instance
 */
let coordinatorInstance: HMRCoordinator | null = null;

export function getHMRCoordinator(): HMRCoordinator {
	coordinatorInstance ??= new HMRCoordinator();
	return coordinatorInstance;
}

export function initializeHMR(): void {
	// @ts-expect-error - Vite HMR is available in browser context
	if (!import.meta.hot) {
		return;
	}

	const coordinator = getHMRCoordinator();
	coordinator.initialize();
}
