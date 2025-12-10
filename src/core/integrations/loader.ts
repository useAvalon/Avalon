import { registry } from "./registry.ts";
import type { Integration } from "../../integrations/shared/types.ts";

/**
 * Cache for loaded integrations to avoid repeated dynamic imports
 */
const integrationCache = new Map<string, Integration>();

/**
 * Load an integration by name, using cache if available
 */
export async function loadIntegration(framework: string): Promise<Integration> {
  // Check cache first
  if (integrationCache.has(framework)) {
    return integrationCache.get(framework)!;
  }

  // Load from registry (which handles dynamic imports)
  const integration = await registry.load(framework);
  
  // Cache the loaded integration
  integrationCache.set(framework, integration);
  
  return integration;
}

/**
 * Detect framework from file path and load the appropriate integration
 */
export async function detectAndLoadIntegration(src: string): Promise<Integration> {
  const framework = detectFrameworkFromPath(src);
  return await loadIntegration(framework);
}

/**
 * Detect framework from file path based on extension and naming conventions
 */
export function detectFrameworkFromPath(src: string) {
  // Vue files
  if (src.endsWith(".vue")) {
    return "vue";
  }
  
  // Svelte files
  if (src.endsWith(".svelte")) {
    return "svelte";
  }
  
  // Solid files (convention: .solid.tsx or .solid.jsx)
  if (src.includes(".solid.")) {
    return "solid";
  }
  
  // Default to Preact for .tsx and .jsx files
  return "preact";
}

/**
 * Detect framework from file content by analyzing imports and patterns
 */
export function detectFrameworkFromContent(
  src: string,
  content?: string
) {
  // First try path-based detection
  const pathFramework = detectFrameworkFromPath(src);
  
  // If we have a definitive answer from path, use it
  if (pathFramework !== "preact" || !content) {
    return pathFramework;
  }
  
  // For .tsx/.jsx files, analyze content to distinguish between Preact and Solid
  if (content.includes("solid-js")) {
    return "solid";
  }
  
  if (content.includes("preact")) {
    return "preact";
  }
  
  // Default to Preact
  return "preact";
}

/**
 * Preload integrations for the given frameworks
 * Useful for warming up the cache during build or startup
 */
export async function preloadIntegrations(frameworks: string[]) {
  await Promise.all(
    frameworks.map(framework => loadIntegration(framework))
  );
}

/**
 * Get all currently loaded integrations
 */
export function getLoadedIntegrations() {
  return Array.from(integrationCache.values());
}

/**
 * Clear the integration cache
 * Useful for testing or hot module replacement
 */
export function clearIntegrationCache() {
  integrationCache.clear();
}

/**
 * Check if an integration is loaded in cache
 */
export function isIntegrationLoaded(framework: string) {
  return integrationCache.has(framework);
}
