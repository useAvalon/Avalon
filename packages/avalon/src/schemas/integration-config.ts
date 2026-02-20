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

import { z } from "zod";
import { DEFAULT_CONFIG } from "../vite-plugin/config";

/**
 * Configuration for a single integration
 */
export const IntegrationConfigEntrySchema = z.object({
  /** Name of the integration (e.g., "preact", "react", "vue", "solid", "svelte", "lit") */
  name: z.string(),
  /** Whether this integration is enabled */
  enabled: z.boolean().optional(),
  /** Custom options for the integration */
  options: z.record(z.string(), z.unknown()).optional(),
});

export type IntegrationConfigEntry = z.infer<typeof IntegrationConfigEntrySchema>;

/**
 * Avalon configuration file structure
 */
export const AvalonConfigSchema = z.object({
  /** List of integrations to register */
  integrations: z.array(IntegrationConfigEntrySchema).optional(),
  /** Auto-discover integrations from used components (default: true) */
  autoDiscoverIntegrations: z.boolean().optional(),
  /** Validate integrations on startup (default: true) */
  validateIntegrations: z.boolean().optional(),
  /** Show warnings for integration issues (default: true) */
  showWarnings: z.boolean().optional(),
});

export type AvalonConfig = z.infer<typeof AvalonConfigSchema>;

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
