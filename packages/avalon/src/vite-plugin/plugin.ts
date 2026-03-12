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

import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import type {
  AvalonPluginConfig,
  IntegrationName,
  ResolvedAvalonConfig,
} from "./types.ts";
import { resolveConfig, checkDirectoriesExist, logDirectoryCheckSummary } from "./config.ts";
import { activateIntegrations, activateSingleIntegration } from "./integration-activator.ts";
import { discoverIntegrationsFromIslandUsage } from "./auto-discover.ts";
import { validateActiveIntegrations, formatValidationResults } from "./validation.ts";
import { createMDXPlugin } from "../build/mdx-plugin.ts";
import { mdxIslandTransform } from "../build/mdx-island-transform.ts";
import { pageIslandTransform } from "../build/page-island-transform.ts";
import { registry } from "../core/integrations/registry.ts";
import { createNitroIntegration } from "./nitro-integration.ts";
import { islandSidecarPlugin } from "./island-sidecar-plugin.ts";
import type { NitroConfigOutput } from "../nitro/config.ts";
declare global {
  var __avalonConfig: ResolvedAvalonConfig | undefined;
  var __viteDevServer: ViteDevServer | undefined;
  var __nitroConfig: NitroConfigOutput | undefined;
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
  verbose: boolean = false
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

async function loadPluginsForIntegration(name: IntegrationName, verbose: boolean): Promise<Plugin[]> {
  const integration = registry.get(name);
  if (!integration) {
    console.warn(`⚠️ Integration '${name}' not found in registry`);
    return [];
  }
  if (typeof integration.vitePlugin !== "function") return [];

  try {
    const result = await integration.vitePlugin();
    const pluginArray = Array.isArray(result) ? result : [result];
    const validPlugins = pluginArray.filter((p): p is Plugin => p != null);
    if (verbose && validPlugins.length > 0) {
      console.log(`   📦 Collected ${validPlugins.length} Vite plugin(s) from ${name}`);
    }
    return validPlugins;
  } catch (error) {
    console.warn(`   ⚠️ Could not load Vite plugins from ${name}:`, error);
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
  projectRoot?: string
): Promise<Set<IntegrationName>> {
  const needed = new Set<IntegrationName>();
  
  try {
    // Scan pages and layouts for components used with island prop
    const discovered = await discoverIntegrationsFromIslandUsage(
      config.pagesDir,
      config.layoutsDir,
      projectRoot
    );
    
    // Only include integrations that are both discovered AND configured
    for (const integration of discovered) {
      if (config.integrations.includes(integration)) {
        needed.add(integration);
      }
    }
  } catch (error) {
    // If discovery fails, fall back to all configured integrations
    console.warn("⚠️ Could not discover integrations, using all configured:", error);
    for (const integration of config.integrations) {
      needed.add(integration);
    }
  }
  
  return needed;
}

async function resolveIntegrationsToLoad(
  preResolvedConfig: ResolvedAvalonConfig
): Promise<IntegrationName[]> {
  if (!preResolvedConfig.lazyIntegrations || preResolvedConfig.integrations.length === 0) {
    return [...preResolvedConfig.integrations];
  }

  const needed = await discoverNeededIntegrations(preResolvedConfig);
  if (needed.size === 0) {
    if (preResolvedConfig.verbose) console.log(`   No integrations discovered, loading all configured`);
    return [...preResolvedConfig.integrations];
  }

  const integrationsToLoad = Array.from(needed);
  if (preResolvedConfig.verbose) {
    console.log(`   Lazy mode: Loading ${integrationsToLoad.length} needed integration(s): ${integrationsToLoad.join(", ")}`);
    const skipped = preResolvedConfig.integrations.filter(i => !needed.has(i));
    if (skipped.length > 0) console.log(`   Skipping ${skipped.length} unused integration(s): ${skipped.join(", ")}`);
  }
  return integrationsToLoad;
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
    if (preResolvedConfig.verbose) {
      console.log(`   JSX import source: ${preResolvedConfig.mdx.jsxImportSource}`);
      console.log(`   Syntax highlighting: ${preResolvedConfig.mdx.syntaxHighlighting}`);
    }
    return mdxPlugins;
  } catch (error) {
    console.warn("⚠️ Could not configure MDX plugin:", error);
    return [];
  }
}

function setupNitroPlugins(
  preResolvedConfig: ResolvedAvalonConfig,
  nitroConfig: NonNullable<AvalonPluginConfig["nitro"]>,
  verbose?: boolean
): { plugins: Plugin[]; options: NitroConfigOutput } {
  if (verbose) {
    console.log("🚀 Avalon Nitro integration enabled");
    console.log(`   Preset: ${nitroConfig.preset ?? "node-server"}`);
  }
  const { plugins, nitroOptions } = createNitroIntegration(preResolvedConfig, nitroConfig);
  globalThis.__nitroConfig = nitroOptions;
  return { plugins, options: nitroOptions };
}

async function runAutoDiscovery(
  resolvedConfig: ResolvedAvalonConfig,
  viteRoot: string,
  activeIntegrations: Set<IntegrationName>
): Promise<void> {
  if (!resolvedConfig.autoDiscoverIntegrations) return;
  if (resolvedConfig.verbose) console.log("   Auto-discovering integrations from island usage...");

  try {
    const discovered = await discoverIntegrationsFromIslandUsage(
      resolvedConfig.pagesDir,
      resolvedConfig.layoutsDir,
      viteRoot
    );
    for (const name of discovered) {
      if (activeIntegrations.has(name)) continue;
      try {
        await activateSingleIntegration(name, activeIntegrations, resolvedConfig.verbose);
        if (resolvedConfig.verbose) console.log(`   ✅ Auto-discovered integration: ${name}`);
      } catch (error) {
        if (resolvedConfig.showWarnings) console.warn(`   ⚠️ Could not auto-load integration: ${name}`, error);
      }
    }
  } catch (error) {
    if (resolvedConfig.showWarnings) console.warn("   ⚠️ Auto-discovery failed:", error);
  }
}

function runValidation(
  resolvedConfig: ResolvedAvalonConfig,
  activeIntegrations: Set<IntegrationName>
): void {
  if (!resolvedConfig.validateIntegrations || activeIntegrations.size === 0) return;

  const validationSummary = validateActiveIntegrations(activeIntegrations, resolvedConfig.showWarnings);
  if (!validationSummary.allValid) {
    console.error(formatValidationResults(validationSummary));
    if (resolvedConfig.showWarnings) console.warn("   ⚠️ Some integrations have validation issues.");
  } else if (resolvedConfig.verbose) {
    console.log(`   ✅ All ${activeIntegrations.size} integration(s) validated successfully`);
  }
}

/**
 * Creates the Avalon Vite plugin array
 *
 * @param config - Avalon configuration options
 * @returns A promise that resolves to an array of Vite plugins that handle all Avalon functionality
 */
export async function avalon(config?: AvalonPluginConfig): Promise<Plugin[]> {
  // Resolved configuration with defaults applied
  let resolvedConfig: ResolvedAvalonConfig;

  // Reference to Vite's resolved config
  let viteConfig: ResolvedConfig;

  // Track which integrations are activated
  const activeIntegrations = new Set<IntegrationName>();

  // Pre-resolve config to get MDX settings and integration list
  // We use isDev=true as a default; the actual value will be set in configResolved
  const preResolvedConfig = resolveConfig(config, true);

  if (preResolvedConfig.verbose) {
    console.log("🏝️ Avalon plugin initializing...");
    console.log(`   Configured integrations: ${preResolvedConfig.integrations.join(", ") || "(none)"}`);
  }

  const integrationsToLoad = await resolveIntegrationsToLoad(preResolvedConfig);

  if (integrationsToLoad.length > 0) {
    if (preResolvedConfig.verbose) console.log("🏝️ Activating integrations...");
    await activateIntegrations({ ...preResolvedConfig, integrations: integrationsToLoad }, activeIntegrations);
  }

  if (preResolvedConfig.verbose) console.log("🏝️ Avalon MDX configuration:");
  const mdxPlugins = await setupMDXPlugins(preResolvedConfig);

  let integrationPlugins: Plugin[] = [];
  if (activeIntegrations.size > 0) {
    if (preResolvedConfig.verbose) console.log("🏝️ Collecting Vite plugins from integrations...");
    integrationPlugins = await collectIntegrationPlugins(activeIntegrations, preResolvedConfig.verbose);
    if (preResolvedConfig.verbose && integrationPlugins.length > 0) {
      console.log(`   Total integration plugins collected: ${integrationPlugins.length}`);
    }
  }

  let nitroPlugins: Plugin[] = [];
  if (config?.nitro) {
    const { plugins } = setupNitroPlugins(preResolvedConfig, config.nitro, preResolvedConfig.verbose);
    nitroPlugins = plugins;
  }

  // Sidecar plugin for Vue/Svelte/Solid type declarations
  const sidecarPlugin = islandSidecarPlugin({
    verbose: preResolvedConfig.verbose,
  });

  // The main Avalon plugin
  const avalonPlugin: Plugin = {
    name: "avalon",
    enforce: "pre",

    configResolved(resolvedViteConfig: ResolvedConfig) {
      viteConfig = resolvedViteConfig;
      const isDev = resolvedViteConfig.command === "serve";
      resolvedConfig = resolveConfig(config, isDev);

      globalThis.__avalonConfig = resolvedConfig;

      const directoryResults = checkDirectoriesExist(resolvedConfig, resolvedViteConfig.root);
      
      if (resolvedConfig.verbose) {
        console.log("🏝️ Avalon plugin initialized");
        console.log(`   Pages directory: ${resolvedConfig.pagesDir}`);
        console.log(`   Layouts directory: ${resolvedConfig.layoutsDir}`);
        if (resolvedConfig.modules) {
          console.log(`   Modules directory: ${resolvedConfig.modules.dir}`);
          console.log(`   Module pages folder: ${resolvedConfig.modules.pagesDirName}`);
          console.log(`   Module layouts folder: ${resolvedConfig.modules.layoutsDirName}`);
        }
        console.log(`   Development mode: ${isDev}`);
        
        logDirectoryCheckSummary(directoryResults, resolvedConfig.verbose);
      }
    },

    async buildStart() {
      if (resolvedConfig.verbose) console.log("🏝️ Avalon build starting...");

      await runAutoDiscovery(resolvedConfig, viteConfig?.root, activeIntegrations);
      runValidation(resolvedConfig, activeIntegrations);

      if (resolvedConfig.verbose) {
        console.log(`🏝️ Avalon ready with ${activeIntegrations.size} active integration(s)`);
      }
    },

    configureServer(server: ViteDevServer) {
      
      (globalThis as any).__viteDevServer = server;

      if (resolvedConfig.verbose) {
        console.log("🏝️ Avalon dev server configured");
        console.log("   Vite dev server reference stored for SSR");
      }
    },
  };

  // Extract Lit plugins for proper ordering
  const litPlugins = integrationPlugins.filter(p => p.name?.includes("lit"));
  const otherIntegrationPlugins = integrationPlugins.filter(p => !p.name?.includes("lit"));

  // Page island transform: auto-wraps components with `island` prop
  const pageTransformPlugin = pageIslandTransform({
    pagesDir: preResolvedConfig.pagesDir,
    layoutsDir: preResolvedConfig.layoutsDir,
    modules: preResolvedConfig.modules,
    verbose: preResolvedConfig.verbose,
  });

  return [
    pageTransformPlugin,
    ...litPlugins,
    ...mdxPlugins,
    avalonPlugin,
    sidecarPlugin,
    ...nitroPlugins,
    ...otherIntegrationPlugins,
  ];
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

export type { AvalonPluginConfig, IntegrationName, ResolvedAvalonConfig } from "./types.ts";
export type { AvalonNitroConfig, NitroConfigOutput } from "../nitro/config.ts";
