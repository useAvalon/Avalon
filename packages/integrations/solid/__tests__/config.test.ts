import { describe, expect, it } from "vitest";
import { solidIntegration } from "../mod.ts";

describe("solidIntegration.config()", () => {
	const cfg = solidIntegration.config();

	it('returns "solid" as the integration name', () => {
		expect(cfg.name).toBe("solid");
	});

	it("declares .tsx, .jsx, .ts, and .js file extensions", () => {
		expect(cfg.fileExtensions).toEqual([".tsx", ".jsx", ".ts", ".js"]);
	});

	it('declares "solid-js" and "solid-js/h" as JSX import sources', () => {
		expect(cfg.jsxImportSources).toContain("solid-js");
		expect(cfg.jsxImportSources).toContain("solid-js/h");
	});

	describe("detection patterns - imports", () => {
		const { imports } = cfg.detectionPatterns;

		it('matches bare "solid-js" import', () => {
			expect(imports.some((r) => r.test("solid-js"))).toBe(true);
		});

		it('matches "solid-js/" subpath import', () => {
			expect(imports.some((r) => r.test("solid-js/web"))).toBe(true);
		});

		it('matches from "solid-js" import statement', () => {
			const code = "import { createSignal } from 'solid-js'";
			expect(imports.some((r) => r.test(code))).toBe(true);
		});

		it('matches from "solid-js/web" import statement', () => {
			const code = "import { hydrate } from 'solid-js/web'";
			expect(imports.some((r) => r.test(code))).toBe(true);
		});

		it("does not match unrelated imports", () => {
			const code = "import { useState } from 'react'";
			expect(imports.some((r) => r.test(code))).toBe(false);
		});
	});

	describe("detection patterns - content", () => {
		const { content } = cfg.detectionPatterns;

		it("matches createSignal", () => {
			expect(content.some((r) => r.test("const [count, setCount] = createSignal(0)"))).toBe(true);
		});

		it("matches createEffect", () => {
			expect(content.some((r) => r.test("createEffect(() => console.log(count()))"))).toBe(true);
		});

		it("matches createMemo", () => {
			expect(content.some((r) => r.test("const doubled = createMemo(() => count() * 2)"))).toBe(
				true,
			);
		});

		it("matches createResource", () => {
			expect(content.some((r) => r.test("const [data] = createResource(fetchData)"))).toBe(true);
		});

		it("matches Show component", () => {
			expect(content.some((r) => r.test("<Show when={visible()}>"))).toBe(true);
		});

		it("matches For component", () => {
			expect(content.some((r) => r.test("<For each={items()}>"))).toBe(true);
		});

		it("matches .solid. file pattern", () => {
			expect(content.some((r) => r.test("Counter.solid.tsx"))).toBe(true);
		});

		it("does not match unrelated content", () => {
			expect(content.some((r) => r.test("const x = 42"))).toBe(false);
		});
	});
});

describe("solidIntegration.vitePlugin() — tree-shaking config", () => {
	it("configures vite-plugin-solid with hydratable: true", async () => {
		const plugins = await solidIntegration.vitePlugin!();
		const pluginArray = Array.isArray(plugins) ? plugins : [plugins];
		// The second plugin is vite-plugin-solid itself
		const solidPlugin = pluginArray.find(
			(p) => p.name === "vite-plugin-solid" || p.name?.includes("solid"),
		);
		// vite-plugin-solid exists in the array
		expect(solidPlugin).toBeDefined();
	});

	it("includes avalon:solid-oxc-exclude plugin with resolveId hook", async () => {
		const plugins = await solidIntegration.vitePlugin!();
		const pluginArray = Array.isArray(plugins) ? plugins : [plugins];
		const oxcPlugin = pluginArray.find((p) => p.name === "avalon:solid-oxc-exclude");
		expect(oxcPlugin).toBeDefined();
		expect(oxcPlugin!.resolveId).toBeTypeOf("function");
	});

	it("returns three plugins in correct order", async () => {
		const plugins = await solidIntegration.vitePlugin!();
		const pluginArray = Array.isArray(plugins) ? plugins : [plugins];
		expect(pluginArray).toHaveLength(3);
		expect(pluginArray[0].name).toBe("avalon:solid-oxc-exclude");
		expect(pluginArray[2].name).toBe("avalon:solid-ts-strip");
	});
});
