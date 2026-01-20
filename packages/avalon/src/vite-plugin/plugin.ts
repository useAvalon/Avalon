/**
 * Avalon Vite Plugin
 *
 * This module provides the main `avalon()` function that creates a unified Vite plugin
 * for the Avalon framework. It handles configuration resolution, integration activation,
 * and wires up all the necessary Vite hooks.
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

// Declare global type for Avalon config
declare global {
  var __avalonConfig: ResolvedAvalonConfig | undefined;
  var __viteDevServer: ViteDevServer | undefined;
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

  // Pre-resolve config to get MDX settings
  // We use isDev=true as a default; the actual value will be set in configResolved
  const preResolvedConfig = resolveConfig(config, true);

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
     * We use this to activate the specified integrations
     */
    async buildStart() {
      if (resolvedConfig.verbose) {
        console.log("🏝️ Avalon build starting...");
      }

      // Activate explicitly specified integrations
      if (resolvedConfig.integrations.length > 0) {
        if (resolvedConfig.verbose) {
          console.log(
            `   Activating integrations: ${resolvedConfig.integrations.join(", ")}`
          );
        }
        await activateIntegrations(resolvedConfig, activeIntegrations);
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

  // Return the MDX plugins first (they need to process .mdx files before other plugins),
  // followed by the main Avalon plugin
  return [...mdxPlugins, avalonPlugin];
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
 * Re-export types for convenience
 */
export type { AvalonPluginConfig, IntegrationName, ResolvedAvalonConfig };
