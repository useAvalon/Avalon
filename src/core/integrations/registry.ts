import type { Integration } from "../../integrations/shared/types.ts";

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
   */
  private async loadIntegration(name: string): Promise<Integration> {
    try {
      // Try to import the integration module
      const module = await import(`../../integrations/${name}/mod.ts`);
      
      // Look for the integration export (e.g., preactIntegration)
      const integrationKey = `${name}Integration`;
      const integration = module[integrationKey] || module.default;

      if (!integration) {
        throw new Error(
          `Integration module '${name}' does not export '${integrationKey}' or a default export`
        );
      }

      return integration;
    } catch (error) {
      throw new Error(
        `Failed to load integration '${name}'. ` +
        `Make sure @avalon/integration-${name} is installed and properly configured.\n` +
        `Error: ${error instanceof Error ? error.message : String(error)}`,
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
export const registry = new IntegrationRegistry();
