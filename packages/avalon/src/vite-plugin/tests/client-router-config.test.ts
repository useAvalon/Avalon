import { describe, expect, it } from "vitest";
import { generateConfigModule } from "../nitro-integration.ts";
import type { ResolvedAvalonConfig } from "../types.ts";

function makeConfig(overrides: Partial<ResolvedAvalonConfig> = {}): ResolvedAvalonConfig {
	return {
		pagesDir: "src/pages",
		layoutsDir: "src/layouts",
		isDev: false,
		clientRouter: false,
		integrations: [],
		verbose: false,
		...overrides,
	} as ResolvedAvalonConfig;
}

describe("generateConfigModule — clientRouter", () => {
	it("sets per-island hydration in production by default", () => {
		const src = generateConfigModule(makeConfig(), {});
		expect(src).toContain('__avalonHydrationMode = "per-island"');
		expect(src).toContain("clientRouter");
	});

	it("sets entry-client hydration when clientRouter is on in production", () => {
		const src = generateConfigModule(makeConfig({ clientRouter: true, isDev: false }), {});
		expect(src).toContain('__avalonHydrationMode = "entry-client"');
		expect(src).toContain('"clientRouter": true');
	});
});
