/**
 * Configuration Resolution for Avalon Vite Plugin
 *
 * This module provides default configuration values and the resolution
 * function that merges user configuration with defaults.
 */

import type {
  AvalonPluginConfig,
  ResolvedAvalonConfig,
  ResolvedMDXConfig,
  ResolvedModulesConfig,
  ModulesConfig,
} from "./types.ts";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

/**
 * Default MDX configuration values
 */
export const DEFAULT_MDX_CONFIG: ResolvedMDXConfig = {
  jsxImportSource: "preact",
  syntaxHighlighting: true,
  remarkPlugins: [],
  rehypePlugins: [],
};

/**
 * Default configuration values for the Avalon plugin
 * These are used when the user doesn't provide specific values
 */
export const DEFAULT_CONFIG: Omit<ResolvedAvalonConfig, "isDev"> = {
  pagesDir: "src/pages",
  layoutsDir: "src/layouts",
  modules: null,
  integrations: [],
  mdx: DEFAULT_MDX_CONFIG,
  verbose: false,
  autoDiscoverIntegrations: true,
  validateIntegrations: true,
  showWarnings: true,
  lazyIntegrations: true,
};

/**
 * Default modules configuration values
 */
export const DEFAULT_MODULES_CONFIG = {
  pagesDirName: "pages",
  layoutsDirName: "layouts",
};

/**
 * Resolves the modules configuration
 */
function resolveModulesConfig(
  modules: string | ModulesConfig | undefined
): ResolvedModulesConfig | null {
  if (!modules) return null;

  if (typeof modules === "string") {
    return {
      dir: modules,
      pagesDirName: DEFAULT_MODULES_CONFIG.pagesDirName,
      layoutsDirName: DEFAULT_MODULES_CONFIG.layoutsDirName,
    };
  }

  return {
    dir: modules.dir,
    pagesDirName: modules.pagesDirName ?? DEFAULT_MODULES_CONFIG.pagesDirName,
    layoutsDirName: modules.layoutsDirName ?? DEFAULT_MODULES_CONFIG.layoutsDirName,
  };
}

/**
 * Resolves user configuration by merging with defaults
 *
 * @param userConfig - Partial configuration provided by the user
 * @param isDev - Whether the application is running in development mode
 * @returns Fully resolved configuration with all defaults applied
 *
 * @example
 * ```ts
 * const resolved = resolveConfig({ integrations: ["react"] }, true);
 * // resolved.pagesDir === "src/pages" (default)
 * // resolved.integrations === ["react"] (user provided)
 * // resolved.isDev === true
 * ```
 */
export function resolveConfig(
  userConfig: AvalonPluginConfig | undefined,
  isDev: boolean
): ResolvedAvalonConfig {
  const config = userConfig ?? {};
  const modules = resolveModulesConfig(config.modules);

  return {
    pagesDir: config.pagesDir ?? DEFAULT_CONFIG.pagesDir,
    layoutsDir: config.layoutsDir ?? DEFAULT_CONFIG.layoutsDir,
    modules,
    integrations: config.integrations ?? DEFAULT_CONFIG.integrations,
    mdx: {
      jsxImportSource:
        config.mdx?.jsxImportSource ?? DEFAULT_MDX_CONFIG.jsxImportSource,
      syntaxHighlighting:
        config.mdx?.syntaxHighlighting ?? DEFAULT_MDX_CONFIG.syntaxHighlighting,
      remarkPlugins:
        config.mdx?.remarkPlugins ?? DEFAULT_MDX_CONFIG.remarkPlugins,
      rehypePlugins:
        config.mdx?.rehypePlugins ?? DEFAULT_MDX_CONFIG.rehypePlugins,
    },
    verbose: config.verbose ?? DEFAULT_CONFIG.verbose,
    autoDiscoverIntegrations:
      config.autoDiscoverIntegrations ?? DEFAULT_CONFIG.autoDiscoverIntegrations,
    validateIntegrations:
      config.validateIntegrations ?? DEFAULT_CONFIG.validateIntegrations,
    showWarnings: config.showWarnings ?? DEFAULT_CONFIG.showWarnings,
    lazyIntegrations: config.lazyIntegrations ?? DEFAULT_CONFIG.lazyIntegrations,
    isDev,
  };
}


/**
 * Result of directory existence check
 */
export interface DirectoryCheckResult {
  /** The directory path that was checked */
  path: string;
  /** The resolved absolute path */
  absolutePath: string;
  /** Whether the directory exists */
  exists: boolean;
  /** The type of directory (pages, layouts) */
  type: "pages" | "layouts";
}

/**
 * Check if configured directories exist and log warnings for missing ones
 *
 * This function checks if the configured directories (pagesDir, layoutsDir)
 * exist on the filesystem. If a directory doesn't exist, it logs a warning but
 * does NOT throw an error, allowing the application to continue.
 *
 * @param config - The resolved Avalon configuration
 * @param projectRoot - The root directory of the project (defaults to process.cwd())
 * @returns Array of directory check results
 *
 * @example
 * ```ts
 * const results = checkDirectoriesExist(resolvedConfig, '/path/to/project');
 * // Logs warnings for any missing directories
 * // Returns results for programmatic access
 * ```
 */
export function checkDirectoriesExist(
  config: ResolvedAvalonConfig,
  projectRoot: string = process.cwd()
): DirectoryCheckResult[] {
  const directories: Array<{ path: string; type: DirectoryCheckResult["type"] }> = [];
  
  // Only check pagesDir if modules is not configured (traditional architecture)
  // When using modular architecture, pages are discovered from modules
  if (!config.modules && config.pagesDir) {
    directories.push({ path: config.pagesDir, type: "pages" });
  }
  
  // Always check layoutsDir if it's set
  if (config.layoutsDir) {
    directories.push({ path: config.layoutsDir, type: "layouts" });
  }

  const results: DirectoryCheckResult[] = [];

  for (const { path, type } of directories) {
    const absolutePath = resolve(projectRoot, path);
    const exists = existsSync(absolutePath);

    results.push({
      path,
      absolutePath,
      exists,
      type,
    });

    if (!exists && config.showWarnings) {
      console.warn(
        `⚠️  Avalon: ${type} directory '${path}' does not exist (resolved to: ${absolutePath}). ` +
        `This directory will be skipped.`
      );
    }
  }

  return results;
}

/**
 * Log a summary of directory check results
 *
 * @param results - The directory check results
 * @param verbose - Whether to log verbose output
 */
export function logDirectoryCheckSummary(
  results: DirectoryCheckResult[],
  verbose: boolean
): void {
  const missing = results.filter((r) => !r.exists);
  const existing = results.filter((r) => r.exists);

  if (verbose) {
    if (existing.length > 0) {
      console.log(`   ✅ Found directories: ${existing.map((r) => r.path).join(", ")}`);
    }
    if (missing.length > 0) {
      console.log(`   ⚠️  Missing directories: ${missing.map((r) => r.path).join(", ")}`);
    }
  }
}
