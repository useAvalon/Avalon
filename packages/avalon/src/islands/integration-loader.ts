import { registry } from "../core/integrations/registry.ts";
import { getMissingIntegrationError } from "../core/integrations/startup.ts";
import type { Integration } from "../../../integrations/shared/types.ts";

/**
 * Cache for loaded integrations to avoid repeated lookups
 */
const frameworkCache = new Map<string, Integration>();

// Pattern to match nested island paths like /modules/*/islands/ or /src/*/islands/
const NESTED_ISLANDS_PATTERN = /\/(?:src\/)?(?:modules\/)?([^/]+\/)*islands\//;

/**
 * Load an integration by framework name
 * Uses cache to avoid repeated dynamic imports
 */
export async function loadIntegration(framework: string) {
  // Check local cache first
  if (frameworkCache.has(framework)) {
    return frameworkCache.get(framework)!;
  }

  // Check if already loaded in registry (e.g., by preloader)
  // This is important because integrations are pre-loaded before Vite SSR context
  // to avoid dependency resolution issues
  const registrySize = registry.size;
  const hasInRegistry = registry.has(framework);
  
  // Debug logging
  console.log(`🔍 [integration-loader] Loading ${framework}: registrySize=${registrySize}, hasInRegistry=${hasInRegistry}`);
  
  if (hasInRegistry) {
    const integration = registry.get(framework)!;
    frameworkCache.set(framework, integration);
    console.log(`🔍 [integration-loader] Found ${framework} in registry`);
    return integration;
  }

  console.log(`🔍 [integration-loader] ${framework} not in registry, trying to load...`);

  try {
    // Load from registry (this will try to dynamically import)
    const integration = await registry.load(framework);
    
    // Cache the loaded integration
    frameworkCache.set(framework, integration);
    
    return integration;
  } catch (error) {
    // Provide helpful error message
    const helpfulError = new Error(
      getMissingIntegrationError(framework),
      { cause: error }
    );
    throw helpfulError;
  }
}

/**
 * Detect framework from file path and load the appropriate integration
 */
export async function detectAndLoadIntegration(src: string) {
  const framework = detectFrameworkFromPath(src);
  return await loadIntegration(framework);
}

/**
 * Detect framework from file path based on extension and naming conventions.
 * 
 * Updated to support nested island paths like:
 * - /src/islands/Counter.tsx
 * - /src/modules/auth/islands/Counter.tsx
 * - /modules/dashboard/islands/Chart.vue
 * 
 * @param src - The source path to detect framework from
 * @returns The detected framework name
 */
export function detectFrameworkFromPath(src: string) {
  // Normalize path separators
  const normalizedSrc = src.replace(/\\/g, "/");
  
  // Vue files (.vue)
  if (normalizedSrc.endsWith(".vue")) {
    return "vue";
  }
  
  // Svelte files (.svelte)
  if (normalizedSrc.endsWith(".svelte")) {
    return "svelte";
  }
  
  // Solid files (convention: .solid.tsx or .solid.jsx)
  if (normalizedSrc.includes(".solid.")) {
    return "solid";
  }
  
  // React files (convention: .react.tsx or .react.jsx)
  if (normalizedSrc.includes(".react.")) {
    return "react";
  }
  
  // Lit files (convention: .lit.ts or .lit.js, or files starting with "Lit")
  if (normalizedSrc.includes(".lit.")) {
    return "lit";
  }
  
  // Lit files by naming convention (LitComponent.ts)
  const fileName = normalizedSrc.split("/").pop() || "";
  if (fileName.startsWith("Lit") && (normalizedSrc.endsWith(".ts") || normalizedSrc.endsWith(".js"))) {
    return "lit";
  }
  
  // Check if path is in any islands directory (including nested)
  // Plain .ts/.js files in islands are likely Lit components (Lit doesn't use JSX)
  if (isInIslandsDirectory(normalizedSrc) && (normalizedSrc.endsWith(".ts") || normalizedSrc.endsWith(".js"))) {
    return "lit";
  }
  
  // Default to Preact for .tsx and .jsx files
  if (normalizedSrc.endsWith(".tsx") || normalizedSrc.endsWith(".jsx")) {
    return "preact";
  }
  
  // Fallback to Preact
  return "preact";
}

/**
 * Check if a path is within any islands directory (including nested).
 * 
 * Matches patterns like:
 * - /islands/
 * - /src/islands/
 * - /src/modules/auth/islands/
 * - /modules/dashboard/islands/
 * - /src/features/user/islands/
 * 
 * @param path - The path to check
 * @returns True if the path is in an islands directory
 */
export function isInIslandsDirectory(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  
  // Check for /islands/ anywhere in the path
  return normalized.includes("/islands/");
}

/**
 * Check if a path is a nested island path (not in default /src/islands/).
 * 
 * @param path - The path to check
 * @returns True if the path is a nested island path
 */
export function isNestedIslandPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  
  // Check if it contains /islands/ but not at the root level
  if (!normalized.includes("/islands/")) {
    return false;
  }
  
  // Default path patterns
  const defaultPatterns = [
    /^\/islands\//,
    /^\/src\/islands\//,
    /^src\/islands\//,
    /^islands\//,
  ];
  
  for (const pattern of defaultPatterns) {
    if (pattern.test(normalized)) {
      return false;
    }
  }
  
  // If it contains /islands/ but doesn't match default patterns, it's nested
  return true;
}

/**
 * Extract the namespace from a nested island path.
 * 
 * Examples:
 * - /src/modules/auth/islands/Counter.tsx -> "modules/auth"
 * - /src/features/user/islands/Profile.tsx -> "features/user"
 * - /src/islands/Button.tsx -> ""
 * 
 * @param path - The path to extract namespace from
 * @returns The namespace or empty string for default islands
 */
export function extractNamespaceFromPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  
  // Match patterns like /src/modules/auth/islands/ or /modules/auth/islands/
  const match = normalized.match(/(?:\/src)?\/(.+?)\/islands\//);
  if (match) {
    return match[1];
  }
  
  return "";
}

/**
 * Detect framework from file content by analyzing imports and patterns.
 * 
 * Updated to support nested island paths.
 * 
 * @param src - The source path
 * @param content - The file content to analyze
 * @returns The detected framework name
 */
export function detectFrameworkFromContent(
  src: string,
  content: string
) {
  // First try path-based detection
  const pathFramework = detectFrameworkFromPath(src);
  
  // If we have a definitive answer from path (not default), use it
  if (pathFramework === "vue" || pathFramework === "svelte" || pathFramework === "react" || pathFramework === "lit") {
    return pathFramework;
  }
  
  // For .tsx/.jsx files, analyze content to distinguish between frameworks
  
  // Check for React imports (must check before Preact since they share hooks)
  if (
    content.includes("from 'react'") ||
    content.includes('from "react"') ||
    content.includes("from 'react-dom'") ||
    content.includes('from "react-dom"') ||
    content.includes('"use client"') ||
    content.includes("'use client'") ||
    content.includes('"use server"') ||
    content.includes("'use server'")
  ) {
    return "react";
  }
  
  // Check for Lit imports
  if (
    content.includes("from 'lit'") ||
    content.includes('from "lit"') ||
    content.includes("@lit-labs/ssr") ||
    content.includes("LitElement") ||
    content.includes("@customElement")
  ) {
    return "lit";
  }
  
  // Check for Solid imports
  if (
    content.includes("solid-js") ||
    content.includes("from 'solid-js'") ||
    content.includes('from "solid-js"')
  ) {
    return "solid";
  }
  
  // Check for Preact imports
  if (
    content.includes("from 'preact'") ||
    content.includes('from "preact"') ||
    content.includes("preact/hooks")
  ) {
    return "preact";
  }
  
  // Check for Lit-specific patterns
  if (
    content.includes("extends LitElement") ||
    content.includes("@property") ||
    content.includes("@state") ||
    content.includes("html`") ||
    content.includes("css`")
  ) {
    return "lit";
  }
  
  // Check for Solid-specific patterns
  if (
    content.includes("createSignal") ||
    content.includes("createEffect") ||
    content.includes("createMemo")
  ) {
    return "solid";
  }
  
  // Check for React/Preact-specific patterns (hooks)
  // Note: React and Preact share the same hooks API, so we default to Preact
  // unless React imports are explicitly detected above
  if (
    content.includes("useState") ||
    content.includes("useEffect") ||
    content.includes("useRef")
  ) {
    return "preact";
  }
  
  // Default to path-based detection
  return pathFramework;
}

/**
 * Get integration for a specific framework, with error handling
 */
export async function getIntegration(framework: string) {
  try {
    return await loadIntegration(framework);
  } catch (error) {
    console.error(`Failed to load integration for ${framework}:`, error);
    return null;
  }
}

/**
 * Check if an integration is available for a framework
 */
export async function hasIntegration(framework: string) {
  try {
    await loadIntegration(framework);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all loaded integrations from cache
 */
export function getLoadedIntegrations() {
  return Array.from(frameworkCache.values());
}

/**
 * Get all loaded framework names from cache
 */
export function getLoadedFrameworks() {
  return Array.from(frameworkCache.keys());
}

/**
 * Clear the integration cache
 * Useful for testing or hot module replacement
 */
export function clearIntegrationCache() {
  frameworkCache.clear();
}

/**
 * Check if an integration is loaded in cache
 */
export function isIntegrationLoaded(framework: string) {
  return frameworkCache.has(framework);
}

/**
 * Preload integrations for multiple frameworks
 * Useful for warming up the cache during build or startup
 */
export async function preloadIntegrations(frameworks: string[]) {
  const results = await Promise.allSettled(
    frameworks.map(framework => loadIntegration(framework))
  );
  
  // Log any failures
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(
        `Failed to preload integration '${frameworks[index]}':`,
        result.reason
      );
    }
  });
}
