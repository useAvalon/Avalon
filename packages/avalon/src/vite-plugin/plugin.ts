/**
 * Avalon Vite Plugin
 *
 * This module provides the main `avalon()` function that creates a unified Vite plugin
 * for the Avalon framework. It handles configuration resolution, integration activation,
 * Nitro server integration, and wires up all the necessary Vite hooks.
 *
 * ISLAND DETECTION:
 * Islands are detected by usage - any component used with an `island` prop in pages
 * or layouts is automatically treated as an island. No fixed islands directory required.
 */

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin, PluginOption, ResolvedConfig, ViteDevServer } from "vite";
import { islandClientBundlerPlugin } from "../build/island-client-bundler.ts";
import { islandCodeSplittingPlugin } from "../build/island-code-splitting.ts";
import { mdxIslandTransform } from "../build/mdx-island-transform.ts";
import { createMDXPlugin } from "../build/mdx-plugin.ts";
import { pageIslandTransform } from "../build/page-island-transform.ts";
import { registry } from "../core/integrations/registry.ts";
import type { NitroConfigOutput } from "../nitro/config.ts";
import { discoverIntegrationsFromIslandUsage } from "./auto-discover.ts";
import { checkDirectoriesExist, resolveConfig } from "./config.ts";
import { createImagePlugin } from "./image-optimization.ts";
import { activateIntegrations, activateSingleIntegration } from "./integration-activator.ts";
import { islandSidecarPlugin } from "./island-sidecar-plugin.ts";
import { createNitroIntegration } from "./nitro-integration.ts";
import { serverIslandsPlugin } from "./server-islands-plugin.ts";
import type { AvalonPluginConfig, IntegrationName, ResolvedAvalonConfig } from "./types.ts";
import { formatValidationResults, validateActiveIntegrations } from "./validation.ts";

declare global {
	var __avalonConfig: ResolvedAvalonConfig | undefined;
	var __viteDevServer: ViteDevServer | undefined;
	var __nitroConfig: NitroConfigOutput | undefined;
	/** Hydration mode — automatically set: "entry-client" in dev (HMR), "per-island" in production */
	var __avalonHydrationMode: "entry-client" | "per-island" | undefined;
}

/**
 * Collects Vite plugins from all activated integrations.
 *
 * This function iterates through the activated integrations and calls their
 * vitePlugin() method if implemented. The returned plugins are collected and
 * flattened into a single array.
 *
 * Plugin ordering is handled to ensure correct application:
 * - Lit plugins come first (DOM shim requirement)
 * - Other framework plugins follow
 *
 * @param activeIntegrations - Set of activated integration names
 * @param verbose - Whether to log detailed information
 * @returns Promise resolving to an array of Vite plugins from integrations
 */
export async function collectIntegrationPlugins(
	activeIntegrations: Set<IntegrationName>,
	verbose: boolean = false,
): Promise<Plugin[]> {
	const plugins: Plugin[] = [];
	const litPlugins: Plugin[] = [];

	for (const name of activeIntegrations) {
		const validPlugins = await loadPluginsForIntegration(name, verbose);
		if (name === "lit") {
			litPlugins.push(...validPlugins);
		} else {
			plugins.push(...validPlugins);
		}
	}

	return [...litPlugins, ...plugins];
}

async function loadPluginsForIntegration(
	name: IntegrationName,
	_verbose: boolean,
): Promise<Plugin[]> {
	const integration = registry.get(name);
	if (!integration) return [];
	if (typeof integration.vitePlugin !== "function") return [];

	try {
		const result = await integration.vitePlugin();
		const pluginArray = Array.isArray(result) ? result : [result];
		return pluginArray.filter((p): p is Plugin => p != null);
	} catch (error) {
		console.warn(
			`[avalon] Failed to load vite plugin for ${name}:`,
			error instanceof Error ? error.message : error,
		);
		return [];
	}
}

/**
 * Discovers which integrations are actually needed by scanning pages/layouts for island prop usage.
 * This enables lazy loading - only load Vite plugins for frameworks that are actually used.
 *
 * @param config - The resolved Avalon configuration
 * @param projectRoot - The project root directory (defaults to cwd)
 * @returns Set of integration names that are actually needed
 */
async function discoverNeededIntegrations(
	config: ResolvedAvalonConfig,
	projectRoot?: string,
): Promise<Set<IntegrationName>> {
	const needed = new Set<IntegrationName>();

	try {
		// Scan pages, layouts, and modules for components used with island prop
		const discovered = await discoverIntegrationsFromIslandUsage(
			config.pagesDir,
			config.layoutsDir,
			projectRoot,
			config.modules?.dir,
		);

		// Only include integrations that are both discovered AND configured
		for (const integration of discovered) {
			if (config.integrations.includes(integration)) {
				needed.add(integration);
			}
		}
	} catch {
		// If discovery fails, fall back to all configured integrations
		for (const integration of config.integrations) {
			needed.add(integration);
		}
	}

	return needed;
}

async function resolveIntegrationsToLoad(
	preResolvedConfig: ResolvedAvalonConfig,
): Promise<IntegrationName[]> {
	if (!preResolvedConfig.lazyIntegrations || preResolvedConfig.integrations.length === 0) {
		return [...preResolvedConfig.integrations];
	}

	const needed = await discoverNeededIntegrations(preResolvedConfig);
	if (needed.size === 0) {
		return [...preResolvedConfig.integrations];
	}

	return Array.from(needed);
}

async function setupMDXPlugins(preResolvedConfig: ResolvedAvalonConfig): Promise<Plugin[]> {
	try {
		const mdxPlugins = await createMDXPlugin({
			jsxImportSource: preResolvedConfig.mdx.jsxImportSource,
			syntaxHighlighting: preResolvedConfig.mdx.syntaxHighlighting,
			remarkPlugins: preResolvedConfig.mdx.remarkPlugins as import("unified").Pluggable[],
			rehypePlugins: preResolvedConfig.mdx.rehypePlugins as import("unified").Pluggable[],
			development: true,
		});
		mdxPlugins.push(mdxIslandTransform({ verbose: preResolvedConfig.verbose }));
		return mdxPlugins;
	} catch (error) {
		if (preResolvedConfig.showWarnings) {
			console.warn("⚠️ Could not configure MDX plugin:", error);
		}
		return [];
	}
}

function setupNitroPlugins(
	preResolvedConfig: ResolvedAvalonConfig,
	nitroConfig: NonNullable<AvalonPluginConfig["nitro"]>,
	_verbose?: boolean,
): { plugins: Plugin[]; options: NitroConfigOutput } {
	const { plugins, nitroOptions } = createNitroIntegration(preResolvedConfig, nitroConfig);
	globalThis.__nitroConfig = nitroOptions;
	return { plugins, options: nitroOptions };
}

async function runAutoDiscovery(
	resolvedConfig: ResolvedAvalonConfig,
	viteRoot: string,
	activeIntegrations: Set<IntegrationName>,
): Promise<void> {
	if (!resolvedConfig.autoDiscoverIntegrations) return;

	try {
		const discovered = await discoverIntegrationsFromIslandUsage(
			resolvedConfig.pagesDir,
			resolvedConfig.layoutsDir,
			viteRoot,
			resolvedConfig.modules?.dir,
		);
		for (const name of discovered) {
			if (activeIntegrations.has(name)) continue;
			try {
				await activateSingleIntegration(name, activeIntegrations, resolvedConfig.verbose);
			} catch (error) {
				if (resolvedConfig.showWarnings)
					console.warn(`   ⚠️ Could not auto-load integration: ${name}`, error);
			}
		}
	} catch (error) {
		if (resolvedConfig.showWarnings) console.warn("   ⚠️ Auto-discovery failed:", error);
	}
}

function runValidation(
	resolvedConfig: ResolvedAvalonConfig,
	activeIntegrations: Set<IntegrationName>,
): void {
	if (!resolvedConfig.validateIntegrations || activeIntegrations.size === 0) return;

	const validationSummary = validateActiveIntegrations(
		activeIntegrations,
		resolvedConfig.showWarnings,
	);
	if (!validationSummary.allValid) {
		console.error(formatValidationResults(validationSummary));
		if (resolvedConfig.showWarnings) console.warn("   ⚠️ Some integrations have validation issues.");
	}
}

/**
 * Creates the Avalon Vite plugin array
 *
 * @param config - Avalon configuration options
 * @returns A promise that resolves to an array of Vite plugins that handle all Avalon functionality.
 *          Returns PluginOption[] to avoid TypeScript's excessive stack depth issues
 *          when comparing Plugin<any> arrays in Vite 8's complex type system.
 */
export async function avalon(config?: AvalonPluginConfig): Promise<PluginOption[]> {
	// Resolved configuration with defaults applied
	let resolvedConfig: ResolvedAvalonConfig;

	// Reference to Vite's resolved config
	let viteConfig: ResolvedConfig;

	// Track which integrations are activated
	const activeIntegrations = new Set<IntegrationName>();

	// Pre-resolve config to get MDX settings and integration list
	// We use isDev=true as a default; the actual value will be set in configResolved
	const preResolvedConfig = resolveConfig(config, true);

	const integrationsToLoad = await resolveIntegrationsToLoad(preResolvedConfig);

	if (integrationsToLoad.length > 0) {
		await activateIntegrations(
			{ ...preResolvedConfig, integrations: integrationsToLoad },
			activeIntegrations,
		);
	}
	const mdxPlugins = await setupMDXPlugins(preResolvedConfig);

	// Image optimization plugins (vite-imagetools wrapper)
	const imagePlugins = await createImagePlugin(preResolvedConfig.image, preResolvedConfig.verbose);

	let integrationPlugins: Plugin[] = [];
	if (activeIntegrations.size > 0) {
		integrationPlugins = await collectIntegrationPlugins(
			activeIntegrations,
			preResolvedConfig.verbose,
		);
	}

	let nitroPlugins: Plugin[] = [];
	if (config?.nitro) {
		const { plugins } = setupNitroPlugins(
			preResolvedConfig,
			config.nitro,
			preResolvedConfig.verbose,
		);
		nitroPlugins = plugins;
	}

	// Sidecar plugin for Vue/Svelte/Solid type declarations
	const sidecarPlugin = islandSidecarPlugin({
		verbose: preResolvedConfig.verbose,
	});

	// Server islands plugin: collects server island components during build,
	// generates the component manifest, and embeds the encryption key
	const serverIslands = serverIslandsPlugin({
		verbose: preResolvedConfig.verbose,
	});

	// Pre-resolve paths for standalone projects.
	// In the monorepo www/ project these are handled by manual resolve.alias.
	const require = createRequire(import.meta.url);

	let clientMainResolved: string | null = null;
	try {
		const clientEntry = require.resolve("@useavalon/avalon/client");
		clientMainResolved = join(dirname(clientEntry), "main.js");
	} catch {
		// Monorepo — www/ sets its own alias
	}

	// Resolve /@useavalon/*/client and /@useavalon/*/client/hmr virtual imports
	// used by main.js. These are resolved dynamically in the resolveId hook
	// using Vite's resolver. We also handle bare specifiers (without leading /)
	// so that production static imports in main.js resolve correctly.
	const integrationVirtualIds = new Set(
		["preact", "react", "vue", "svelte", "solid", "lit", "qwik"].flatMap((name) => [
			`/@useavalon/${name}/client`,
			`/@useavalon/${name}/client/hmr`,
			`@useavalon/${name}/client`,
			`@useavalon/${name}/client/hmr`,
		]),
	);

	// The main Avalon plugin
	const avalonPlugin: Plugin = {
		name: "avalon",
		enforce: "pre",

		config(_config, { command }) {
			// @useavalon packages ship raw .ts source. Vite's built-in OXC
			// would apply integration plugins' global jsx: 'automatic' config
			// to plain .ts files, causing errors. We exclude them from OXC and
			// handle TS stripping ourselves in the transform hook below (for
			// both client and SSR).
			//
			// ssr.noExternal: Ensures Vite processes @useavalon packages through
			// the SSR transform pipeline instead of treating them as external CJS.
			//
			// optimizeDeps: @useavalon packages are excluded from dep optimization
			// because we handle their resolution (resolveId) and transformation
			// (transform hook) ourselves. Without excluding them, Vite's optimizer
			// discovers them mid-serve via dynamic imports in main.js, triggers a
			// re-optimization that invalidates in-flight requests, and causes
			// 504 (Outdated Optimize Dep) errors on first start.
			//
			// We also pre-include the actual framework runtime deps (preact,
			// solid-js, etc.) so they're pre-bundled before the first page load.
			const frameworkDeps: Record<string, string[]> = {
				preact: ["preact", "preact/hooks"],
				react: ["react", "react-dom", "react-dom/client"],
				vue: ["vue"],
				svelte: ["svelte", "svelte/internal"],
				solid: ["solid-js", "solid-js/web"],
				lit: ["lit", "@lit-labs/ssr-client"],
				qwik: ["@builder.io/qwik"],
			};
			const depsToInclude = integrationsToLoad.flatMap((name) => frameworkDeps[name] ?? []);

			// When the page shell renders on React (`core: "react"`), the SSR
			// pipeline needs real React handled as ESM: pre-bundle react-dom/server
			// + the jsx runtime, and inline React through Vite's SSR transform so
			// its CJS entry doesn't break the dev SSR module runner.
			const isReactCore = config?.core === "react";
			// React (the shell engine) is left EXTERNAL to the SSR bundle so Node's
			// loader handles its CommonJS entry — inlining it breaks Vite's dev SSR
			// module runner. We still pre-bundle it for the client optimizer.
			if (isReactCore) {
				depsToInclude.push("react-dom/server", "react/jsx-runtime");
			}

			// __AVALON_PER_ISLAND__ is a compile-time constant that tells island.tsx
			// whether to use per-island hydration scripts (production) or entry-client
			// mode (dev/HMR). This is the most reliable detection because it's replaced
			// at transform time — it works even in Nitro's separate SSR module runner
			// where globalThis values from the Vite process aren't available.
			const isPerIsland = command === "build";

			return {
				define: {
					__AVALON_PER_ISLAND__: JSON.stringify(isPerIsland),
				},
				oxc: {
					exclude: [/node_modules\/@useavalon\/.*\.tsx?$/],
				},
				ssr: {
					noExternal: [/^@useavalon\//],
				},
				optimizeDeps: {
					exclude: ["@useavalon/avalon", ...integrationsToLoad.map((name) => `@useavalon/${name}`)],
					include: depsToInclude,
				},
			};
		},

		configResolved(resolvedViteConfig: ResolvedConfig) {
			viteConfig = resolvedViteConfig;
			const isDev = resolvedViteConfig.command === "serve";
			resolvedConfig = resolveConfig(config, isDev);

			globalThis.__avalonConfig = resolvedConfig;

			checkDirectoriesExist(resolvedConfig, resolvedViteConfig.root);
		},

		async resolveId(id: string) {
			if (id === "/src/client/main.js" && clientMainResolved) {
				return clientMainResolved;
			}
			// /@useavalon/*/client and /@useavalon/*/client/hmr — resolve through
			// Vite's pipeline so it finds workspace-linked or npm-installed
			// integration packages from the consuming project's node_modules,
			// not from avalon's own context.
			if (integrationVirtualIds.has(id)) {
				// Strip leading / for dev virtual imports; bare specifiers are used as-is
				const packageId = id.startsWith("/") ? id.slice(1) : id;
				const resolved = await this.resolve(packageId);
				return resolved?.id ?? null;
			}
			return null;
		},

		async transform(code: string, id: string) {
			// Strip TypeScript from @useavalon packages for both SSR and client.
			// We exclude @useavalon .ts files from Vite's built-in OXC (see config()
			// above) because integration plugins set jsx: 'automatic' globally, which
			// OXC would incorrectly apply to plain .ts files. Instead, we handle TS
			// stripping ourselves here without any JSX config.
			if (id.includes("@useavalon/") && /\.tsx?$/.test(id)) {
				const { transform: oxcTransform } = await import("oxc-transform");
				const result = await oxcTransform(id, code, {
					sourcemap: true,
					typescript: { onlyRemoveTypeImports: false },
				});
				return { code: result.code, map: result.map, moduleType: "js" };
			}
		},

		async buildStart() {
			await runAutoDiscovery(resolvedConfig, viteConfig?.root, activeIntegrations);
			runValidation(resolvedConfig, activeIntegrations);
		},

		configureServer(server: ViteDevServer) {
			(globalThis as any).__viteDevServer = server;
		},
	};

	// Extract Lit plugins for proper ordering
	const litPlugins = integrationPlugins.filter((p) => p.name?.includes("lit"));
	const otherIntegrationPlugins = integrationPlugins.filter((p) => !p.name?.includes("lit"));

	// Page island transform: auto-wraps components with `island` prop
	const pageTransformPlugin = pageIslandTransform({
		pagesDir: preResolvedConfig.pagesDir,
		layoutsDir: preResolvedConfig.layoutsDir,
		modules: preResolvedConfig.modules,
		verbose: preResolvedConfig.verbose,
	});

	// Island client bundler: emits island components as separate client chunks
	const islandBundler = islandClientBundlerPlugin(preResolvedConfig, config?.nitro);

	// Island code splitting: bundles framework adapter + runtime into island chunks
	const codeSplitting = islandCodeSplittingPlugin(preResolvedConfig, config?.nitro);

	return [
		pageTransformPlugin,
		islandBundler,
		codeSplitting,
		...imagePlugins,
		...litPlugins,
		...mdxPlugins,
		avalonPlugin,
		sidecarPlugin,
		serverIslands,
		...nitroPlugins,
		...otherIntegrationPlugins,
	] as PluginOption[];
}

export function getResolvedConfig(): ResolvedAvalonConfig | undefined {
	return globalThis.__avalonConfig;
}

export function getPagesDir(): string {
	return globalThis.__avalonConfig?.pagesDir ?? "src/pages";
}

export function getLayoutsDir(): string {
	return globalThis.__avalonConfig?.layoutsDir ?? "src/layouts";
}

export function getNitroConfig(): NitroConfigOutput | undefined {
	return globalThis.__nitroConfig;
}

export function isNitroEnabled(): boolean {
	return globalThis.__nitroConfig !== undefined;
}

export type { AvalonNitroConfig, NitroConfigOutput } from "../nitro/config.ts";
export type {
	AvalonPluginConfig,
	ImageConfig,
	IntegrationName,
	ResolvedAvalonConfig,
	ResolvedImageConfig,
} from "./types.ts";
