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

interface IslandBuildResult {
	island: string;
	success: boolean;
	size?: number;
	error?: string;
}

interface IslandSource {
	filePath: string;
	bundleKey: string;
	framework: string;
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

/** Generate the wrapper code for an island */
function generateWrapperCode(filePath: string, framework: string): string {
	const escaped = JSON.stringify(filePath);

	if (framework === "qwik") {
		return [`export * from ${escaped};`, `export { _hW } from "@builder.io/qwik";`].join("\n");
	}

	const lines: string[] = [];

	// Lit hydration support must load before the component
	if (framework === "lit") {
		lines.push(`import "@useavalon/lit/client";`);
	}

	lines.push(
		`import __C from ${escaped};`,
		`var Component = __C;`,
		`export { Component as default, Component };`,
		`if(typeof globalThis<"u")globalThis.__avalonIsland=Component;`,
	);

	// Export hydrate directly from the framework adapter
	const adapterMap: Record<string, string> = {
		solid: "@useavalon/solid/client",
		preact: "@useavalon/preact/client",
		react: "@useavalon/react/client",
		vue: "@useavalon/vue/client",
		svelte: "@useavalon/svelte/client",
		lit: "@useavalon/lit/client",
	};

	if (adapterMap[framework]) {
		lines.push(
			`export { hydrate as __hydrateIsland } from ${JSON.stringify(adapterMap[framework])};`,
		);
	}

	return lines.join("\n");
}

/** Load fresh framework plugins for a specific framework */
async function loadFrameworkPlugins(framework: string, cwd: string): Promise<any[]> {
	const plugins: any[] = [];
	const { resolve: resolvePath } = await import("node:path");

	// Map framework → plugin package → integration package that declares it as a dep
	const pluginMap: Record<string, { pkg: string; integration: string; esmEntry?: string }> = {
		solid: {
			pkg: "vite-plugin-solid",
			integration: "packages/integrations/solid",
			esmEntry: "dist/esm/index.mjs",
		},
		vue: {
			pkg: "@vitejs/plugin-vue",
			integration: "packages/integrations/vue",
			esmEntry: "dist/index.mjs",
		},
		svelte: {
			pkg: "@sveltejs/vite-plugin-svelte",
			integration: "packages/integrations/svelte",
			esmEntry: "src/index.js",
		},
	};

	const entry = pluginMap[framework];
	if (!entry) return plugins;

	try {
		// Resolve the plugin from the integration package's node_modules
		const integrationDir = resolvePath(cwd, "..", entry.integration);
		const pluginDir = resolvePath(integrationDir, "node_modules", entry.pkg);
		// Use the ESM entry if specified, otherwise try the package root
		const importTarget = entry.esmEntry ? resolvePath(pluginDir, entry.esmEntry) : pluginDir;
		// Convert to file:// URL for dynamic import compatibility
		const { pathToFileURL } = await import("node:url");
		const mod = await import(pathToFileURL(importTarget).href);

		switch (framework) {
			case "solid": {
				const solid = mod.default ?? mod;
				plugins.push(solid({ ssr: false, hot: false }));
				break;
			}
			case "vue": {
				const vue = mod.default ?? mod;
				plugins.push(vue());
				break;
			}
			case "svelte": {
				const svelte = mod.svelte ?? mod.default;
				plugins.push(svelte({ compilerOptions: { hydratable: true } }));
				break;
			}
			// Preact, React, Lit don't need special plugins for client builds
			// (they use JSX which Vite/Rolldown handles natively)
		}
	} catch (err) {
		// Plugin not installed — skip
		console.warn(
			`  ⚠ Could not load ${framework} plugin: ${err instanceof Error ? err.message : err}`,
		);
	}

	return plugins;
}

/** Generate the integration loader module for a specific framework */
function generateIntegrationLoaderForFramework(framework: string): string {
	const adapterMap: Record<string, string> = {
		solid: "@useavalon/solid/client",
		preact: "@useavalon/preact/client",
		react: "@useavalon/react/client",
		vue: "@useavalon/vue/client",
		svelte: "@useavalon/svelte/client",
		lit: "@useavalon/lit/client",
	};

	const adapter = adapterMap[framework];
	if (!adapter) {
		return `export async function loadIntegrationModule() { return {}; }`;
	}

	return [
		`import { hydrate } from ${JSON.stringify(adapter)};`,
		`export async function loadIntegrationModule() { return { hydrate }; }`,
	].join("\n");
}

/** Create a preact-compat resolver plugin for isolated builds */
async function createPreactCompatPlugin(cwd: string): Promise<any> {
	const { createRequire } = await import("node:module");
	const req = createRequire(`${cwd}/package.json`);
	const resolveMjs = (id: string) => {
		try {
			return req.resolve(id).replace(/\.js$/, ".mjs");
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
			const resolved = aliases[id];
			if (resolved) return resolved;
			return null;
		},
	};
}

/**
 * Build all islands in isolation.
 *
 * @param cwd - Project root directory
 * @param distDir - Build output directory (e.g., "dist")
 * @param islands - Map of discovered islands (filePath → bundleKey)
 * @param resolveAliases - Resolve aliases from the main Vite config
 * @param defineValues - Define replacements from the main Vite config
 */
export async function buildIsolatedIslands(
	cwd: string,
	distDir: string,
	islands: Map<string, IslandSource>,
	resolveAliases: any[],
	defineValues: Record<string, unknown>,
): Promise<IslandBuildResult[]> {
	if (islands.size === 0) return [];

	const { build: viteBuild } = await import("vite");

	console.log(`🏝️  Building ${islands.size} islands in isolation...`);
	const startTime = performance.now();

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
			// Load fresh framework plugins
			const frameworkPlugins = await loadFrameworkPlugins(framework, cwd);
			const preactCompat = await createPreactCompatPlugin(cwd);

			await viteBuild({
				configFile: false,
				root: cwd,
				logLevel: "silent",
				plugins: [
					// Virtual modules for the island wrapper and integration loader
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
					// Preact-compat resolver — ensures react→preact aliases work
					// even if the main config's RegExp aliases don't transfer cleanly.
					preactCompat,
					// Framework-specific plugins (loaded fresh)
					...frameworkPlugins,
				],
				build: {
					write: true,
					outDir: resolve(cwd, distDir),
					emptyOutDir: false,
					minify: "esbuild",
					target: "es2020",
					rollupOptions: {
						input: VIRTUAL_ENTRY,
						output: {
							format: "es",
							entryFileNames: outputFile,
						},
						// Preserve entry exports so __hydrateIsland and default are available
						preserveEntrySignatures: "exports-only",
					},
				},
				resolve: {
					alias: resolveAliases,
				},
				define: {
					...defineValues,
					__DEV__: "false",
					__PROD__: "true",
					"process.env.NODE_ENV": '"production"',
				},
			});

			// Check output size
			const outPath = resolve(cwd, distDir, outputFile);
			const size = existsSync(outPath) ? statSync(outPath).size : 0;
			results.push({ island: outputFile, success: true, size });

			console.log(`  ✅ ${bundleKey} (${framework}): ${(size / 1024).toFixed(1)} KiB`);
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
