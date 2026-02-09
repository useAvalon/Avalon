/**
 * Schema and types for Avalon integration configuration.
 *
 * NOTE: This module is part of the CLI/schema config path, used by
 * `config-loader.ts` → `core/integrations/startup.ts` → `cli.ts`.
 * It is NOT used by the Vite plugin at runtime. The Vite plugin uses
 * `vite-plugin/config.ts` → `resolveConfig()` directly.
 *
 * Defaults are imported from `vite-plugin/config.ts` (the single source
 * of truth) to prevent drift between the two config paths.
 */

import { DEFAULT_CONFIG } from "../vite-plugin/config.ts";

/**
 * Configuration for a single integration
 */
export interface IntegrationConfigEntry {
  /** Name of the integration (e.g., "preact", "react", "vue", "solid", "svelte", "lit") */
  name: string;
  /** Whether this integration is enabled */
  enabled?: boolean;
  /** Custom options for the integration */
  options?: Record<string, unknown>;
}

/**
 * Avalon configuration file structure
 */
export interface AvalonConfig {
  /** List of integrations to register */
  integrations?: IntegrationConfigEntry[];
  
  /** Auto-discover integrations from used components (default: true) */
  autoDiscoverIntegrations?: boolean;
  
  /** Validate integrations on startup (default: true) */
  validateIntegrations?: boolean;
  
  /** Show warnings for integration issues (default: true) */
  showWarnings?: boolean;
}

/**
 * Merge user config with defaults derived from the canonical DEFAULT_CONFIG
 * in `vite-plugin/config.ts`.
 */
export function mergeConfig(userConfig: AvalonConfig): Required<AvalonConfig> {
  return {
    integrations: userConfig.integrations ?? [],
    autoDiscoverIntegrations: userConfig.autoDiscoverIntegrations ?? DEFAULT_CONFIG.autoDiscoverIntegrations,
    validateIntegrations: userConfig.validateIntegrations ?? DEFAULT_CONFIG.validateIntegrations,
    showWarnings: userConfig.showWarnings ?? DEFAULT_CONFIG.showWarnings,
  };
}
