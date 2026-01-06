/**
 * Integration system exports
 * Central export point for all integration-related functionality
 */

// Registry
export { IntegrationRegistry, registry } from "./registry.ts";

// Preloader (for loading integrations before Vite SSR context)
export {
  preloadIntegrationsNative,
  preloadSpecificIntegrations,
} from "./preloader.ts";

// Loader
export {
  loadIntegration,
  detectAndLoadIntegration,
  detectFrameworkFromPath,
  detectFrameworkFromContent,
  preloadIntegrations,
  getLoadedIntegrations,
  clearIntegrationCache,
  isIntegrationLoaded,
} from "./loader.ts";

// Validator
export {
  validateIntegration,
  validateIntegrationConfig,
  validateIntegrations,
  assertValidIntegration,
  formatValidationResult,
  type ValidationResult,
} from "./validator.ts";

// Configuration
export {
  loadConfig,
  generateDefaultConfig,
  type ConfigLoadResult,
} from "./config-loader.ts";

// Startup
export {
  initializeIntegrations,
  listIntegrations,
  formatInitializationResult,
  formatIntegrationList,
  getMissingIntegrationError,
  getMisconfiguredIntegrationError,
  type InitializationResult,
  type IntegrationInfo,
} from "./startup.ts";

// CLI
export * as cli from "./cli.ts";
