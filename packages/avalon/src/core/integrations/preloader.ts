/**
 * Integration Preloader
 * 
 * Pre-loads framework integrations using native Deno imports BEFORE Vite's SSR context starts.
 * This is critical because once pages are loaded via Vite's ssrLoadModule, all subsequent
 * dynamic imports go through Vite's module resolution, which can't handle complex npm
 * dependency trees like linkedom -> htmlparser2 -> domhandler -> domelementtype.
 * 
 * By pre-loading integrations with native Deno imports, they're cached in the registry
 * and available when pages try to use them during SSR.
 */

import { registry } from "./registry.ts";
import type { Integration } from "@avalon/core";
import { statSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * List of known framework integrations to pre-load
 */
const KNOWN_INTEGRATIONS = [
  "preact",
  "react", 
  "vue",
  "svelte",
  "solid",
  "lit",
];

/**
 * Find the root of the Avalon monorepo by looking for packages/integrations
 */
function findMonorepoRoot(): string {
  let currentDir = process.cwd();
  
  // Walk up the directory tree looking for packages/integrations
  for (let i = 0; i < 10; i++) {
    try {
      const integrationsPath = join(currentDir, "packages", "integrations");
      const stat = statSync(integrationsPath);
      if (stat.isDirectory()) {
        return currentDir;
      }
    } catch {
      // Directory doesn't exist, try parent
    }
    
    const parent = dirname(currentDir);
    if (parent === currentDir) {
      // Reached root, stop
      break;
    }
    currentDir = parent;
  }
  
  // Fallback to cwd
  return process.cwd();
}

/**
 * Pre-load all known integrations using native Deno imports.
 * This must be called BEFORE Vite's SSR context is established.
 */
export async function preloadIntegrationsNative(): Promise<void> {
  const monorepoRoot = findMonorepoRoot();
  
  for (const name of KNOWN_INTEGRATIONS) {
    // Skip if already loaded
    if (registry.has(name)) {
      continue;
    }
    
    try {
      // Use absolute file:// URL with native import
      // This bypasses any Vite module resolution
      const integrationPath = join(monorepoRoot, "packages", "integrations", name, "mod.ts");
      const fileUrl = `file://${integrationPath}`;
      
      // Native dynamic import - not through Vite
      const module = await import(fileUrl);
      
      // Look for the integration export (e.g., preactIntegration, litIntegration)
      const integrationKey = `${name}Integration`;
      const integration = module[integrationKey] || module.default;
      
      if (integration && typeof integration === "object" && integration.name) {
        registry.register(integration as Integration);
      }
    } catch {
      // Don't fail startup if an integration can't be loaded
      // It might not be installed or needed
    }
  }
}

/**
 * Pre-load specific integrations by name
 */
export async function preloadSpecificIntegrations(names: string[]): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  const monorepoRoot = findMonorepoRoot();
  
  for (const name of names) {
    if (registry.has(name)) {
      results.set(name, true);
      continue;
    }
    
    try {
      const integrationPath = join(monorepoRoot, "packages", "integrations", name, "mod.ts");
      const fileUrl = `file://${integrationPath}`;
      const module = await import(fileUrl);
      
      const integrationKey = `${name}Integration`;
      const integration = module[integrationKey] || module.default;
      
      if (integration && typeof integration === "object" && integration.name) {
        registry.register(integration as Integration);
        results.set(name, true);
      } else {
        results.set(name, false);
      }
    } catch {
      results.set(name, false);
    }
  }
  
  return results;
}
