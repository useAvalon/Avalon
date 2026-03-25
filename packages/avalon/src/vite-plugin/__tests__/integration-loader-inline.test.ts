import { describe, it, expect } from "vitest";
import { generateIntegrationLoaderModule } from "../nitro-integration.ts";
import type { ResolvedAvalonConfig } from "../types.ts";

/**
 * Minimal config factory for testing generateIntegrationLoaderModule.
 * Only the fields the function reads are required.
 */
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

describe("generateIntegrationLoaderModule — Solid adapter inlining", () => {
	it("inlines the Solid hydrate adapter in production mode", () => {
		const code = generateIntegrationLoaderModule(makeConfig({ isDev: false }));

		// Should contain the inlined adapter function
		expect(code).toContain("_solidHydrate");
		expect(code).toContain("_ensureHydrationContext");
		expect(code).toContain("_solidModule");

		// The switch case should return the inlined module, not a dynamic import
		expect(code).toContain('case "solid":');
		expect(code).toContain("return _solidModule;");

		// Should NOT have a dynamic import for the solid client adapter
		expect(code).not.toContain('import("@useavalon/solid/client")');
	});

	it("uses dynamic import for Solid in development mode", () => {
		const code = generateIntegrationLoaderModule(makeConfig({ isDev: true }));

		// Should NOT contain the inlined adapter
		expect(code).not.toContain("_solidHydrate");
		expect(code).not.toContain("_ensureHydrationContext");
		expect(code).not.toContain("_solidModule");

		// Should use dynamic import
		expect(code).toContain('import("@useavalon/solid/client")');
	});

	it("inlined adapter imports hydrate from solid-js/web (not render)", () => {
		const code = generateIntegrationLoaderModule(makeConfig({ isDev: false }));

		// The primary hydration path should import hydrate + createComponent
		expect(code).toContain('import("solid-js/web")');
		expect(code).toContain("hydrate: solidHydrate");
		expect(code).toContain("createComponent");

		// render() fallback should NOT be present — saves ~1-2 KiB
		expect(code).not.toContain("render: solidRender");
		expect(code).not.toContain("solidRender(");
		expect(code).not.toContain("import(\"solid-js/web\");\n  el.textContent");
	});

	it("inlined adapter sets up _$HY hydration context", () => {
		const code = generateIntegrationLoaderModule(makeConfig({ isDev: false }));

		expect(code).toContain("globalThis._$HY");
		expect(code).toContain("events: []");
		expect(code).toContain("completed: new WeakSet()");
	});

	it("does not inline when Solid is not configured", () => {
		const code = generateIntegrationLoaderModule(
			makeConfig({ integrations: ["preact"], isDev: false }),
		);

		expect(code).not.toContain("_solidHydrate");
		expect(code).not.toContain("_solidModule");
		expect(code).not.toContain("solid-js/web");
		expect(code).toContain('import("@useavalon/preact/client")');
	});

	it("still generates HMR adapter loader for Solid", () => {
		const code = generateIntegrationLoaderModule(makeConfig({ isDev: false }));

		// HMR adapter should still use dynamic import (it's a separate concern)
		expect(code).toContain('import("@useavalon/solid/client/hmr")');
		expect(code).toContain("loadHMRAdapter");
	});

	it("handles multiple integrations with Solid inlined", () => {
		const code = generateIntegrationLoaderModule(
			makeConfig({ integrations: ["preact", "solid", "lit"], isDev: false }),
		);

		// Solid should be inlined
		expect(code).toContain("_solidModule");
		expect(code).toContain('case "solid":');
		expect(code).toContain("return _solidModule;");

		// Other frameworks should still use dynamic imports
		expect(code).toContain('import("@useavalon/preact/client")');
		expect(code).toContain('import("@useavalon/lit/client")');

		// Lit pre-hydration should still be present
		expect(code).toContain("preLitHydration");
	});
});
