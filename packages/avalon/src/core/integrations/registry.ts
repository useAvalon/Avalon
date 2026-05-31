import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Integration } from "@useavalon/core";

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
	private readonly integrations = new Map<string, Integration>();
	private readonly loadingPromises = new Map<string, Promise<Integration>>();

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

	private async loadIntegration(name: string): Promise<Integration> {
		const integrationKey = `${name}Integration`;

		// 1. Try loading from the installed npm package first (@useavalon/<name>)
		try {
			const packageName = `@useavalon/${name}`;
			const module = await import(/* @vite-ignore */ packageName);
			const integration = module[integrationKey] || module.default;
			if (integration) return integration as Integration;
		} catch {
			// Package not installed or import failed — try monorepo path
		}

		// 2. Monorepo fallback: resolve via packages/integrations/<name>/mod.ts
		try {
			const monorepoRoot = findMonorepoRoot();
			const integrationPath = join(monorepoRoot, "packages", "integrations", name, "mod.ts");
			const fileUrl = `file://${integrationPath}`;
			const module = await import(/* @vite-ignore */ fileUrl);
			const integration = module[integrationKey] || module.default;
			if (integration) return integration as Integration;
		} catch {
			// Monorepo path also failed
		}

		throw new Error(
			`Failed to load integration for framework '${name}'. ` +
				`Make sure @useavalon/${name} is installed.\n` +
				`Install it with: bun add @useavalon/${name}`,
		);
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

globalThis.__avalonIntegrationRegistry ??= new IntegrationRegistry();

export const registry = globalThis.__avalonIntegrationRegistry;
