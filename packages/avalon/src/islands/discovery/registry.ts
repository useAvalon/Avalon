/**
 * Island Registry
 *
 * Central registry for all discovered islands with resolution capabilities.
 * Handles registration, resolution by name/namespace, and collision detection.
 */

import {
	discoverIslandDirectories,
	discoverIslandsInDirectory,
	getQualifiedIslandName,
	parseQualifiedIslandName,
} from "./scanner.ts";
import type {
	DiscoveredIsland,
	IslandCollision,
	IslandDirectory,
	IslandDiscoveryConfig,
} from "./types.ts";

/**
 * Central registry for all discovered islands.
 * Provides registration, resolution, and collision detection capabilities.
 */
export class IslandRegistry {
	/** All discovered islands indexed by qualified name */
	private _islands: Map<string, DiscoveredIsland> = new Map();

	/** All discovered island directories */
	private _directories: IslandDirectory[] = [];

	/** Index of islands by name (for fast lookup) */
	private _byName: Map<string, DiscoveredIsland[]> = new Map();

	/** Detected collisions */
	private _collisions: IslandCollision[] = [];

	/** Project root directory */
	private _projectRoot: string;

	/** Discovery configuration */
	private _config: IslandDiscoveryConfig;

	constructor(projectRoot: string, config: IslandDiscoveryConfig = {}) {
		this._projectRoot = projectRoot;
		this._config = config;
	}

	/**
	 * Get all discovered islands as a Map.
	 */
	get islands(): Map<string, DiscoveredIsland> {
		return new Map(this._islands);
	}

	/**
	 * Get all discovered island directories.
	 */
	get directories(): IslandDirectory[] {
		return [...this._directories];
	}

	/**
	 * Get all detected collisions.
	 */
	get collisions(): IslandCollision[] {
		return [...this._collisions];
	}

	/**
	 * Get the number of registered islands.
	 */
	get size(): number {
		return this._islands.size;
	}

	/**
	 * Register a discovered island in the registry.
	 * Updates the name index and detects collisions.
	 *
	 * @param island - The island to register
	 */
	register(island: DiscoveredIsland): void {
		const qualifiedName = getQualifiedIslandName(island);

		// Add to main registry
		this._islands.set(qualifiedName, island);

		// Update name index
		const existing = this._byName.get(island.name) || [];
		existing.push(island);
		this._byName.set(island.name, existing);
	}

	/**
	 * Resolve an island by name with optional namespace.
	 *
	 * Resolution priority:
	 * 1. Exact qualified name match (namespace/name)
	 * 2. Default islands directory (highest priority for unqualified names)
	 * 3. First match in alphabetical order by namespace
	 *
	 * @param name - Component name or qualified name (namespace/name)
	 * @param namespace - Optional namespace to narrow search
	 * @returns The resolved island or null if not found
	 */
	resolve(name: string, namespace?: string): DiscoveredIsland | null {
		// If namespace is provided, try exact match first
		if (namespace !== undefined) {
			const qualifiedName = namespace === "" ? name : `${namespace}/${name}`;
			const exact = this._islands.get(qualifiedName);
			if (exact) return exact;
		}

		// Check if name is already a qualified name
		if (name.includes("/")) {
			const exact = this._islands.get(name);
			if (exact) return exact;

			// Parse and try to resolve
			const { namespace: parsedNs, name: parsedName } = parseQualifiedIslandName(name);
			const qualifiedName = parsedNs === "" ? parsedName : `${parsedNs}/${parsedName}`;
			return this._islands.get(qualifiedName) || null;
		}

		// Find all islands with this name
		const matches = this._byName.get(name);
		if (!matches || matches.length === 0) {
			return null;
		}

		// If only one match, return it
		if (matches.length === 1) {
			return matches[0];
		}

		// Multiple matches - prioritize default directory
		const defaultMatch = matches.find((island) => island.directory.isDefault);
		if (defaultMatch) {
			return defaultMatch;
		}

		// Return first match (alphabetically by namespace due to sorting)
		return matches[0];
	}

	/**
	 * Find all islands matching a name.
	 * Useful for collision detection and disambiguation.
	 *
	 * @param name - Component name to search for
	 * @returns Array of all islands with this name
	 */
	findByName(name: string): DiscoveredIsland[] {
		return this._byName.get(name) || [];
	}

	/**
	 * Get the qualified name for an island.
	 *
	 * @param island - The island to get the qualified name for
	 * @returns The qualified name (namespace/name or just name for default)
	 */
	getQualifiedName(island: DiscoveredIsland): string {
		return getQualifiedIslandName(island);
	}

	/**
	 * Check if an island with the given name or qualified name exists.
	 *
	 * @param nameOrQualified - Component name or qualified name
	 * @returns True if the island exists
	 */
	has(nameOrQualified: string): boolean {
		// Check qualified name first
		if (this._islands.has(nameOrQualified)) {
			return true;
		}

		// Check by name
		return this._byName.has(nameOrQualified);
	}

	/**
	 * Detect naming collisions across all registered islands.
	 * A collision occurs when multiple islands share the same component name.
	 *
	 * @returns Array of detected collisions
	 */
	detectCollisions(): IslandCollision[] {
		const collisions: IslandCollision[] = [];

		for (const [name, islands] of this._byName) {
			if (islands.length > 1) {
				// Determine resolution strategy
				const hasDefault = islands.some((island) => island.directory.isDefault);
				const resolution: "namespace" | "priority" = hasDefault ? "priority" : "namespace";

				collisions.push({
					name,
					islands: [...islands],
					resolution,
				});
			}
		}

		this._collisions = collisions;
		return collisions;
	}

	/**
	 * Clear the registry and rebuild from filesystem.
	 * Discovers all island directories and their components.
	 */
	async rebuild(): Promise<void> {
		// Clear existing data
		this._islands.clear();
		this._byName.clear();
		this._directories = [];
		this._collisions = [];

		// Discover directories
		this._directories = await discoverIslandDirectories(this._projectRoot, this._config);

		// Discover and register islands from each directory
		for (const directory of this._directories) {
			const islands = await discoverIslandsInDirectory(directory, this._projectRoot);

			for (const island of islands) {
				this.register(island);
			}
		}

		// Detect collisions
		this.detectCollisions();
	}

	/**
	 * Get all islands as an array.
	 *
	 * @returns Array of all registered islands
	 */
	getAllIslands(): DiscoveredIsland[] {
		return Array.from(this._islands.values());
	}

	/**
	 * Get islands from a specific directory.
	 *
	 * @param directory - The directory to get islands from
	 * @returns Array of islands in the directory
	 */
	getIslandsInDirectory(directory: IslandDirectory): DiscoveredIsland[] {
		return this.getAllIslands().filter((island) => island.directory.path === directory.path);
	}

	/**
	 * Get islands by namespace.
	 *
	 * @param namespace - The namespace to filter by (empty string for default)
	 * @returns Array of islands in the namespace
	 */
	getIslandsByNamespace(namespace: string): DiscoveredIsland[] {
		return this.getAllIslands().filter((island) => island.namespace === namespace);
	}

	/**
	 * Remove an island from the registry.
	 *
	 * @param qualifiedName - The qualified name of the island to remove
	 * @returns True if the island was removed
	 */
	unregister(qualifiedName: string): boolean {
		const island = this._islands.get(qualifiedName);
		if (!island) {
			return false;
		}

		// Remove from main registry
		this._islands.delete(qualifiedName);

		// Remove from name index
		const byName = this._byName.get(island.name);
		if (byName) {
			const filtered = byName.filter((i) => getQualifiedIslandName(i) !== qualifiedName);
			if (filtered.length === 0) {
				this._byName.delete(island.name);
			} else {
				this._byName.set(island.name, filtered);
			}
		}

		return true;
	}

	/**
	 * Create a snapshot of the registry state.
	 * Useful for debugging and testing.
	 */
	toJSON(): {
		islands: Record<string, DiscoveredIsland>;
		directories: IslandDirectory[];
		collisions: IslandCollision[];
	} {
		return {
			islands: Object.fromEntries(this._islands),
			directories: this._directories,
			collisions: this._collisions,
		};
	}
}

/**
 * Create and initialize an island registry.
 * Convenience function that creates a registry and rebuilds it.
 *
 * @param projectRoot - The root directory of the project
 * @param config - Optional configuration for discovery
 * @returns Initialized island registry
 */
export async function createIslandRegistry(
	projectRoot: string,
	config: IslandDiscoveryConfig = {},
): Promise<IslandRegistry> {
	const registry = new IslandRegistry(projectRoot, config);
	await registry.rebuild();
	return registry;
}
