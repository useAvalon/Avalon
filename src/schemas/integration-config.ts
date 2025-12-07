/**
 * Schema and types for Avalon integration configuration
 */

/**
 * Configuration for a single integration
 */
export interface IntegrationConfigEntry {
  /** Name of the integration (e.g., "preact", "vue", "solid", "svelte") */
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
 * Default configuration values
 */
export const defaultConfig: Required<AvalonConfig> = {
  integrations: [],
  autoDiscoverIntegrations: true,
  validateIntegrations: true,
  showWarnings: true,
};

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: AvalonConfig): Required<AvalonConfig> {
  return {
    integrations: userConfig.integrations ?? defaultConfig.integrations,
    autoDiscoverIntegrations: userConfig.autoDiscoverIntegrations ?? defaultConfig.autoDiscoverIntegrations,
    validateIntegrations: userConfig.validateIntegrations ?? defaultConfig.validateIntegrations,
    showWarnings: userConfig.showWarnings ?? defaultConfig.showWarnings,
  };
}
