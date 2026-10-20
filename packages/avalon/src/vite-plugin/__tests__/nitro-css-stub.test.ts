import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "vite";
import { describe, expect, it, vi } from "vitest";
import { stableDevScopedName } from "../dev-css-modules.ts";
import {
	createNitroCssStubPlugin,
	cssModuleExportMap,
	fileFromNitroCssStubId,
	generateNitroCssStub,
	isNitroCssStubEnvironment,
	isNitroCssStubId,
	localCssModuleClassNames,
	NITRO_CSS_STUB_ID,
	nitroCssStubVirtualId,
	resolveNitroCssStubFile,
	stripCssModuleGlobals,
} from "../nitro-css-stub.ts";

describe("nitro CSS stub", () => {
	it("runs only in nitro and ssr environments", () => {
		expect(isNitroCssStubEnvironment("nitro")).toBe(true);
		expect(isNitroCssStubEnvironment("ssr")).toBe(true);
		expect(isNitroCssStubEnvironment("client")).toBe(false);
	});

	it("stubs CSS imports except browser ?direct fetches", () => {
		expect(isNitroCssStubId("./BentoFeatures.module.css")).toBe(true);
		expect(isNitroCssStubId("/app/x.css")).toBe(true);
		expect(isNitroCssStubId("/app/x.css?direct")).toBe(false);
		expect(isNitroCssStubId("/app/x.css?direct&t=1")).toBe(false);
		expect(isNitroCssStubId("/app/page.tsx")).toBe(false);
	});

	it("resolves relative CSS against the importer", () => {
		expect(
			resolveNitroCssStubFile("./BentoFeatures.module.css", "/app/modules/main/BentoFeatures.tsx"),
		).toBe("/app/modules/main/BentoFeatures.module.css");
	});

	it("returns an empty module for global stylesheets", () => {
		expect(generateNitroCssStub("/app/global.css")).toBe("export default {};\n");
	});

	it("does not regex-scan preprocessor sources without compiled CSS", () => {
		const scss = ".grid { display: grid; .inner { color: red; } }";
		expect(generateNitroCssStub("/app/x.module.scss", scss)).toBe("export default {};\n");
	});

	it("emits the same hashes the client scoped name uses", () => {
		const file = "/app/modules/main/components/BentoFeatures.module.css";
		const css = ".grid { display: grid; }\n.cardLg { grid-column: span 2; }\n";
		const src = generateNitroCssStub(file, css);
		expect(src).toContain(`"grid":"${stableDevScopedName("grid", file)}"`);
		expect(src).toContain(`"cardLg":"${stableDevScopedName("cardLg", file)}"`);
		expect(localCssModuleClassNames(css)).toEqual(["grid", "cardLg"]);
	});

	it("skips :global selectors and inlines local composes", () => {
		const file = "/app/x.module.css";
		const css = `
			:global(.reset) { margin: 0; }
			.foo { composes: bar; color: red; }
			.bar { color: blue; }
		`;
		expect(stripCssModuleGlobals(css)).not.toContain("reset");
		const map = cssModuleExportMap(file, css);
		expect(map.reset).toBeUndefined();
		expect(map.foo).toBe(`${stableDevScopedName("foo", file)} ${stableDevScopedName("bar", file)}`);
		expect(map.bar).toBe(stableDevScopedName("bar", file));
	});

	it("load uses the preprocessCSS modules map from a resolved Vite config", async () => {
		const dir = mkdtempSync(join(tmpdir(), "avalon-css-stub-"));
		const file = join(dir, "card.module.css").replaceAll("\\", "/");
		writeFileSync(
			file,
			[
				".card {",
				"  color: red;",
				"  .title { font-weight: 600; }",
				"}",
				":global(.reset) { margin: 0; }",
				"",
			].join("\n"),
		);
		try {
			const config = await resolveConfig(
				{
					configFile: false,
					css: { modules: { generateScopedName: stableDevScopedName } },
				},
				"serve",
			);
			const plugin = createNitroCssStubPlugin();
			const load = plugin.load;
			if (typeof load !== "function") throw new Error("missing load");
			const result = await load.call(
				{
					addWatchFile: () => undefined,
					environment: { config },
				} as never,
				nitroCssStubVirtualId(file),
			);
			expect(result).toMatchObject({ moduleType: "js" });
			const code = (result as { code: string }).code;
			const map = JSON.parse(code.replace(/^export default /, "").replace(/;\s*$/, "")) as Record<
				string,
				string
			>;
			expect(map.card).toBe(stableDevScopedName("card", file));
			expect(map.title).toBe(stableDevScopedName("title", file));
			expect(map.reset).toBeUndefined();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("exposes a pre-enforce serve plugin on a non-css virtual id", () => {
		const plugin = createNitroCssStubPlugin();
		expect(plugin.name).toBe("avalon:nitro-css-stub");
		expect(plugin.apply).toBe("serve");
		expect(plugin.enforce).toBe("pre");
		const id = nitroCssStubVirtualId("/app/x.module.css");
		expect(id.startsWith(`\0${NITRO_CSS_STUB_ID}/`)).toBe(true);
		expect(id.includes(".css")).toBe(false);
		expect(fileFromNitroCssStubId(id)).toBe("/app/x.module.css");
	});

	it("resolveId uses Vite resolve and skips unresolved or external ids", async () => {
		const plugin = createNitroCssStubPlugin();
		const resolveId = plugin.resolveId;
		if (typeof resolveId !== "function") throw new Error("missing resolveId");

		const resolve = vi.fn(async () => ({
			id: "/abs/BentoFeatures.module.css",
			external: false,
		}));
		const id = await resolveId.call(
			{ resolve } as never,
			"./BentoFeatures.module.css",
			"/abs/BentoFeatures.tsx",
		);
		expect(resolve).toHaveBeenCalledWith("./BentoFeatures.module.css", "/abs/BentoFeatures.tsx", {
			skipSelf: true,
		});
		expect(id).toBe(nitroCssStubVirtualId("/abs/BentoFeatures.module.css"));

		resolve.mockResolvedValueOnce({ id: "/abs/x.module.css", external: true });
		expect(await resolveId.call({ resolve } as never, "./x.module.css", "/abs/a.tsx")).toBeNull();
	});

	it("load watches the source CSS file", async () => {
		const plugin = createNitroCssStubPlugin();
		const load = plugin.load;
		if (typeof load !== "function") throw new Error("missing load");
		const file = "/app/missing.module.css";
		const watched: string[] = [];
		const result = await load.call(
			{
				addWatchFile: (f: string) => {
					watched.push(f);
				},
				environment: undefined,
			} as never,
			nitroCssStubVirtualId(file),
		);
		expect(watched).toEqual([file]);
		expect(result).toEqual({
			code: "export default {};\n",
			moduleType: "js",
		});
	});
});
