import { describe, it, expect } from "vitest";
import {
	isIntegrationLoaderModule,
	isFrameworkRuntimeModule,
	isIslandModule,
	shouldInlineIntoIsland,
	findIslandImporter,
	islandCodeSplittingPlugin,
	detectChunkFramework,
	findSmallIslandChunks,
	groupChunksByFramework,
	buildConsolidatedChunk,
	consolidateIslandChunks,
	DEFAULT_CHUNK_SIZE_THRESHOLD,
	type BundleChunk,
} from "../island-code-splitting.ts";
import type { ResolvedAvalonConfig } from "../../vite-plugin/types.ts";

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

function mockModuleGraph(graph: Record<string, string[]>) {
	return (id: string) => {
		if (id in graph) {
			return { importers: graph[id] };
		}
		return null;
	};
}

function makeChunk(fileName: string, code: string, moduleIds: string[] = []): BundleChunk {
	return { type: "chunk", fileName, code, moduleIds };
}

function makeBundle(chunks: BundleChunk[]): Record<string, BundleChunk | { type: string }> {
	const bundle: Record<string, BundleChunk | { type: string }> = {};
	for (const chunk of chunks) {
		bundle[chunk.fileName] = chunk;
	}
	return bundle;
}

describe("isIntegrationLoaderModule", () => {
	it("matches resolved virtual module ID", () => {
		expect(isIntegrationLoaderModule("\0virtual:avalon/integration-loader")).toBe(true);
	});
	it("matches unresolved virtual module ID", () => {
		expect(isIntegrationLoaderModule("virtual:avalon/integration-loader")).toBe(true);
	});
	it("rejects unrelated modules", () => {
		expect(isIntegrationLoaderModule("solid-js/web")).toBe(false);
		expect(isIntegrationLoaderModule("/islands/Counter.tsx")).toBe(false);
	});
});

describe("isFrameworkRuntimeModule", () => {
	it("matches solid-js", () => {
		expect(isFrameworkRuntimeModule("/node_modules/solid-js/dist/solid.js")).toBe(true);
	});
	it("matches solid-js/web", () => {
		expect(isFrameworkRuntimeModule("/node_modules/solid-js/web/dist/web.js")).toBe(true);
	});
	it("matches bare solid-js", () => {
		expect(isFrameworkRuntimeModule("solid-js")).toBe(true);
	});
	it("matches preact", () => {
		expect(isFrameworkRuntimeModule("/node_modules/preact/dist/preact.js")).toBe(true);
	});
	it("matches react", () => {
		expect(isFrameworkRuntimeModule("/node_modules/react/dist/react.js")).toBe(true);
	});
	it("matches vue", () => {
		expect(isFrameworkRuntimeModule("/node_modules/vue/dist/vue.js")).toBe(true);
	});
	it("matches svelte", () => {
		expect(isFrameworkRuntimeModule("/node_modules/svelte/dist/svelte.js")).toBe(true);
	});
	it("matches lit", () => {
		expect(isFrameworkRuntimeModule("/node_modules/lit/dist/lit.js")).toBe(true);
	});
	it("matches qwik", () => {
		expect(isFrameworkRuntimeModule("/node_modules/@builder.io/qwik/dist/qwik.js")).toBe(true);
	});
	it("rejects non-framework modules", () => {
		expect(isFrameworkRuntimeModule("/node_modules/lodash/dist/lodash.js")).toBe(false);
		expect(isFrameworkRuntimeModule("/islands/Counter.tsx")).toBe(false);
	});
});

describe("isIslandModule", () => {
	it("matches island paths", () => {
		expect(isIslandModule("/src/islands/Counter.tsx")).toBe(true);
	});
	it("matches island entry virtual modules", () => {
		expect(isIslandModule("\0avalon-island-entry:/path/to/Counter.tsx")).toBe(true);
	});
	it("rejects non-island modules", () => {
		expect(isIslandModule("/src/pages/index.tsx")).toBe(false);
	});
});

describe("shouldInlineIntoIsland", () => {
	it("returns true for integration loader", () => {
		expect(shouldInlineIntoIsland("\0virtual:avalon/integration-loader")).toBe(true);
		expect(shouldInlineIntoIsland("virtual:avalon/integration-loader")).toBe(true);
	});
	it("returns true for all framework runtimes", () => {
		expect(shouldInlineIntoIsland("/node_modules/solid-js/dist/solid.js")).toBe(true);
		expect(shouldInlineIntoIsland("solid-js")).toBe(true);
		expect(shouldInlineIntoIsland("/node_modules/preact/dist/preact.js")).toBe(true);
		expect(shouldInlineIntoIsland("/node_modules/vue/dist/vue.js")).toBe(true);
		expect(shouldInlineIntoIsland("/node_modules/svelte/dist/svelte.js")).toBe(true);
		expect(shouldInlineIntoIsland("/node_modules/lit/dist/lit.js")).toBe(true);
	});
	it("returns false for island components", () => {
		expect(shouldInlineIntoIsland("/src/islands/Counter.tsx")).toBe(false);
	});
	it("returns false for unrelated modules", () => {
		expect(shouldInlineIntoIsland("/src/pages/index.tsx")).toBe(false);
		expect(shouldInlineIntoIsland("/node_modules/lodash/dist/lodash.js")).toBe(false);
	});
});

describe("findIslandImporter", () => {
	it("finds island entry directly", () => {
		const g = mockModuleGraph({
			"/node_modules/solid-js/web/dist/web.js": ["\0avalon-island-entry:/src/islands/Counter.tsx"],
		});
		expect(findIslandImporter("/node_modules/solid-js/web/dist/web.js", g)).toBe("islands/Counter");
	});
	it("finds island entry through intermediates", () => {
		const g = mockModuleGraph({
			"/node_modules/solid-js/web/dist/web.js": ["\0virtual:avalon/integration-loader"],
			"\0virtual:avalon/integration-loader": ["\0avalon-island-entry:/src/islands/TodoList.tsx"],
		});
		expect(findIslandImporter("/node_modules/solid-js/web/dist/web.js", g)).toBe(
			"islands/TodoList",
		);
	});
	it("returns undefined when no island importer", () => {
		const g = mockModuleGraph({ "/node_modules/solid-js/dist/solid.js": ["/src/pages/index.tsx"] });
		expect(findIslandImporter("/node_modules/solid-js/dist/solid.js", g)).toBeUndefined();
	});
	it("returns undefined for unknown modules", () => {
		expect(findIslandImporter("/x.js", mockModuleGraph({}))).toBeUndefined();
	});
	it("handles circular imports", () => {
		expect(findIslandImporter("a", mockModuleGraph({ a: ["b"], b: ["a"] }))).toBeUndefined();
	});
	it("finds island from islands directory", () => {
		const g = mockModuleGraph({
			"/node_modules/solid-js/web/dist/web.js": ["/src/islands/Counter.tsx"],
		});
		expect(findIslandImporter("/node_modules/solid-js/web/dist/web.js", g)).toBe("islands/Counter");
	});
});

describe("islandCodeSplittingPlugin", () => {
	it("has correct name", () => {
		expect(islandCodeSplittingPlugin(makeConfig()).name).toBe("avalon:island-code-splitting");
	});
	it("enforces post", () => {
		expect(islandCodeSplittingPlugin(makeConfig()).enforce).toBe("post");
	});
	it("returns treeshake config for build", () => {
		const r = (islandCodeSplittingPlugin(makeConfig()).config as Function)(
			{},
			{ command: "build" },
		);
		expect(r.build.rollupOptions.treeshake).toBeDefined();
		expect(r.build.rollupOptions.treeshake.moduleSideEffects).toBeTypeOf("function");
	});
	it("returns nothing for serve", () => {
		expect(
			(islandCodeSplittingPlugin(makeConfig()).config as Function)({}, { command: "serve" }),
		).toBeUndefined();
	});
	it("configEnvironment is a no-op (reserved for future)", () => {
		const plugin = islandCodeSplittingPlugin(makeConfig());
		(plugin.config as Function)({}, { command: "build" });
		expect((plugin as any).configEnvironment("client")).toBeUndefined();
		expect((plugin as any).configEnvironment("ssr")).toBeUndefined();
	});
	it("accepts custom chunkSizeThreshold", () => {
		expect(
			islandCodeSplittingPlugin(makeConfig(), undefined, { chunkSizeThreshold: 2048 }).name,
		).toBe("avalon:island-code-splitting");
	});
	it("has generateBundle hook", () => {
		expect(islandCodeSplittingPlugin(makeConfig()).generateBundle).toBeTypeOf("function");
	});
});

describe("detectChunkFramework", () => {
	it("detects solid", () => {
		expect(detectChunkFramework(["/node_modules/solid-js/dist/solid.js"])).toBe("solid");
	});
	it("detects preact", () => {
		expect(detectChunkFramework(["/node_modules/preact/dist/preact.js"])).toBe("preact");
	});
	it("detects vue", () => {
		expect(detectChunkFramework(["/node_modules/vue/dist/vue.js"])).toBe("vue");
	});
	it("returns unknown for unrecognized", () => {
		expect(detectChunkFramework(["/src/islands/Counter.tsx"])).toBe("unknown");
	});
	it("returns unknown for empty", () => {
		expect(detectChunkFramework([])).toBe("unknown");
	});
});

describe("findSmallIslandChunks", () => {
	it("finds chunks below threshold", () => {
		expect(
			findSmallIslandChunks(
				makeBundle([
					makeChunk("islands/A.js", "x".repeat(100)),
					makeChunk("islands/B.js", "y".repeat(200)),
				]),
				500,
			),
		).toHaveLength(2);
	});
	it("excludes chunks above threshold", () => {
		expect(
			findSmallIslandChunks(
				makeBundle([
					makeChunk("islands/A.js", "x".repeat(100)),
					makeChunk("islands/Big.js", "y".repeat(5000)),
				]),
				500,
			),
		).toHaveLength(1);
	});
	it("excludes non-island chunks", () => {
		expect(
			findSmallIslandChunks(
				makeBundle([
					makeChunk("vendor/lib.js", "x".repeat(100)),
					makeChunk("islands/A.js", "y".repeat(100)),
				]),
				500,
			),
		).toHaveLength(1);
	});
	it("excludes shared chunks", () => {
		expect(
			findSmallIslandChunks(
				makeBundle([
					makeChunk("islands/shared-solid.js", "x".repeat(100)),
					makeChunk("islands/A.js", "y".repeat(100)),
				]),
				500,
			),
		).toHaveLength(1);
	});
	it("returns empty when none small", () => {
		expect(
			findSmallIslandChunks(makeBundle([makeChunk("islands/Big.js", "y".repeat(5000))]), 500),
		).toHaveLength(0);
	});
});

describe("groupChunksByFramework", () => {
	it("groups by framework", () => {
		const g = groupChunksByFramework([
			makeChunk("islands/A.js", "a", ["/node_modules/solid-js/dist/solid.js"]),
			makeChunk("islands/B.js", "b", ["/node_modules/solid-js/web/dist/web.js"]),
			makeChunk("islands/C.js", "c", ["/node_modules/vue/dist/vue.js"]),
		]);
		expect(g.get("solid")).toHaveLength(2);
		expect(g.get("vue")).toHaveLength(1);
	});
	it("groups unknown together", () => {
		expect(
			groupChunksByFramework([
				makeChunk("islands/A.js", "a", ["/src/A.tsx"]),
				makeChunk("islands/B.js", "b", ["/src/B.tsx"]),
			]).get("unknown"),
		).toHaveLength(2);
	});
});

describe("buildConsolidatedChunk", () => {
	it("concatenates with markers", () => {
		const r = buildConsolidatedChunk([
			makeChunk("islands/A.js", "const a = 1;", ["a"]),
			makeChunk("islands/B.js", "const b = 2;", ["b"]),
		]);
		expect(r.code).toContain("// --- islands/A.js ---");
		expect(r.code).toContain("const a = 1;");
	});
	it("merges module IDs", () => {
		expect(
			buildConsolidatedChunk([
				makeChunk("islands/A.js", "", ["a", "b"]),
				makeChunk("islands/B.js", "", ["c"]),
			]).moduleIds,
		).toEqual(["a", "b", "c"]);
	});
});

describe("consolidateIslandChunks", () => {
	it("merges small same-framework chunks", () => {
		const b = makeBundle([
			makeChunk("islands/A.js", "x".repeat(100), ["/node_modules/solid-js/dist/solid.js"]),
			makeChunk("islands/B.js", "y".repeat(100), ["/node_modules/solid-js/web/dist/web.js"]),
		]);
		const r = consolidateIslandChunks(b, 500);
		expect(r.size).toBe(2);
		expect(r.get("islands/A.js")).toBe("islands/shared-solid.js");
		expect(b["islands/shared-solid.js"]).toBeDefined();
	});
	it("skips single small chunk", () => {
		expect(
			consolidateIslandChunks(
				makeBundle([
					makeChunk("islands/A.js", "x".repeat(100), ["/node_modules/solid-js/dist/solid.js"]),
				]),
				500,
			).size,
		).toBe(0);
	});
	it("skips single per framework", () => {
		const b = makeBundle([
			makeChunk("islands/A.js", "x".repeat(100), ["/node_modules/solid-js/dist/solid.js"]),
			makeChunk("islands/B.js", "y".repeat(100), ["/node_modules/vue/dist/vue.js"]),
		]);
		expect(consolidateIslandChunks(b, 500).size).toBe(0);
	});
	it("leaves large chunks", () => {
		const b = makeBundle([
			makeChunk("islands/A.js", "x".repeat(100), ["/node_modules/solid-js/dist/solid.js"]),
			makeChunk("islands/B.js", "y".repeat(100), ["/node_modules/solid-js/web/dist/web.js"]),
			makeChunk("islands/Big.js", "z".repeat(5000), ["/node_modules/solid-js/dist/solid.js"]),
		]);
		consolidateIslandChunks(b, 500);
		expect(b["islands/Big.js"]).toBeDefined();
	});
	it("uses DEFAULT_CHUNK_SIZE_THRESHOLD", () => {
		const b = makeBundle([
			makeChunk("islands/A.js", "x".repeat(5000), ["/node_modules/solid-js/dist/solid.js"]),
			makeChunk("islands/B.js", "y".repeat(5000), ["/node_modules/solid-js/dist/solid.js"]),
		]);
		expect(consolidateIslandChunks(b).size).toBe(0);
		expect(DEFAULT_CHUNK_SIZE_THRESHOLD).toBe(4096);
	});
	it("creates separate shared bundles per framework", () => {
		const b = makeBundle([
			makeChunk("islands/A.js", "a", ["/node_modules/solid-js/dist/solid.js"]),
			makeChunk("islands/B.js", "b", ["/node_modules/solid-js/dist/solid.js"]),
			makeChunk("islands/C.js", "c", ["/node_modules/vue/dist/vue.js"]),
			makeChunk("islands/D.js", "d", ["/node_modules/vue/dist/vue.js"]),
		]);
		const r = consolidateIslandChunks(b, 500);
		expect(r.get("islands/A.js")).toBe("islands/shared-solid.js");
		expect(r.get("islands/C.js")).toBe("islands/shared-vue.js");
	});
});
