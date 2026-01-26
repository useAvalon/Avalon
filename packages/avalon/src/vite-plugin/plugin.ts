/**
 * Avalon Vite Plugin
 *
 * This module provides the main `avalon()` function that creates a unified Vite plugin
 * for the Avalon framework. It handles configuration resolution, integration activation,
 * Nitro server integration, and wires up all the necessary Vite hooks.
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
      if (verbose) {
        console.warn(`   ⚠️ Integration '${name}' not found in registry`);
      }
      continue;
    }

    // Check if integration implements vitePlugin()
    if (typeof integration.vitePlugin !== "function") {
      if (verbose) {
        console.log(`   ℹ️ Integration '${name}' does not provide Vite plugins`);
      }
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
 * Creates the Avalon Vite plugin array
 *
 * @param config - Avalon configuration options
 * @returns A promise that resolves to an array of Vite plugins that handle all Avalon functionality
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { avalon } from '@avalon/avalon';
 *
 * export default defineConfig(async ({ command }) => ({
 *   plugins: [
 *     ...(await avalon({
 *       islandsDir: 'src/islands',
 *       pagesDir: 'src/pages',
 *       apiDir: 'src/api',
 *       integrations: ['react', 'svelte', 'lit', 'preact', 'vue', 'solid'],
 *       mdx: {
 *         jsxImportSource: 'preact',
 *         syntaxHighlighting: true,
 *       },
 *       nitro: {
 *         preset: 'node-server',
 *         streaming: true,
 *       },
 *       autoDiscoverIntegrations: true,
 *       validateIntegrations: true,
 *       showWarnings: true,
 *       verbose: command === 'serve',
 *     })),
 *   ],
 * }));
 * ```
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

  // Activate integrations early so we can collect their Vite plugins
  // This needs to happen before we return the plugin array
  if (preResolvedConfig.integrations.length > 0) {
    if (preResolvedConfig.verbose) {
      console.log("🏝️ Avalon activating integrations...");
      console.log(`   Integrations: ${preResolvedConfig.integrations.join(", ")}`);
    }
    await activateIntegrations(preResolvedConfig, activeIntegrations);
  }

  // Create MDX plugins with user settings
  let mdxPlugins: Plugin[] = [];
  try {
    mdxPlugins = await createMDXPlugin({
      jsxImportSource: preResolvedConfig.mdx.jsxImportSource,
      syntaxHighlighting: preResolvedConfig.mdx.syntaxHighlighting,
      remarkPlugins: preResolvedConfig.mdx.remarkPlugins as import("unified").Pluggable[],
      rehypePlugins: preResolvedConfig.mdx.rehypePlugins as import("unified").Pluggable[],
      development: true, // Will be updated based on actual command in configResolved
    });

    if (preResolvedConfig.verbose) {
      console.log("🏝️ Avalon MDX configuration:");
      console.log(`   JSX import source: ${preResolvedConfig.mdx.jsxImportSource}`);
      console.log(`   Syntax highlighting: ${preResolvedConfig.mdx.syntaxHighlighting}`);
      console.log(`   Remark plugins: ${preResolvedConfig.mdx.remarkPlugins.length}`);
      console.log(`   Rehype plugins: ${preResolvedConfig.mdx.rehypePlugins.length}`);
    }
  } catch (error) {
    console.warn("⚠️ Could not configure MDX plugin:", error);
    mdxPlugins = [];
  }

  // Collect Vite plugins from activated integrations
  // This includes framework-specific plugins like @vitejs/plugin-react, @vitejs/plugin-vue, etc.
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
      console.log(`   Streaming: ${config.nitro.streaming ?? true}`);
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

    // Ensure we run before framework-specific plugins
    enforce: "pre",

    /**
     * Called when Vite's config is resolved
     * We use this to resolve our own config with defaults
     */
    configResolved(resolvedViteConfig: ResolvedConfig) {
      viteConfig = resolvedViteConfig;
      const isDev = resolvedViteConfig.command === "serve";
      resolvedConfig = resolveConfig(config, isDev);

      // Store the resolved config globally so other parts of the system can access it
      // This enables directory configuration to be used by island discovery,
      // file-system router, and API route discovery
      globalThis.__avalonConfig = resolvedConfig;

      // Check if configured directories exist and log warnings for missing ones
      // This does NOT throw an error - it just warns and continues
      const directoryResults = checkDirectoriesExist(resolvedConfig, resolvedViteConfig.root);
      
      if (resolvedConfig.verbose) {
        console.log("🏝️ Avalon plugin initialized");
        console.log(`   Islands directory: ${resolvedConfig.islandsDir}`);
        console.log(`   Pages directory: ${resolvedConfig.pagesDir}`);
        console.log(`   API directory: ${resolvedConfig.apiDir}`);
        console.log(
          `   Integrations: ${resolvedConfig.integrations.length > 0 ? resolvedConfig.integrations.join(", ") : "(auto-discover)"}`
        );
        console.log(`   Development mode: ${isDev}`);
        
        // Log directory check summary in verbose mode
        logDirectoryCheckSummary(directoryResults, resolvedConfig.verbose);
      }
    },

    /**
     * Called at the start of each build
     * We use this to handle auto-discovery and validation
     * Note: Explicit integrations are already activated in avalon() before this hook
     */
    async buildStart() {
      if (resolvedConfig.verbose) {
        console.log("🏝️ Avalon build starting...");
      }

      // Auto-discover additional integrations if enabled
      // Note: These are discovered at build time, so their Vite plugins won't be included
      // in the initial plugin array. This is intentional - auto-discovered integrations
      // are for SSR/hydration support, not build-time transformations.
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

          // Activate discovered integrations that aren't already active
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
                  if (resolvedConfig.verbose && error instanceof Error) {
                    console.warn(`      ${error.message}`);
                  }
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
          // Don't throw - just warn about validation issues
          if (resolvedConfig.showWarnings) {
            console.warn(
              "   ⚠️ Some integrations have validation issues. They may not work correctly."
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

    /**
     * Called when the dev server is being configured
     * We use this to store the Vite dev server reference for SSR
     * and set up HMR handling
     */
    configureServer(server: ViteDevServer) {
      // Store server reference globally for SSR module loading
      // This is used by island.tsx and integration renderers to load components
      // deno-lint-ignore no-explicit-any
      (globalThis as any).__viteDevServer = server;

      if (resolvedConfig.verbose) {
        console.log("🏝️ Avalon dev server configured");
        console.log("   Vite dev server reference stored for SSR");
      }

      // The existing HMR setup is handled by vite-server.ts when createServer is called
      // We just need to ensure the server reference is available globally
      // Additional HMR coordination is handled by the ServerHMRHandler class
    },
  };

  // Return plugins in the correct order:
  // 1. Lit plugins first (DOM shim must be loaded before any Lit code)
  //    - Already handled by collectIntegrationPlugins() which puts Lit plugins first
  // 2. MDX plugins (need to process .mdx files before other plugins)
  // 3. Core Avalon plugin
  // 4. Nitro integration plugins (coordinate with Nitro server)
  // 5. Other framework plugins (React, Vue, Svelte, Preact, Solid)
  //    - Already ordered by collectIntegrationPlugins() with Lit first
  //
  // The integrationPlugins array already has Lit plugins at the front,
  // so we extract them and place them before MDX plugins
  const litPlugins = integrationPlugins.filter(p => p.name?.includes("lit"));
  const otherIntegrationPlugins = integrationPlugins.filter(p => !p.name?.includes("lit"));

  return [
    ...litPlugins,              // Lit SSR shim first (DOM shim requirement)
    ...mdxPlugins,              // MDX plugins second
    avalonPlugin,               // Core Avalon plugin third
    ...nitroPlugins,            // Nitro integration plugins fourth
    ...otherIntegrationPlugins, // Other framework plugins last
  ];
}

/**
 * Get the resolved Avalon configuration
 * This is useful for other parts of the system that need access to the config
 * 
 * @returns The resolved Avalon configuration, or undefined if the plugin hasn't been initialized
 */
export function getResolvedConfig(): ResolvedAvalonConfig | undefined {
  return globalThis.__avalonConfig;
}

/**
 * Get the islands directory from the resolved config
 * Falls back to the default if config is not available
 * 
 * @returns The islands directory path
 */
export function getIslandsDir(): string {
  return globalThis.__avalonConfig?.islandsDir ?? "src/islands";
}

/**
 * Get the pages directory from the resolved config
 * Falls back to the default if config is not available
 * 
 * @returns The pages directory path
 */
export function getPagesDir(): string {
  return globalThis.__avalonConfig?.pagesDir ?? "src/pages";
}

/**
 * Get the API directory from the resolved config
 * Falls back to the default if config is not available
 * 
 * @returns The API directory path
 */
export function getApiDir(): string {
  return globalThis.__avalonConfig?.apiDir ?? "src/api";
}

/**
 * Get the Nitro configuration
 * This is useful for other parts of the system that need access to Nitro config
 * 
 * @returns The Nitro configuration, or undefined if Nitro is not enabled
 */
export function getNitroConfig(): NitroConfigOutput | undefined {
  return globalThis.__nitroConfig;
}

/**
 * Check if Nitro integration is enabled
 * 
 * @returns True if Nitro integration is enabled
 */
export function isNitroEnabled(): boolean {
  return globalThis.__nitroConfig !== undefined;
}

/**
 * Re-export types for convenience
 */
export type { AvalonPluginConfig, IntegrationName, ResolvedAvalonConfig };

/**
 * Re-export Nitro types for convenience
 */
export type { AvalonNitroConfig, NitroConfigOutput };
