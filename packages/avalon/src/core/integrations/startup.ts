/**
 * Integration system startup and initialization
 * Handles loading config, validating integrations, and providing helpful error messages
 */

import { registry } from "./registry.ts";
import { loadConfig, type ConfigLoadResult } from "./config-loader.ts";
import { validateIntegration, formatValidationResult } from "./validator.ts";
import type { Integration } from "../../../../integrations/shared/types.ts";
import type { IntegrationConfigEntry } from "../../schemas/integration-config.ts";

/**
 * Result of integration system initialization
 */
export interface InitializationResult {
  /** Whether initialization was successful */
  success: boolean;
  /** Loaded configuration */
  config: ConfigLoadResult;
  /** Integrations that were loaded */
  loadedIntegrations: string[];
  /** Integrations that failed to load */
  failedIntegrations: Map<string, string>;
  /** Validation results for loaded integrations */
  validationResults: Map<string, { valid: boolean; errors: string[]; warnings: string[] }>;
  /** Any errors encountered */
  errors: string[];
  /** Any warnings */
  warnings: string[];
}

/**
 * Initialize the integration system
 * Loads config, registers integrations, and validates them
 */
export async function initializeIntegrations(
  startDir?: string
): Promise<InitializationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const loadedIntegrations: string[] = [];
  const failedIntegrations = new Map<string, string>();
  const validationResults = new Map<string, { valid: boolean; errors: string[]; warnings: string[] }>();
  
  // Load configuration
  const config = await loadConfig(startDir);
  errors.push(...config.errors);
  warnings.push(...config.warnings);
  
  if (config.errors.length > 0) {
    return {
      success: false,
      config,
      loadedIntegrations,
      failedIntegrations,
      validationResults,
      errors,
      warnings,
    };
  }
  
  // Load integrations from config
  const integrationsToLoad = config.config.integrations.filter(
    (entry) => entry.enabled !== false
  );
  
  for (const entry of integrationsToLoad) {
    try {
      const integration = await registry.load(entry.name);
      loadedIntegrations.push(entry.name);
      
      // Validate if enabled
      if (config.config.validateIntegrations) {
        const validation = validateIntegration(integration);
        validationResults.set(entry.name, validation);
        
        if (!validation.valid) {
          errors.push(
            `Integration '${entry.name}' failed validation:\n${
              validation.errors.map(e => `  - ${e}`).join("\n")
            }`
          );
        }
        
        if (config.config.showWarnings && validation.warnings.length > 0) {
          warnings.push(
            `Integration '${entry.name}' has warnings:\n${
              validation.warnings.map(w => `  - ${w}`).join("\n")
            }`
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      failedIntegrations.set(entry.name, errorMessage);
      errors.push(`Failed to load integration '${entry.name}': ${errorMessage}`);
    }
  }
  
  const success = errors.length === 0 && failedIntegrations.size === 0;
  
  return {
    success,
    config,
    loadedIntegrations,
    failedIntegrations,
    validationResults,
    errors,
    warnings,
  };
}

/**
 * List all available integrations (both loaded and available)
 */
export interface IntegrationInfo {
  name: string;
  loaded: boolean;
  version?: string;
  valid?: boolean;
  enabled?: boolean;
  configEntry?: IntegrationConfigEntry;
}

/**
 * Get information about all integrations
 */
export async function listIntegrations(startDir?: string): Promise<IntegrationInfo[]> {
  const config = await loadConfig(startDir);
  const integrations: IntegrationInfo[] = [];
  
  // Get all integrations from config
  for (const entry of config.config.integrations) {
    const loaded = registry.has(entry.name);
    const integration = loaded ? registry.get(entry.name) : undefined;
    
    integrations.push({
      name: entry.name,
      loaded,
      version: integration?.version,
      enabled: entry.enabled !== false,
      configEntry: entry,
    });
  }
  
  // Add any loaded integrations not in config
  for (const integration of registry.getAll()) {
    if (!integrations.find(i => i.name === integration.name)) {
      integrations.push({
        name: integration.name,
        loaded: true,
        version: integration.version,
        enabled: true,
      });
    }
  }
  
  return integrations;
}

/**
 * Format initialization result as a human-readable string
 */
export function formatInitializationResult(result: InitializationResult): string {
  const lines: string[] = [];
  
  if (result.success) {
    lines.push("✓ Integration system initialized successfully");
  } else {
    lines.push("✗ Integration system initialization failed");
  }
  
  if (result.config.found) {
    lines.push(`\nConfig file: ${result.config.configPath}`);
  } else {
    lines.push("\nNo config file found, using defaults");
  }
  
  if (result.loadedIntegrations.length > 0) {
    lines.push(`\nLoaded integrations (${result.loadedIntegrations.length}):`);
    result.loadedIntegrations.forEach(name => {
      const validation = result.validationResults.get(name);
      const status = validation?.valid === false ? "✗" : "✓";
      lines.push(`  ${status} ${name}`);
    });
  }
  
  if (result.failedIntegrations.size > 0) {
    lines.push(`\nFailed integrations (${result.failedIntegrations.size}):`);
    result.failedIntegrations.forEach((error, name) => {
      lines.push(`  ✗ ${name}: ${error}`);
    });
  }
  
  if (result.errors.length > 0) {
    lines.push("\nErrors:");
    result.errors.forEach(error => {
      lines.push(`  - ${error}`);
    });
  }
  
  if (result.warnings.length > 0) {
    lines.push("\nWarnings:");
    result.warnings.forEach(warning => {
      lines.push(`  - ${warning}`);
    });
  }
  
  return lines.join("\n");
}

/**
 * Get helpful error message for missing integration
 */
export function getMissingIntegrationError(framework: string): string {
  const knownIntegrations = ["preact", "vue", "solid", "svelte"];
  
  if (knownIntegrations.includes(framework)) {
    return `
Integration '${framework}' is not loaded.

To fix this, add it to your avalon.config.ts:

  export default {
    integrations: [
      { name: "${framework}", enabled: true },
    ],
  };

Or enable auto-discovery:

  export default {
    autoDiscoverIntegrations: true,
  };

Make sure the integration package is installed:
  deno add @avalon/integration-${framework}
`.trim();
  }
  
  return `
Integration '${framework}' is not available.

This appears to be a custom integration. Make sure:
1. The integration is properly installed
2. It's registered in your avalon.config.ts
3. It implements the Integration interface correctly

For more information, see the integration documentation.
`.trim();
}

/**
 * Get helpful error message for misconfigured integration
 */
export function getMisconfiguredIntegrationError(
  framework: string,
  validationErrors: string[]
): string {
  return `
Integration '${framework}' is misconfigured.

Validation errors:
${validationErrors.map(e => `  - ${e}`).join("\n")}

Please check your integration implementation or update to the latest version.
`.trim();
}

/**
 * Format integration list as a table
 */
export function formatIntegrationList(integrations: IntegrationInfo[]): string {
  if (integrations.length === 0) {
    return "No integrations configured.";
  }
  
  const lines: string[] = [];
  lines.push("Available Integrations:");
  lines.push("");
  
  // Header
  lines.push("Name       | Status  | Version | Enabled");
  lines.push("-----------|---------|---------|--------");
  
  // Rows
  integrations.forEach(info => {
    const name = info.name.padEnd(10);
    const status = info.loaded ? "Loaded " : "Not Loaded";
    const version = (info.version || "-").padEnd(7);
    const enabled = info.enabled ? "Yes" : "No";
    
    lines.push(`${name} | ${status} | ${version} | ${enabled}`);
  });
  
  return lines.join("\n");
}
