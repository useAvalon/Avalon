import type { Integration } from "../../../../integrations/shared/types.ts";
import { dirname, join } from "node:path";
import { statSync } from "node:fs";

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
 * IntegrationRegistry manages loaded framework integrations.
 * It provides registration, retrieval, and dynamic loading of integrations.
 */
export class IntegrationRegistry {
  private integrations = new Map<string, Integration>();
  private loadingPromises = new Map<string, Promise<Integration>>();

  /**
   * Register an integration instance
   */
  register(integration: Integration): void {
    if (!integration.name) {
      throw new Error("Integration must have a name");
    }
    this.integrations.set(integration.name, integration);
  }

  /**
   * Get a registered integration by name
   */
  get(name: string): Integration | undefined {
    return this.integrations.get(name);
  }

  /**
   * Check if an integration is registered
   */
  has(name: string): boolean {
    return this.integrations.has(name);
  }

  /**
   * Dynamically load an integration by name
   * Returns cached integration if already loaded
   */
  async load(name: string): Promise<Integration> {
    // Check if already loaded
    const existing = this.integrations.get(name);
    if (existing) {
      return existing;
    }

    // Check if currently loading (prevent duplicate loads)
    const loadingPromise = this.loadingPromises.get(name);
    if (loadingPromise) {
      return loadingPromise;
    }

    // Start loading
    const promise = this.loadIntegration(name);
    this.loadingPromises.set(name, promise);

    try {
      const integration = await promise;
      this.register(integration);
      return integration;
    } finally {
      this.loadingPromises.delete(name);
    }
  }

  /**
   * Internal method to load integration module
   * Note: In development mode, integrations should be pre-loaded via preloader.ts
   * before Vite's SSR context starts. This method is a fallback for production
   * or when integrations weren't pre-loaded.
   */
  private async loadIntegration(name: string): Promise<Integration> {
    try {
      // Use absolute file:// URL to bypass Vite's module resolution
      // This ensures we use Deno's native import which handles npm: specifiers correctly
      const monorepoRoot = findMonorepoRoot();
      const integrationPath = join(monorepoRoot, "packages", "integrations", name, "mod.ts");
      const fileUrl = `file://${integrationPath}`;
      
      // Dynamic import with file:// URL bypasses Vite's SSR module loader
      const module = await import(fileUrl);
      
      // Look for the integration export (e.g., preactIntegration)
      const integrationKey = `${name}Integration`;
      const integration = module[integrationKey] || module.default;

      if (!integration) {
        throw new Error(
          `Integration module '${name}' does not export '${integrationKey}' or a default export`
        );
      }

      return integration as Integration;
    } catch (error) {
      // Check if this is a Vite SSR context issue
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isViteIssue = errorMessage.includes('ERR_UNSUPPORTED_ESM_URL_SCHEME') ||
                          errorMessage.includes('Only file and data URLs are supported');
      
      if (isViteIssue) {
        throw new Error(
          `Integration '${name}' could not be loaded within Vite's SSR context. ` +
          `This usually means the integration wasn't pre-loaded at server startup. ` +
          `Make sure preloadIntegrationsNative() is called before Vite server starts.`,
          { cause: error }
        );
      }
      
      throw new Error(
        `Failed to load integration for framework '${name}'. ` +
        `Make sure @avalon/${name} is installed.\n` +
        `Install it with: bun add @avalon/${name}`,
        { cause: error }
      );
    }
  }

  /**
   * Get all registered integrations
   */
  getAll(): Integration[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Get all registered integration names
   */
  getAllNames(): string[] {
    return Array.from(this.integrations.keys());
  }

  /**
   * Unregister an integration
   */
  unregister(name: string): boolean {
    return this.integrations.delete(name);
  }

  /**
   * Clear all registered integrations
   */
  clear(): void {
    this.integrations.clear();
    this.loadingPromises.clear();
  }

  /**
   * Get the count of registered integrations
   */
  get size(): number {
    return this.integrations.size;
  }
}

// Global singleton registry instance
// Use globalThis to ensure the registry is shared across all module contexts
// This is important because Vite's ssrLoadModule creates new module contexts
declare global {
  var __avalonIntegrationRegistry: IntegrationRegistry | undefined;
}

if (!globalThis.__avalonIntegrationRegistry) {
  globalThis.__avalonIntegrationRegistry = new IntegrationRegistry();
}

export const registry = globalThis.__avalonIntegrationRegistry;
