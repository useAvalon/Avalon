/**
 * Isolated Island Builder
 *
 * Builds each island as a separate Vite build with fresh framework plugins.
 * This produces self-contained island files with the framework runtime inlined
 * and tree-shaken — matching Astro's approach.
 *
 * Each build:
 * 1. Loads framework plugins fresh (vite-plugin-solid, @vitejs/plugin-vue, etc.)
 * 2. Compiles from source (.tsx/.vue/.svelte)
 * 3. Outputs a single file with codeSplitting: false
 * 4. Tree-shakes aggressively — only used runtime functions remain
 *
 * Runs as a post-build step after the main Vite build.
 */

import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

export interface IslandBuildResult {
	island: string;
	success: boolean;
	size?: number;
	error?: string;
	elapsedMs?: number;
	/** Dependency chunk paths (for modulepreload hints) */
	deps?: string[];
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

/**
 * Default tree-shaking config for isolated island builds.
 *
 * manualPureFunctions is intentionally empty — framework runtime functions
 * like createSignal, createEffect, template, insert, and delegateEvents
 * have side effects that are required for hydration. Marking them as pure
 * causes the tree-shaker to strip hydration code paths and event delegation.
 */
export const DEFAULT_TREESHAKE_CONFIG: TreeshakeConfig = {
	annotations: true,
	moduleSideEffects: true,
	propertyReadSideEffects: false,
	unknownGlobalSideEffects: false,
	manualPureFunctions: [],
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

/** Framework adapter map */
const FRAMEWORK_ADAPTER_MAP: Record<string, string> = {
	solid: "@useavalon/solid/client",
	preact: "@useavalon/preact/client",
	react: "@useavalon/react/client",
	vue: "@useavalon/vue/client",
	svelte: "@useavalon/svelte/client",
};

/** Generate the wrapper code for an island. */
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
	if (!adapter) return "export {};";
	return `export { hydrate } from ${JSON.stringify(adapter)};`;
}

/** Load fresh framework plugins for a specific framework */
async function loadFrameworkPlugins(framework: string, cwd: string): Promise<any[]> {
	const plugins: any[] = [];
	const { resolve: resolvePath } = await import("node:path");
	const { existsSync: exists } = await import("node:fs");
	const { pathToFileURL } = await import("node:url");

	const pluginMap: Record<string, { pkg: string; esmEntry: string }> = {
		solid: { pkg: "vite-plugin-solid", esmEntry: "dist/esm/index.mjs" },
		vue: { pkg: "@vitejs/plugin-vue", esmEntry: "dist/index.mjs" },
		svelte: { pkg: "@sveltejs/vite-plugin-svelte", esmEntry: "src/index.js" },
	};

	const entry = pluginMap[framework];
	if (!entry) return plugins;

	try {
		let pluginFile: string | null = null;
		let dir = cwd;
		for (let i = 0; i < 8; i++) {
			const direct = resolvePath(dir, "node_modules", entry.pkg, entry.esmEntry);
			if (exists(direct)) {
				pluginFile = direct;
				break;
			}
			for (const intName of ["solid", "vue", "svelte", "preact", "react", "lit"]) {
				const intPath = resolvePath(
					dir,
					"packages",
					"integrations",
					intName,
					"node_modules",
					entry.pkg,
					entry.esmEntry,
				);
				if (exists(intPath)) {
					pluginFile = intPath;
					break;
				}
			}
			if (pluginFile) break;
			dir = resolvePath(dir, "..");
		}
		if (!pluginFile) throw new Error(`Cannot find package '${entry.pkg}'`);
		const mod = await import(pathToFileURL(pluginFile).href);

		switch (framework) {
			case "solid":
				plugins.push((mod.default ?? mod)({ ssr: false, hot: false }));
				break;
			case "vue":
				plugins.push((mod.default ?? mod)());
				break;
			case "svelte":
				plugins.push((mod.svelte ?? mod.default)());
				break;
		}
	} catch (err) {
		console.warn(
			`  ⚠ Could not load ${framework} plugin: ${err instanceof Error ? err.message : err}`,
		);
	}
	return plugins;
}

/** Create a preact-compat resolver plugin for isolated builds */
async function createPreactCompatPlugin(cwd: string): Promise<any> {
	const { createRequire } = await import("node:module");
	const { existsSync: fileExists } = await import("node:fs");
	const req = createRequire(`${cwd}/package.json`);
	const resolveMjs = (id: string) => {
		try {
			const p = req.resolve(id);
			return p.endsWith(".js")
				? fileExists(p.replace(/\.js$/, ".mjs"))
					? p.replace(/\.js$/, ".mjs")
					: p
				: p;
		} catch {
			return null;
		}
	};
	const aliases: Record<string, string | null> = {
		preact: resolveMjs("preact"),
		"preact/hooks": resolveMjs("preact/hooks"),
		"preact/compat": resolveMjs("preact/compat"),
		"preact/compat/client": resolveMjs("preact/compat/client"),
		"preact/compat/server": resolveMjs("preact/compat/server"),
		"preact/jsx-runtime": resolveMjs("preact/jsx-runtime"),
		react: resolveMjs("preact/compat"),
		"react/jsx-runtime": resolveMjs("preact/jsx-runtime"),
		"react/jsx-dev-runtime": resolveMjs("preact/jsx-runtime"),
		"react-dom": resolveMjs("preact/compat"),
		"react-dom/client": resolveMjs("preact/compat/client"),
		"react-dom/server": resolveMjs("preact/compat/server"),
	};
	return {
		name: "avalon:isolated-preact-compat",
		enforce: "pre",
		resolveId(id: string) {
			return aliases[id] ?? null;
		},
	};
}

/**
 * Build all islands in isolation using Vite.
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
	const { build: viteBuild } = await import("vite");

	console.log(`🏝️  Building ${islands.size} islands in isolation...`);
	const startTime = performance.now();
	const treeshakeConfig = options?.treeshake
		? mergeTreeshakeConfig(DEFAULT_TREESHAKE_CONFIG, options.treeshake)
		: DEFAULT_TREESHAKE_CONFIG;
	const results: IslandBuildResult[] = [];

	for (const [, island] of islands) {
		const { filePath, bundleKey, framework } = island;
		const outputFile = `islands/${bundleKey}.js`;

		if (framework === "qwik" || framework === "lit") {
			results.push({ island: outputFile, success: true });
			continue;
		}

		const wrapperCode = generateWrapperCode(filePath, framework);
		const VIRTUAL_ENTRY = "\0isolated-island-entry";
		const VIRTUAL_LOADER = "\0virtual:avalon/integration-loader";

		try {
			const frameworkPlugins = await loadFrameworkPlugins(framework, cwd);
			const preactCompat = await createPreactCompatPlugin(cwd);
			const islandStart = performance.now();

			const buildOutput = await viteBuild({
				configFile: false,
				root: cwd,
				logLevel: "silent",
				plugins: [
					{
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
					},
					preactCompat,
					...frameworkPlugins,
				],
				build: {
					write: true,
					outDir: resolve(cwd, distDir),
					emptyOutDir: false,
					minify: "oxc",
					target: "es2020",
					rollupOptions: {
						input: VIRTUAL_ENTRY,
						output: { format: "es", entryFileNames: outputFile },
						preserveEntrySignatures: "exports-only",
						treeshake: treeshakeConfig,
					},
				},
				resolve: { alias: resolveAliases },
				define: {
					...defineValues,
					__DEV__: "false",
					__PROD__: "true",
					"process.env.NODE_ENV": '"production"',
				},
			});

			const elapsedMs = performance.now() - islandStart;
			const outPath = resolve(cwd, distDir, outputFile);
			const size = existsSync(outPath) ? statSync(outPath).size : 0;

			// Extract dependency chunks from the build output for modulepreload hints
			const deps: string[] = [];
			const outputs = Array.isArray(buildOutput) ? buildOutput : [buildOutput];
			for (const out of outputs) {
				if (out && "output" in out) {
					for (const chunk of out.output) {
						if (chunk.type === "chunk" && chunk.fileName !== outputFile) {
							deps.push(`/${chunk.fileName}`);
						}
					}
				}
			}

			results.push({ island: outputFile, success: true, size, elapsedMs, deps });
			console.log(`  ✅ ${bundleKey} (${framework}): ${(size / 1024).toFixed(1)} KiB`);
			if (elapsedMs > 2000)
				console.warn(`  ⚠ ${bundleKey} (${framework}): build took ${elapsedMs.toFixed(0)}ms (>2s)`);
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

	// Write island dependency manifest for modulepreload hints
	const depsManifest: Record<string, string[]> = {};
	for (const result of results) {
		if (result.success && result.deps && result.deps.length > 0) {
			// Key by the island's public path (e.g., /islands/app/.../Counter.preact.js)
			depsManifest[`/${result.island}`] = result.deps;
		}
	}
	if (Object.keys(depsManifest).length > 0) {
		const manifestPath = resolve(cwd, distDir, "island-deps.json");
		const { writeFileSync } = await import("node:fs");
		writeFileSync(manifestPath, JSON.stringify(depsManifest));
	}

	return results;
}
