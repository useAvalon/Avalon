import { describe, expect, it } from "vitest";
import type { ResolvedAvalonConfig } from "../../vite-plugin/types.ts";
import { islandCodeSplittingPlugin, isSideEffectFreeModule } from "../island-code-splitting.ts";

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

describe("isSideEffectFreeModule", () => {
	it("matches solid-js dist files in node_modules", () => {
		expect(isSideEffectFreeModule("/node_modules/solid-js/dist/solid.js")).toBe(true);
	});
	it("matches solid-js/web dist files in node_modules", () => {
		expect(isSideEffectFreeModule("/node_modules/solid-js/web/dist/web.js")).toBe(true);
	});
	it("matches solid-js/store dist files in node_modules", () => {
		expect(isSideEffectFreeModule("/node_modules/solid-js/store/dist/store.js")).toBe(true);
	});
	it("matches preact dist files", () => {
		expect(isSideEffectFreeModule("/node_modules/preact/dist/preact.js")).toBe(true);
		expect(isSideEffectFreeModule("/node_modules/preact/hooks/dist/hooks.js")).toBe(true);
	});
	it("matches svelte dist files", () => {
		expect(isSideEffectFreeModule("/node_modules/svelte/dist/svelte.js")).toBe(true);
		expect(isSideEffectFreeModule("/node_modules/svelte/internal/dist/internal.js")).toBe(true);
	});
	it("matches lit dist files", () => {
		expect(isSideEffectFreeModule("/node_modules/lit/dist/lit.js")).toBe(true);
		expect(isSideEffectFreeModule("/node_modules/lit-html/dist/lit-html.js")).toBe(true);
		expect(
			isSideEffectFreeModule("/node_modules/@lit/reactive-element/dist/reactive-element.js"),
		).toBe(true);
	});
	it("matches resolved dist paths (e.g. from resolveId hook)", () => {
		expect(isSideEffectFreeModule("/project/node_modules/solid-js/dist/solid.js")).toBe(true);
	});
	it("rejects non-framework packages", () => {
		expect(isSideEffectFreeModule("/node_modules/lodash/dist/lodash.js")).toBe(false);
		expect(isSideEffectFreeModule("/node_modules/zod/dist/zod.js")).toBe(false);
	});
	it("rejects island component files", () => {
		expect(isSideEffectFreeModule("/src/islands/Counter.tsx")).toBe(false);
	});
});

describe("islandCodeSplittingPlugin — tree-shaking config", () => {
	it("includes treeshake.moduleSideEffects in production build config", () => {
		const plugin = islandCodeSplittingPlugin(makeConfig());
		const configHook = plugin.config as Function;
		const result = configHook({}, { command: "build" });
		expect(result.build.rollupOptions.treeshake).toBeDefined();
		expect(result.build.rollupOptions.treeshake.moduleSideEffects).toBeTypeOf("function");
	});
	it("moduleSideEffects returns false for all framework packages", () => {
		const plugin = islandCodeSplittingPlugin(makeConfig());
		const configHook = plugin.config as Function;
		const result = configHook({}, { command: "build" });
		const moduleSideEffects = result.build.rollupOptions.treeshake.moduleSideEffects;
		expect(moduleSideEffects("/node_modules/solid-js/dist/solid.js")).toBe(false);
		expect(moduleSideEffects("/node_modules/solid-js/web/dist/web.js")).toBe(false);
		expect(moduleSideEffects("/node_modules/preact/dist/preact.js")).toBe(false);
		expect(moduleSideEffects("/node_modules/svelte/dist/svelte.js")).toBe(false);
		expect(moduleSideEffects("/node_modules/lit/dist/lit.js")).toBe(false);
	});
	it("moduleSideEffects returns true for non-framework modules", () => {
		const plugin = islandCodeSplittingPlugin(makeConfig());
		const configHook = plugin.config as Function;
		const result = configHook({}, { command: "build" });
		const moduleSideEffects = result.build.rollupOptions.treeshake.moduleSideEffects;
		expect(moduleSideEffects("/src/islands/Counter.tsx")).toBe(true);
		expect(moduleSideEffects("/node_modules/lodash/dist/lodash.js")).toBe(true);
	});
});
