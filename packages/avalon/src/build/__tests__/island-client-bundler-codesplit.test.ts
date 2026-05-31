import { describe, expect, it } from "vitest";
import type { ResolvedAvalonConfig } from "../../vite-plugin/types.ts";
import { islandClientBundlerPlugin } from "../island-client-bundler.ts";

function makeConfig(overrides: Partial<ResolvedAvalonConfig> = {}): ResolvedAvalonConfig {
	return {
		pagesDir: "src/pages",
		layoutsDir: "src/layouts",
		isDev: false,
		integrations: ["solid"],
		verbose: false,
		...overrides,
	} as ResolvedAvalonConfig;
}

/** Simulate Vite's configResolved to set the hydration mode */
function applyConfigResolved(
	plugin: ReturnType<typeof islandClientBundlerPlugin>,
	command: "build" | "serve",
) {
	const hook = plugin.configResolved as Function;
	hook({ command });
}

describe("islandClientBundlerPlugin — per-island code splitting", () => {
	it("includes integration loader re-export in production build (per-island mode)", () => {
		const plugin = islandClientBundlerPlugin(makeConfig(), {});
		applyConfigResolved(plugin, "build");
		const loadHook = plugin.load as Function;

		// Simulate loading a wrapper module
		const result = loadHook("\0avalon-island-entry:/src/islands/Counter.tsx");
		expect(result).toContain("loadIntegrationModule");
		expect(result).toContain("virtual:avalon/integration-loader");
	});

	it("does not include integration loader re-export in dev mode (entry-client mode)", () => {
		const plugin = islandClientBundlerPlugin(makeConfig(), {});
		applyConfigResolved(plugin, "serve");
		const loadHook = plugin.load as Function;

		const result = loadHook("\0avalon-island-entry:/src/islands/Counter.tsx");
		expect(result).not.toContain("loadIntegrationModule");
	});

	it("does not include integration loader re-export when no nitroConfig", () => {
		const plugin = islandClientBundlerPlugin(makeConfig());
		applyConfigResolved(plugin, "serve");
		const loadHook = plugin.load as Function;

		const result = loadHook("\0avalon-island-entry:/src/islands/Counter.tsx");
		expect(result).not.toContain("loadIntegrationModule");
	});

	it("Qwik islands use minimal wrapper in production (no integration loader, no default import)", () => {
		const plugin = islandClientBundlerPlugin(makeConfig(), {});
		applyConfigResolved(plugin, "build");
		const loadHook = plugin.load as Function;

		const result = loadHook("\0avalon-island-entry:/src/islands/Counter.qwik.tsx");
		// Qwik uses resumability — only re-export QRL symbols, no eager runtime
		expect(result).toContain("export *");
		expect(result).toContain("@builder.io/qwik");
		expect(result).not.toContain("loadIntegrationModule");
		expect(result).not.toContain("__avalonIsland");
		expect(result).not.toContain("import __C");
	});

	it("still exports the component in production build (per-island mode)", () => {
		const plugin = islandClientBundlerPlugin(makeConfig(), {});
		applyConfigResolved(plugin, "build");
		const loadHook = plugin.load as Function;

		const result = loadHook("\0avalon-island-entry:/src/islands/Counter.tsx");
		expect(result).toContain("export { Component as default, Component }");
		expect(result).toContain("__avalonIsland");
	});

	it("returns null for non-island-entry modules", () => {
		const plugin = islandClientBundlerPlugin(makeConfig(), {});
		applyConfigResolved(plugin, "build");
		const loadHook = plugin.load as Function;

		const result = loadHook("/src/pages/index.tsx");
		expect(result).toBeNull();
	});
});
