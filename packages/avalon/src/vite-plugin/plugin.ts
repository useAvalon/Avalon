/**
 * Avalon Vite Plugin
 *
 * This module provides the main `avalon()` function that creates a unified Vite plugin
 * for the Avalon framework. It handles configuration resolution, integration activation,
 * Nitro server integration, and wires up all the necessary Vite hooks.
 * 
 * PERFORMANCE OPTIMIZATION:
 * Integration loading uses lazy discovery - only integrations that are actually used
 * in the islands directory are loaded. This reduces cold start time when not all
 * configured frameworks are used.
 */

import type { Plugin, ResolvedConfig, ViteDevServer } from "vite";
import type {
  AvalonPluginConfig,
  IntegrationName,
  ResolvedAvalonConfig,
} from "./types.ts";
import { resolveConfig, checkDirectoriesExist, logDirectoryCheckSummary } from "./config.ts";
import { activateIntegrations, activateSingleIntegration } from "./integration-activator.ts";
import { discoverIntegrationsFromFiles } from "./auto-discover.ts";
import { validateActiveIntegrations, formatValidationResults } from "./validation.ts";
import { createMDXPlugin } from "../build/mdx-plugin.ts";
import { mdxIslandTransform } from "../build/mdx-island-transform.ts";
import { pageIslandTransform } from "../build/page-island-transform.ts";
import { registry } from "../core/integrations/registry.ts";
import { createNitroIntegration } from "./nitro-integration.ts";
import type { AvalonNitroConfig, NitroConfigOutput } from "../nitro/config.ts";

// Declare global type for Avalon config
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
  const litPlugins: Plugin[] = []; // Lit plugins must come first (DOM shim requirement)

  for (const name of activeIntegrations) {
    const integration = registry.get(name);
    
    if (!integration) {
      console.warn(`⚠️ Integration '${name}' not found in registry`);
      continue;
    }

    // Check if integration implements vitePlugin()
    if (typeof integration.vitePlugin !== "function") {
      continue;
    }

    try {
      const integrationPlugins = await integration.vitePlugin();
      
      // Normalize to array
      const pluginArray = Array.isArray(integrationPlugins)
        ? integrationPlugins
        : [integrationPlugins];

      // Filter out any null/undefined plugins
      const validPlugins = pluginArray.filter((p): p is Plugin => p != null);

      if (validPlugins.length === 0) {
        continue;
      }

      // Lit plugins need special ordering (DOM shim must be first)
      if (name === "lit") {
        litPlugins.push(...validPlugins);
      } else {
        plugins.push(...validPlugins);
      }

      if (verbose) {
        console.log(`   📦 Collected ${validPlugins.length} Vite plugin(s) from ${name}`);
      }
    } catch (error) {
      // Handle errors gracefully with warnings
      console.warn(`   ⚠️ Could not load Vite plugins from ${name}:`, error);
    }
  }

  // Return with Lit plugins first (DOM shim requirement), then other framework plugins
  return [...litPlugins, ...plugins];
}

/**
 * Discovers which integrations are actually needed by scanning the islands directory.
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
    // Use the auto-discover module to scan the islands directory
    const discovered = await discoverIntegrationsFromFiles(
      config.islandsDir,
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
      needed.add(integration as IntegrationName);
    }
  }
  
  return needed;
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

  // Determine which integrations to actually load
  let integrationsToLoad: IntegrationName[];
  
  if (preResolvedConfig.lazyIntegrations && preResolvedConfig.integrations.length > 0) {
    // Lazy mode: only load integrations that are actually used
    const needed = await discoverNeededIntegrations(preResolvedConfig);
    
    if (needed.size > 0) {
      integrationsToLoad = Array.from(needed);
      if (preResolvedConfig.verbose) {
        console.log(`   Lazy mode: Loading ${integrationsToLoad.length} needed integration(s): ${integrationsToLoad.join(", ")}`);
        const skipped = preResolvedConfig.integrations.filter(i => !needed.has(i as IntegrationName));
        if (skipped.length > 0) {
          console.log(`   Skipping ${skipped.length} unused integration(s): ${skipped.join(", ")}`);
        }
      }
    } else {
      // No integrations discovered, load all configured as fallback
      integrationsToLoad = [...preResolvedConfig.integrations];
      if (preResolvedConfig.verbose) {
        console.log(`   No integrations discovered, loading all configured`);
      }
    }
  } else {
    // Eager mode: load all configured integrations
    integrationsToLoad = [...preResolvedConfig.integrations];
  }

  // Activate integrations
  if (integrationsToLoad.length > 0) {
    const lazyConfig = {
      ...preResolvedConfig,
      integrations: integrationsToLoad,
    };
    
    if (preResolvedConfig.verbose) {
      console.log("🏝️ Activating integrations...");
    }
    await activateIntegrations(lazyConfig, activeIntegrations);
  }

  // Create MDX plugins with user settings
  let mdxPlugins: Plugin[] = [];
  try {
    mdxPlugins = await createMDXPlugin({
      jsxImportSource: preResolvedConfig.mdx.jsxImportSource,
      syntaxHighlighting: preResolvedConfig.mdx.syntaxHighlighting,
      remarkPlugins: preResolvedConfig.mdx.remarkPlugins as import("unified").Pluggable[],
      rehypePlugins: preResolvedConfig.mdx.rehypePlugins as import("unified").Pluggable[],
      development: true,
    });

    // Add the MDX island transform plugin (runs after MDX compilation)
    // This transforms island component imports in MDX into renderIsland() calls
    mdxPlugins.push(mdxIslandTransform({
      verbose: preResolvedConfig.verbose,
    }));

    if (preResolvedConfig.verbose) {
      console.log("🏝️ Avalon MDX configuration:");
      console.log(`   JSX import source: ${preResolvedConfig.mdx.jsxImportSource}`);
      console.log(`   Syntax highlighting: ${preResolvedConfig.mdx.syntaxHighlighting}`);
      console.log(`   Island transform: enabled`);
    }
  } catch (error) {
    console.warn("⚠️ Could not configure MDX plugin:", error);
    mdxPlugins = [];
  }

  // Collect Vite plugins from activated integrations
  let integrationPlugins: Plugin[] = [];
  if (activeIntegrations.size > 0) {
    if (preResolvedConfig.verbose) {
      console.log("🏝️ Collecting Vite plugins from integrations...");
    }
    integrationPlugins = await collectIntegrationPlugins(
      activeIntegrations,
      preResolvedConfig.verbose
    );
    if (preResolvedConfig.verbose && integrationPlugins.length > 0) {
      console.log(`   Total integration plugins collected: ${integrationPlugins.length}`);
    }
  }

  // Create Nitro integration plugins if Nitro config is provided
  let nitroPlugins: Plugin[] = [];
  let nitroOptions: NitroConfigOutput | undefined;
  
  if (config?.nitro) {
    if (preResolvedConfig.verbose) {
      console.log("🚀 Avalon Nitro integration enabled");
      console.log(`   Preset: ${config.nitro.preset ?? "node-server"}`);
    }
    
    const nitroIntegration = createNitroIntegration(
      preResolvedConfig,
      config.nitro
    );
    
    nitroPlugins = nitroIntegration.plugins;
    nitroOptions = nitroIntegration.nitroOptions;
    
    // Store Nitro config globally for access by other parts of the system
    globalThis.__nitroConfig = nitroOptions;
  }

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
        console.log(`   Islands directory: ${resolvedConfig.islandsDir}`);
        console.log(`   Pages directory: ${resolvedConfig.pagesDir}`);
        console.log(`   API directory: ${resolvedConfig.apiDir}`);
        console.log(`   Development mode: ${isDev}`);
        
        logDirectoryCheckSummary(directoryResults, resolvedConfig.verbose);
      }
    },

    async buildStart() {
      if (resolvedConfig.verbose) {
        console.log("🏝️ Avalon build starting...");
      }

      // Auto-discover additional integrations if enabled
      if (resolvedConfig.autoDiscoverIntegrations) {
        if (resolvedConfig.verbose) {
          console.log("   Auto-discovering integrations from islands directory...");
        }

        try {
          const projectRoot = viteConfig?.root;
          const discovered = await discoverIntegrationsFromFiles(
            resolvedConfig.islandsDir,
            projectRoot
          );

          for (const name of discovered) {
            if (!activeIntegrations.has(name)) {
              try {
                await activateSingleIntegration(
                  name,
                  activeIntegrations,
                  resolvedConfig.verbose
                );
                if (resolvedConfig.verbose) {
                  console.log(`   ✅ Auto-discovered integration: ${name}`);
                }
              } catch (error) {
                if (resolvedConfig.showWarnings) {
                  console.warn(`   ⚠️ Could not auto-load integration: ${name}`);
                }
              }
            }
          }
        } catch (error) {
          if (resolvedConfig.showWarnings) {
            console.warn("   ⚠️ Auto-discovery failed:", error);
          }
        }
      }

      // Validate integrations if enabled
      if (resolvedConfig.validateIntegrations && activeIntegrations.size > 0) {
        const validationSummary = validateActiveIntegrations(
          activeIntegrations,
          resolvedConfig.showWarnings
        );

        if (!validationSummary.allValid) {
          const formattedResults = formatValidationResults(validationSummary);
          console.error(formattedResults);
          if (resolvedConfig.showWarnings) {
            console.warn(
              "   ⚠️ Some integrations have validation issues."
            );
          }
        } else if (resolvedConfig.verbose) {
          console.log(
            `   ✅ All ${activeIntegrations.size} integration(s) validated successfully`
          );
        }
      }

      if (resolvedConfig.verbose) {
        console.log(
          `🏝️ Avalon ready with ${activeIntegrations.size} active integration(s)`
        );
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

  // Page island transform: auto-wraps island imports in TSX pages when using `island` prop
  const pageTransformPlugin = pageIslandTransform({
    pagesDir: preResolvedConfig.pagesDir,
    verbose: preResolvedConfig.verbose,
  });

  return [
    pageTransformPlugin,
    ...litPlugins,
    ...mdxPlugins,
    avalonPlugin,
    ...nitroPlugins,
    ...otherIntegrationPlugins,
  ];
}

export function getResolvedConfig(): ResolvedAvalonConfig | undefined {
  return globalThis.__avalonConfig;
}

export function getIslandsDir(): string {
  return globalThis.__avalonConfig?.islandsDir ?? "src/islands";
}

export function getPagesDir(): string {
  return globalThis.__avalonConfig?.pagesDir ?? "src/pages";
}

export function getApiDir(): string {
  return globalThis.__avalonConfig?.apiDir ?? "src/api";
}

export function getNitroConfig(): NitroConfigOutput | undefined {
  return globalThis.__nitroConfig;
}

export function isNitroEnabled(): boolean {
  return globalThis.__nitroConfig !== undefined;
}

export type { AvalonPluginConfig, IntegrationName, ResolvedAvalonConfig };
export type { AvalonNitroConfig, NitroConfigOutput };
