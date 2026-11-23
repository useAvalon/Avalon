import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vitest";
import { mdxIslandTransform } from "../../build/mdx-island-transform.ts";
import { pageIslandTransform } from "../../build/page-island-transform.ts";
import { generateRendererModule } from "../nitro-integration.ts";
import type { ResolvedAvalonConfig } from "../types.ts";

/**
 * Code generated into the SSR graph (the renderer virtual module and page
 * transforms) must import Avalon through runtime subpaths. The package barrel
 * re-exports the Vite plugin, and with it Vite, nitro/vite, rolldown and
 * @vercel/nft, which then end up in edge (workerd) server bundles.
 */

const PKG_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const PKG = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf-8")) as {
	exports: Record<string, string>;
};

const BUILD_ONLY = [/^vite(?:\/|$)/, /^nitro\/vite/, /^rolldown/, /^@rolldown\//, /^@vercel\/nft/];

function avalonSpecifiers(code: string): string[] {
	return [...code.matchAll(/["'](@useavalon\/avalon(?:\/[^"']*)?)["']/g)].map((m) => m[1] ?? "");
}

function exportTarget(specifier: string): string {
	const sub =
		specifier === "@useavalon/avalon" ? "." : `./${specifier.slice("@useavalon/avalon/".length)}`;
	const target = PKG.exports[sub];
	if (!target) throw new Error(`${specifier} is not in package.json exports`);
	return join(PKG_ROOT, target);
}

/** Value (non-type) static imports and re-exports of a module. */
function runtimeImports(file: string): string[] {
	const code = readFileSync(file, "utf-8");
	const lang = file.endsWith(".tsx") ? "tsx" : file.endsWith(".ts") ? "ts" : "js";
	const { module } = parseSync(file, code, { lang, sourceType: "module" });
	const out: string[] = [];
	for (const imp of module.staticImports) {
		const typeOnly = imp.entries.length > 0 && imp.entries.every((entry) => entry.isType);
		if (!typeOnly) out.push(imp.moduleRequest.value);
	}
	for (const exp of module.staticExports) {
		for (const entry of exp.entries) {
			if (entry.moduleRequest && !entry.isType) out.push(entry.moduleRequest.value);
		}
	}
	return out;
}

function resolveRelative(from: string, specifier: string): string | null {
	const base = resolve(dirname(from), specifier);
	for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`]) {
		if (existsSync(candidate) && !candidate.endsWith("/")) {
			try {
				readFileSync(candidate);
				return candidate;
			} catch {
				// directory
			}
		}
	}
	return null;
}

/** Every local module reachable through static value imports from `entry`. */
function reachableFiles(entry: string): string[] {
	const seen = new Set<string>();
	const stack = [entry];
	while (stack.length > 0) {
		const file = stack.pop() as string;
		if (seen.has(file)) continue;
		seen.add(file);
		for (const specifier of runtimeImports(file)) {
			if (!specifier.startsWith(".")) continue;
			const next = resolveRelative(file, specifier);
			if (next) stack.push(next);
		}
	}
	return [...seen].map((file) => file.slice(PKG_ROOT.length + 1));
}

/** Walks the static import graph and returns every bare specifier reached, with its importer. */
function reachableBareImports(entry: string): Array<{ specifier: string; from: string }> {
	const seen = new Set<string>();
	const bare: Array<{ specifier: string; from: string }> = [];
	const stack = [entry];
	while (stack.length > 0) {
		const file = stack.pop() as string;
		if (seen.has(file)) continue;
		seen.add(file);
		for (const specifier of runtimeImports(file)) {
			if (specifier.startsWith(".")) {
				const next = resolveRelative(file, specifier);
				if (next) stack.push(next);
				continue;
			}
			if (specifier.startsWith("@useavalon/avalon")) {
				stack.push(exportTarget(specifier));
				continue;
			}
			bare.push({ specifier, from: file.slice(PKG_ROOT.length + 1) });
		}
	}
	return bare;
}

function rendererCode(integrations: string[], core: "preact" | "react" = "preact"): string {
	return generateRendererModule({
		pagesDir: "src/pages",
		layoutsDir: "src/layouts",
		isDev: false,
		integrations,
		core,
		verbose: false,
	} as unknown as ResolvedAvalonConfig);
}

function transformPage(code: string): string {
	const plugin = pageIslandTransform({
		pagesDir: "src/pages",
		layoutsDir: "src/layouts",
		modules: { dir: "app/modules", pagesDirName: "pages", layoutsDirName: "layouts" },
	});
	const hook = plugin.transform as (code: string, id: string) => { code: string } | null;
	const result = hook.call({}, code, "/project/app/modules/main/pages/index.tsx");
	if (!result) throw new Error("no transform");
	return result.code;
}

describe("server bundle imports", () => {
	it("the renderer virtual module loads the URLPattern polyfill through Avalon, not a bare import", () => {
		const code = rendererCode(["preact"]);
		// A bare `urlpattern-polyfill` resolves from the app, which under pnpm does not have it.
		expect(code).not.toMatch(/["']urlpattern-polyfill["']/);
		expect(avalonSpecifiers(code)).toContain("@useavalon/avalon/polyfills/urlpattern");
	});

	it("the renderer virtual module does not import the package barrel", () => {
		const specifiers = avalonSpecifiers(rendererCode(["react"], "react"));
		expect(specifiers.length).toBeGreaterThan(0);
		expect(specifiers).not.toContain("@useavalon/avalon");
	});

	it("the renderer only imports the configured integrations", () => {
		const code = rendererCode(["react"], "react");
		expect(code).toContain("@useavalon/react");
		for (const other of ["vue", "svelte", "solid", "lit", "qwik"]) {
			expect(code).not.toContain(`@useavalon/${other}`);
		}
	});

	it("page and MDX island transforms import renderIsland from a subpath", () => {
		const page = transformPage(`import Counter from "../components/Counter.react.tsx";
export default function Page() {
  return <ul>{[1, 2].map((n) => <li key={n}><Counter island={{ condition: "on:client" }} n={n} /></li>)}</ul>;
}
`);
		expect(page).toContain("__pageRenderIsland");
		expect(avalonSpecifiers(page)).toEqual(["@useavalon/avalon/islands/island"]);

		const mdx = mdxIslandTransform() as { transform: (code: string, id: string) => unknown };
		const out = mdx.transform.call(
			{},
			// Compiled MDX output: islands are jsx/jsxDEV calls by now.
			`import Counter from "../components/Counter.tsx";\nfunction _createMdxContent(props) { return _jsxDEV(Counter, { island: { condition: "on:visible" } }); }\nexport default function MDXContent(props) { return _createMdxContent(props); }\n`,
			"/project/app/modules/main/pages/post.mdx",
		) as { code: string } | string | null;
		const mdxCode = typeof out === "string" ? out : (out?.code ?? "");
		expect(mdxCode).toContain("__AvalonRenderIsland({");
		expect(mdxCode).not.toContain("_jsxDEV(Counter");
		expect(avalonSpecifiers(mdxCode)).toEqual(["@useavalon/avalon/islands/island"]);
	});

	it("runtime subpaths used by generated code never reach build-time packages", () => {
		const specifiers = new Set([
			...avalonSpecifiers(rendererCode(["react", "preact"], "react")),
			"@useavalon/avalon/islands/island",
		]);
		const leaks: Array<{ entry: string; specifier: string; from: string }> = [];
		for (const entry of specifiers) {
			for (const hit of reachableBareImports(exportTarget(entry))) {
				if (BUILD_ONLY.some((re) => re.test(hit.specifier))) leaks.push({ entry, ...hit });
			}
		}
		expect(leaks).toEqual([]);
	});
});

describe("post-build imports", () => {
	it("does not load modules that need URLPattern at import time", () => {
		// post-build runs under plain Node; Node 22 has no global URLPattern.
		const needsUrlPattern = [
			"src/schemas/layout.ts",
			"src/middleware/discovery.ts",
			"src/core/layout/layout-discovery.ts",
		];
		const files = reachableFiles(join(PKG_ROOT, "src", "post-build", "index.ts"));
		expect(files.filter((file) => needsUrlPattern.includes(file))).toEqual([]);
	});
});
