/**
 * Configuration loader for Avalon integrations.
 *
 * CONFIG PATH: CLI tooling
 * This loader reads `avalon.config.ts` from disk and is used exclusively by
 * `core/integrations/startup.ts` → `cli.ts`. It is NOT wired into the Vite
 * plugin startup path.
 *
 * The Vite plugin uses its own config path:
 *   `vite-plugin/config.ts` → `resolveConfig(userConfig, isDev)`
 * which takes inline options from `vite.config.ts` and resolves them against
 * `DEFAULT_CONFIG`. That path uses `IntegrationName[]` (simple string array).
 *
 * This CLI path uses `IntegrationConfigEntry[]` (objects with name/enabled/options)
 * because the file-based `avalon.config.ts` format supports per-integration
 * options and enable/disable toggles.
 *
 * Shared boolean defaults (autoDiscoverIntegrations, validateIntegrations,
 * showWarnings) are sourced from `DEFAULT_CONFIG` in `vite-plugin/config.ts`
 * via `mergeConfig()` in `schemas/integration-config.ts`.
 */

import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { AvalonConfig, IntegrationConfigEntry } from "../../schemas/integration-config.ts";
import { mergeConfig } from "../../schemas/integration-config.ts";

/**
 * Result of loading configuration
 */
export interface ConfigLoadResult {
  /** Loaded configuration */
  config: Required<AvalonConfig>;
  /** Path to the config file (if found) */
  configPath?: string;
  /** Whether config file was found */
  found: boolean;
  /** Any errors encountered */
  errors: string[];
  /** Any warnings */
  warnings: string[];
}

/**
 * Load Avalon configuration from avalon.config.ts
 * Searches in the current directory and parent directories
 */
export async function loadConfig(startDir?: string): Promise<ConfigLoadResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const searchDir = startDir || process.cwd();
  const configPath = await findConfigFile(searchDir);
  
  if (!configPath) {
    // No config file found, use defaults
    return {
      config: mergeConfig({}),
      found: false,
      errors,
      warnings,
    };
  }
  
  try {
    // Import the config file
    const configModule = await import(`file://${configPath}`);
    const userConfig: AvalonConfig = configModule.default || configModule.config || {};
    
    // Validate the config structure
    const validationResult = validateConfigStructure(userConfig);
    errors.push(...validationResult.errors);
    warnings.push(...validationResult.warnings);
    
    // Merge with defaults
    const config = mergeConfig(userConfig);
    
    return {
      config,
      configPath,
      found: true,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(
      `Failed to load config from ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    
    return {
      config: mergeConfig({}),
      configPath,
      found: true,
      errors,
      warnings,
    };
  }
}

/**
 * Find avalon.config.ts file by searching up the directory tree
 */
async function findConfigFile(startDir: string): Promise<string | null> {
  const configNames = [
    "avalon.config.ts",
    "avalon.config.js",
    "avalon.config.mjs",
  ];
  
  let currentDir = resolve(startDir);
  const root = resolve("/");
  
  while (currentDir !== root) {
    for (const configName of configNames) {
      const configPath = join(currentDir, configName);
      
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    
    // Move up one directory
    const parentDir = resolve(currentDir, "..");
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
  }
  
  return null;
}

/**
 * Validate the structure of the config object
 */
function validateConfigStructure(config: unknown): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!config || typeof config !== "object") {
    errors.push("Config must be an object");
    return { errors, warnings };
  }
  
  const cfg = config as Partial<AvalonConfig>;
  
  // Validate integrations array
  if (cfg.integrations !== undefined) {
    if (!Array.isArray(cfg.integrations)) {
      errors.push("'integrations' must be an array");
    } else {
      cfg.integrations.forEach((entry, index) => {
        const entryErrors = validateIntegrationEntry(entry, index);
        errors.push(...entryErrors);
      });
    }
  }
  
  // Validate boolean flags
  if (cfg.autoDiscoverIntegrations !== undefined && typeof cfg.autoDiscoverIntegrations !== "boolean") {
    errors.push("'autoDiscoverIntegrations' must be a boolean");
  }
  
  if (cfg.validateIntegrations !== undefined && typeof cfg.validateIntegrations !== "boolean") {
    errors.push("'validateIntegrations' must be a boolean");
  }
  
  if (cfg.showWarnings !== undefined && typeof cfg.showWarnings !== "boolean") {
    errors.push("'showWarnings' must be a boolean");
  }
  
  return { errors, warnings };
}

/**
 * Validate a single integration config entry
 */
function validateIntegrationEntry(entry: unknown, index: number): string[] {
  const errors: string[] = [];
  
  if (!entry || typeof entry !== "object") {
    errors.push(`integrations[${index}] must be an object`);
    return errors;
  }
  
  const e = entry as Partial<IntegrationConfigEntry>;
  
  if (!e.name || typeof e.name !== "string") {
    errors.push(`integrations[${index}].name must be a string`);
  }
  
  if (e.enabled !== undefined && typeof e.enabled !== "boolean") {
    errors.push(`integrations[${index}].enabled must be a boolean`);
  }
  
  if (e.options !== undefined && (typeof e.options !== "object" || e.options === null)) {
    errors.push(`integrations[${index}].options must be an object`);
  }
  
  return errors;
}

/**
 * Create a default config file
 */
export function generateDefaultConfig(): string {
  return `/**
 * Avalon Framework Configuration
 * 
 * This file configures framework integrations and other Avalon settings.
 */

export default {
  /**
   * Framework integrations to register
   * Avalon will load these integrations on startup
   */
  integrations: [
    { name: "preact", enabled: true },
    { name: "react", enabled: true },
    { name: "vue", enabled: true },
    { name: "solid", enabled: true },
    { name: "svelte", enabled: true },
    { name: "lit", enabled: true },
  ],

  /**
   * Auto-discover integrations from component usage
   * When true, Avalon will automatically load integrations
   * based on the components you use, even if not listed above
   */
  autoDiscoverIntegrations: true,

  /**
   * Validate integrations on startup
   * When true, Avalon will check that all integrations
   * implement the required interface correctly
   */
  validateIntegrations: true,

  /**
   * Show warnings for integration issues
   * When true, Avalon will log warnings for non-critical
   * integration problems
   */
  showWarnings: true,
};
`;
}
