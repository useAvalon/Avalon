/**
 * Integration system exports
 * Central export point for all integration-related functionality
 */

// Registry
export { IntegrationRegistry, registry } from "./registry.ts";

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
