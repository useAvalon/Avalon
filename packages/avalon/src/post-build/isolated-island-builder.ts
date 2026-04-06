/**
 * Isolated Island Builder
 *
 * Builds each island as a separate tsdown build with fresh framework unplugins.
 * This produces self-contained island files with the framework runtime inlined
 * and tree-shaken — matching Astro's approach.
 *
 * Each build:
 * 1. Loads framework unplugins fresh (unplugin-solid, unplugin-vue, etc.)
 * 2. Compiles from source (.tsx/.vue/.svelte)
 * 3. Outputs a single file with format: "esm"
 * 4. Tree-shakes aggressively — only used runtime functions remain
 *
 * Runs as a post-build step after the main Vite build.
 */

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { build as tsdownBuild } from "tsdown";

export interface IslandBuildResult {
	island: string;
	success: boolean;
	size?: number;
	error?: string;
	elapsedMs?: number;
}

interface IslandSource {
	filePath: string;
	bundleKey: string;
	framework: string;
}

/** Tree-shaking configuration for isolated island builds */
export interface TreeshakeConfig {
	annotations: boolean;
	moduleSideEffects: boolean;
	propertyReadSideEffects: false | "always";
	unknownGlobalSideEffects: boolean;
	manualPureFunctions: string[];
}

/** Default tree-shaking config with aggressive settings and Solid runtime pure functions */
export const DEFAULT_TREESHAKE_CONFIG: TreeshakeConfig = {
	annotations: true,
	moduleSideEffects: false,
	propertyReadSideEffects: false,
	unknownGlobalSideEffects: false,
	manualPureFunctions: [
		"createSignal",
		"createEffect",
		"createMemo",
		"createComponent",
		"template",
		"insert",
		"delegateEvents",
		"setAttribute",
		"effect",
		"memo",
		"spread",
		"mergeProps",
		"splitProps",
		"className",
		"classList",
		"style",
		"addEventListener",
	],
};

/**
 * Deep-merge treeshake overrides into defaults.
 * Scalar fields from overrides replace defaults.
 * `manualPureFunctions` is concatenated (not replaced).
 */
export function mergeTreeshakeConfig(
	defaults: TreeshakeConfig,
	overrides: Partial<TreeshakeConfig>,
): TreeshakeConfig {
	return {
		annotations: overrides.annotations ?? defaults.annotations,
		moduleSideEffects: overrides.moduleSideEffects ?? defaults.moduleSideEffects,
		propertyReadSideEffects: overrides.propertyReadSideEffects ?? defaults.propertyReadSideEffects,
		unknownGlobalSideEffects:
			overrides.unknownGlobalSideEffects ?? defaults.unknownGlobalSideEffects,
		manualPureFunctions: [
			...defaults.manualPureFunctions,
			...(overrides.manualPureFunctions ?? []),
		],
	};
}

/** Options for the isolated island builder */
export interface IsolatedIslandBuilderOptions {
	treeshake?: Partial<TreeshakeConfig>;
}

/**
 * Load the appropriate unplugin for a given framework.
 * tsdown supports unplugins natively — these replace the old vite-plugin-* equivalents.
 * Returns null for frameworks where tsdown handles JSX natively (Preact, React).
 * If the unplugin package is not installed, logs a warning and returns null.
 */

/** Frameworks that require an unplugin to compile — if the unplugin is missing, the island cannot be built */
const FRAMEWORKS_REQUIRING_UNPLUGIN = new Set(["solid", "vue", "svelte"]);

export async function loadFrameworkUnplugin(framework: string): Promise<any | null> {
	switch (framework) {
		case "solid":
			try {
				return (await import("unplugin-solid")).default.rolldown({ ssr: false });
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.warn(`⚠ Could not load solid unplugin: ${msg}`);
				return null;
			}
		case "vue":
			try {
				return (await import("unplugin-vue")).default.rolldown();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.warn(`⚠ Could not load vue unplugin: ${msg}`);
				return null;
			}
		case "svelte":
			try {
				return (await import("rollup-plugin-svelte")).default();
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				console.warn(`⚠ Could not load svelte plugin: ${msg}`);
				return null;
			}
		default:
			return null;
	}
}

/** Detect framework from file path */
function _detectFramework(filePath: string): string {
	if (filePath.includes(".solid.")) return "solid";
	if (filePath.includes(".preact.")) return "preact";
	if (filePath.includes(".react.")) return "react";
	if (filePath.includes(".vue.") || filePath.endsWith(".vue")) return "vue";
	if (filePath.includes(".svelte.") || filePath.endsWith(".svelte")) return "svelte";
	if (filePath.includes(".lit.")) return "lit";
	if (filePath.includes(".qwik.")) return "qwik";
	// Default .tsx/.jsx to preact
	if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) return "preact";
	return "unknown";
}

/** Framework adapter map — maps framework name to its client adapter package */
const FRAMEWORK_ADAPTER_MAP: Record<string, string> = {
	solid: "@useavalon/solid/client",
	preact: "@useavalon/preact/client",
	react: "@useavalon/react/client",
	vue: "@useavalon/vue/client",
	svelte: "@useavalon/svelte/client",
};

/**
 * Generate the wrapper code for an island.
 *
 * For hydration frameworks (solid, preact, react, vue, svelte) the output is exactly 5 lines:
 *   1. Default import of the component
 *   2. `var Component = __C;`
 *   3. Named re-export of `Component` and `default`
 *   4. `globalThis.__avalonIsland` assignment
 *   5. `__hydrateIsland` re-export from the framework adapter
 *
 * Qwik uses a different export shape (re-export all + `_hW`).
 * Lit islands are skipped by the isolated builder and never reach this function.
 */
export function generateWrapperCode(filePath: string, framework: string): string {
	const escaped = JSON.stringify(filePath);

	if (framework === "qwik") {
		return [`export * from ${escaped};`, `export { _hW } from "@builder.io/qwik";`].join("\n");
	}

	const adapter = FRAMEWORK_ADAPTER_MAP[framework];
	const lines = [
		`import __C from ${escaped};`,
		`var Component = __C;`,
		`export { Component as default, Component };`,
		`if(typeof globalThis<"u")globalThis.__avalonIsland=Component;`,
	];

	if (adapter) {
		lines.push(`export { hydrate as __hydrateIsland } from ${JSON.stringify(adapter)};`);
	}

	return lines.join("\n");
}

/** Generate the integration loader module for a specific framework */
export function generateIntegrationLoaderForFramework(framework: string): string {
	const adapter = FRAMEWORK_ADAPTER_MAP[framework];
	if (!adapter) {
		return "export {};";
	}

	return `export { hydrate } from ${JSON.stringify(adapter)};`;
}

/**
 * Build all islands in isolation.
 *
 * @param cwd - Project root directory
 * @param distDir - Build output directory (e.g., "dist")
 * @param islands - Map of discovered islands (filePath → bundleKey)
 * @param resolveAliases - Resolve aliases from the main Vite config
 * @param defineValues - Define replacements from the main Vite config
 * @param options - Optional builder configuration (treeshake overrides, etc.)
 */
export async function buildIsolatedIslands(
	cwd: string,
	distDir: string,
	islands: Map<string, IslandSource>,
	resolveAliases: any[],
	defineValues: Record<string, unknown>,
	options?: IsolatedIslandBuilderOptions,
): Promise<IslandBuildResult[]> {
	if (islands.size === 0) return [];

	console.log(`🏝️  Building ${islands.size} islands in isolation...`);
	const startTime = performance.now();

	const treeshakeConfig = options?.treeshake
		? mergeTreeshakeConfig(DEFAULT_TREESHAKE_CONFIG, options.treeshake)
		: DEFAULT_TREESHAKE_CONFIG;

	const results: IslandBuildResult[] = [];

	for (const [, island] of islands) {
		const { filePath, bundleKey, framework } = island;
		const outputFile = `islands/${bundleKey}.js`;

		// Skip Qwik — uses resumability, not hydration
		// Skip Lit — needs separate hydration support chunk loaded before component
		if (framework === "qwik" || framework === "lit") {
			results.push({ island: outputFile, success: true });
			continue;
		}

		const wrapperCode = generateWrapperCode(filePath, framework);
		const VIRTUAL_ENTRY = "\0isolated-island-entry";
		const VIRTUAL_LOADER = "\0virtual:avalon/integration-loader";

		try {
			// Load fresh framework unplugin
			const frameworkUnplugin = await loadFrameworkUnplugin(framework);

			// If the framework requires an unplugin and it's missing, skip the island
			if (FRAMEWORKS_REQUIRING_UNPLUGIN.has(framework) && frameworkUnplugin == null) {
				console.warn(`  ⚠ Skipping ${bundleKey}: ${framework} unplugin is not installed`);
				results.push({ island: outputFile, success: true });
				continue;
			}

			// Virtual module plugin for the island wrapper and integration loader
			const virtualPlugin = {
				name: "avalon:isolated-island-virtual",
				resolveId(id: string) {
					if (id === VIRTUAL_ENTRY) return id;
					if (id === "virtual:avalon/integration-loader" || id === VIRTUAL_LOADER)
						return VIRTUAL_LOADER;
					return null;
				},
				load(id: string) {
					if (id === VIRTUAL_ENTRY) return wrapperCode;
					if (id === VIRTUAL_LOADER) return generateIntegrationLoaderForFramework(framework);
					return null;
				},
			};

			// Plugin to stub out CSS imports — Rolldown no longer bundles CSS,
			// and island builds only need the JS output.
			const cssStubPlugin = {
				name: "avalon:css-stub",
				resolveId(id: string) {
					if (id.endsWith(".css") || id.endsWith(".scss") || id.endsWith(".less")) {
						return { id: "\0css-stub", external: false };
					}
					return null;
				},
				load(id: string) {
					if (id === "\0css-stub") return "export default '';";
					return null;
				},
			};

			const islandStart = performance.now();

			await tsdownBuild({
				entry: { [bundleKey]: VIRTUAL_ENTRY },
				outDir: resolve(cwd, distDir, "islands"),
				format: "esm",
				target: "es2020",
				minify: true,
				clean: false,
				dts: false,
				treeshake: true,
				report: false,
				define: {
					__DEV__: "false",
					__PROD__: "true",
					"process.env.NODE_ENV": '"production"',
				},
				inputOptions: (opts) => {
					opts.treeshake = treeshakeConfig;
					const jsxConfig =
						framework === "preact"
							? { jsx: "react-jsx" as const, jsxImportSource: "preact" }
							: framework === "react"
								? { jsx: "react-jsx" as const }
								: {};
					if (Object.keys(jsxConfig).length > 0) {
						opts.transform = { ...opts.transform, ...jsxConfig };
					}
					return opts;
				},
				plugins: [cssStubPlugin, virtualPlugin, frameworkUnplugin].filter(Boolean),
			});

			const elapsedMs = performance.now() - islandStart;

			// Check output size
			const outPath = resolve(cwd, distDir, outputFile);
			const size = existsSync(outPath) ? statSync(outPath).size : 0;
			results.push({ island: outputFile, success: true, size, elapsedMs });

			console.log(`  ✅ ${bundleKey} (${framework}): ${(size / 1024).toFixed(1)} KiB`);

			if (elapsedMs > 2000) {
				console.warn(`  ⚠ ${bundleKey} (${framework}): build took ${elapsedMs.toFixed(0)}ms (>2s)`);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  ❌ ${bundleKey} (${framework}): ${msg}`);
			results.push({ island: outputFile, success: false, error: msg });
		}
	}

	const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
	const succeeded = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success).length;
	console.log(`🏝️  Done in ${elapsed}s: ${succeeded} built${failed ? `, ${failed} failed` : ""}`);

	return results;
}
