/**
 * Vitest setup for @useavalon/avalon.
 *
 * `URLPattern` is a runtime global in Node 22+/Bun/Deno, but it is not present
 * in every CI runner. Several modules (layout discovery, middleware discovery,
 * routing) construct `new URLPattern(...)` at runtime, so we polyfill it when
 * the global is missing to keep tests deterministic across runtimes.
 */
import { URLPattern as URLPatternPolyfill } from "urlpattern-polyfill";

if (typeof (globalThis as { URLPattern?: unknown }).URLPattern === "undefined") {
	(globalThis as { URLPattern?: unknown }).URLPattern = URLPatternPolyfill;
}

/**
 * Mock virtual modules that are provided by Vite plugins at build time.
 * These don't exist on disk, so vitest can't resolve them without mocking.
 */
import { vi } from "vitest";

vi.mock("virtual:server-island-key", () => ({
	serverIslandKey: "",
}));

vi.mock("virtual:server-island-manifest", () => ({
	serverIslandManifest: {},
	serverIslandLoaders: {},
	serverIslandCSS: {},
}));

vi.mock("virtual:server-island-integrations", () => ({}));

vi.mock("virtual:avalon/integration-loader", () => ({
	loadIntegrationModule: async () => ({
		hydrate: () => {},
		unmount: () => {},
	}),
	preLitHydration: async () => {},
	loadHMRAdapter: async () => null,
}));
