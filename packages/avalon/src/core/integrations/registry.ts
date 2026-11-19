import { statSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
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

function isFile(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

const MODULE_NOT_FOUND_CODES = new Set(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"]);

/** Specifier named in a "Cannot find module/package '<x>'" message (Node and Bun). */
const NOT_FOUND_SPECIFIER_RE = /Cannot find (?:module|package) ['"]([^'"]+)['"]/;

/**
 * True when `error` says `specifier` itself cannot be resolved. Only the
 * specifier in the "Cannot find ..." clause counts: a missing transitive
 * dependency (for example `react-dom` under `@useavalon/react`) names that
 * dependency there, and the importer named later in the message is ignored.
 */
export function isModuleNotFound(error: unknown, specifier: string): boolean {
	if (!(error instanceof Error)) return false;
	const missing = NOT_FOUND_SPECIFIER_RE.exec(error.message)?.[1];
	if (missing !== undefined) return missing === specifier;
	const code = (error as Error & { code?: unknown }).code;
	if (typeof code !== "string" || !MODULE_NOT_FOUND_CODES.has(code)) return false;
	return error.message.includes(`'${specifier}'`) || error.message.includes(`"${specifier}"`);
}

/**
 * Error for a failed integration import. Suggests installing the package only
 * when the package itself is missing; any other failure keeps the original
 * error as `cause` and repeats its message.
 */
export function integrationLoadError(name: string, packageName: string, cause: unknown): Error {
	if (isModuleNotFound(cause, packageName)) {
		return new Error(
			`Failed to load integration for framework '${name}': ${packageName} is not installed.\n` +
				`Install it with: bun add ${packageName}`,
			{ cause },
		);
	}
	return new Error(
		`Failed to load integration for framework '${name}': importing ${packageName} threw: ${errorMessage(cause)}`,
		{ cause },
	);
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
		const packageName = `@useavalon/${name}`;

		// 1. Installed npm package (@useavalon/<name>)
		let packageError: unknown;
		try {
			const module = await import(/* @vite-ignore */ packageName);
			const integration = module[integrationKey] || module.default;
			if (integration) return integration as Integration;
			packageError = new Error(
				`${packageName} does not export '${integrationKey}' or a default export`,
			);
		} catch (error) {
			packageError = error;
		}

		// 2. Monorepo fallback: packages/integrations/<name>/mod.ts
		const integrationPath = join(findMonorepoRoot(), "packages", "integrations", name, "mod.ts");
		if (isModuleNotFound(packageError, packageName) && isFile(integrationPath)) {
			try {
				const module = await import(/* @vite-ignore */ pathToFileURL(integrationPath).href);
				const integration = module[integrationKey] || module.default;
				if (integration) return integration as Integration;
			} catch (error) {
				throw new Error(
					`Failed to load integration '${name}' from ${integrationPath}: ${errorMessage(error)}`,
					{ cause: error },
				);
			}
		}

		throw integrationLoadError(name, packageName, packageError);
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
