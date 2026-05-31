/**
 * Island Resolver
 *
 * Handles runtime resolution of island references to actual file paths.
 * Supports priority-based resolution with default /src/islands/ having highest priority.
 *
 * ## Resolution Order
 *
 * When resolving an island reference, the resolver follows this priority order:
 *
 * 1. **Explicit path-based references** (e.g., "src/modules/auth/islands/Counter")
 *    - Full path to the island file
 *    - Always unambiguous
 *
 * 2. **Qualified name matches** (e.g., "modules/auth/Counter")
 *    - Namespace/name format
 *    - Namespace is derived from directory path between src/ and islands/
 *
 * 3. **Default /src/islands/ directory**
 *    - Highest priority for simple names (backward compatibility)
 *    - If an island exists in both default and nested directories,
 *      the default directory wins
 *
 * 4. **Nested directories in alphabetical order**
 *    - When not found in default directory
 *    - Sorted alphabetically by namespace
 *
 * ## Namespace Conventions
 *
 * - src/islands/Counter.tsx -> namespace: "", qualified: "Counter"
 * - src/modules/auth/islands/LoginForm.tsx -> namespace: "modules/auth", qualified: "modules/auth/LoginForm"
 * - src/features/checkout/islands/PaymentForm.tsx -> namespace: "features/checkout", qualified: "features/checkout/PaymentForm"
 *
 * ## Handling Collisions
 *
 * When multiple islands share the same name:
 * - Use qualified names to disambiguate
 * - The resolver returns `ambiguous: true` with alternatives
 * - Default directory always has priority for simple name resolution
 */

import { dirname, relative, resolve } from "node:path";
import type { IslandRegistry } from "./registry.ts";
import { getQualifiedIslandName, parseQualifiedIslandName } from "./scanner.ts";
import type { DiscoveredIsland, IslandDirectory } from "./types.ts";

/**
 * Result of resolving an island reference
 */
export interface ResolutionResult {
	/** Resolved island */
	island: DiscoveredIsland;
	/** Import path for the island */
	importPath: string;
	/** Whether resolution was ambiguous (multiple matches found) */
	ambiguous: boolean;
	/** Alternative matches if ambiguous */
	alternatives?: DiscoveredIsland[];
}

/**
 * Options for import path generation
 */
export interface ImportPathOptions {
	/** Whether generating for development (true) or production (false) */
	isDevelopment?: boolean;
	/** Base path for imports (e.g., "/@fs/" for dev, "/" for prod) */
	basePath?: string;
	/** Project root directory */
	projectRoot?: string;
	/** Whether to use absolute paths */
	absolute?: boolean;
}

/**
 * Default options for import path generation
 */
const DEFAULT_IMPORT_OPTIONS: Required<ImportPathOptions> = {
	isDevelopment: true,
	basePath: "/",
	projectRoot: "",
	absolute: false,
};

/**
 * Island Resolver class
 *
 * Resolves island references to actual file paths with priority-based resolution.
 * Default /src/islands/ directory has highest priority for backward compatibility.
 */
export class IslandResolver {
	private _registry: IslandRegistry;
	private _projectRoot: string;

	constructor(registry: IslandRegistry, projectRoot: string) {
		this._registry = registry;
		this._projectRoot = projectRoot;
	}

	/**
	 * Get the underlying registry
	 */
	get registry(): IslandRegistry {
		return this._registry;
	}

	/**
	 * Get the project root
	 */
	get projectRoot(): string {
		return this._projectRoot;
	}

	/**
	 * Resolve an island reference to a file path.
	 *
	 * Resolution priority:
	 * 1. Explicit path-based reference (e.g., "modules/auth/Counter")
	 * 2. Qualified name match (namespace/name)
	 * 3. Default islands directory (highest priority for unqualified names)
	 * 4. First match in alphabetical order by namespace
	 *
	 * @param reference - Island reference (name, qualified name, or path)
	 * @returns Resolution result or null if not found
	 */
	resolve(reference: string): ResolutionResult | null {
		// Normalize the reference
		const normalizedRef = this.normalizeReference(reference);

		// Try to resolve as explicit path first
		const explicitResult = this.resolveExplicitPath(normalizedRef);
		if (explicitResult) {
			return explicitResult;
		}

		// Try to resolve as qualified name (namespace/name)
		if (normalizedRef.includes("/")) {
			const qualifiedResult = this.resolveQualifiedName(normalizedRef);
			if (qualifiedResult) {
				return qualifiedResult;
			}
		}

		// Resolve by name with priority-based resolution
		return this.resolveByName(normalizedRef);
	}

	/**
	 * Normalize an island reference for consistent resolution.
	 */
	private normalizeReference(reference: string): string {
		// Remove leading/trailing slashes and whitespace
		let normalized = reference.trim().replace(/^\/+|\/+$/g, "");

		// Normalize path separators
		normalized = normalized.replace(/\\/g, "/");

		// Remove file extension if present
		const extensionPatterns = [
			/\.solid\.(tsx|jsx)$/,
			/\.react\.(tsx|jsx)$/,
			/\.lit\.(ts|js)$/,
			/\.preact\.(tsx|jsx)$/,
			/\.(tsx|ts|jsx|js|vue|svelte)$/,
		];

		for (const pattern of extensionPatterns) {
			if (pattern.test(normalized)) {
				normalized = normalized.replace(pattern, "");
				break;
			}
		}

		return normalized;
	}

	/**
	 * Resolve an explicit path-based reference.
	 * Handles references like "src/modules/auth/islands/Counter"
	 */
	private resolveExplicitPath(reference: string): ResolutionResult | null {
		// Check if reference looks like a path (contains "islands/")
		if (!reference.includes("islands/")) {
			return null;
		}

		// Try to find an island whose relative path matches
		const allIslands = this._registry.getAllIslands();

		for (const island of allIslands) {
			// Check if the reference matches the relative path (without extension)
			const islandPathWithoutExt = island.relativePath.replace(/\.[^.]+$/, "");

			// Handle framework-specific extensions
			const frameworkPatterns = [/\.solid$/, /\.react$/, /\.lit$/, /\.preact$/];
			let cleanIslandPath = islandPathWithoutExt;
			for (const pattern of frameworkPatterns) {
				cleanIslandPath = cleanIslandPath.replace(pattern, "");
			}

			if (
				cleanIslandPath === reference ||
				cleanIslandPath.endsWith("/" + reference) ||
				islandPathWithoutExt === reference ||
				islandPathWithoutExt.endsWith("/" + reference)
			) {
				return {
					island,
					importPath: this.generateImportPath(island),
					ambiguous: false,
				};
			}
		}

		return null;
	}

	/**
	 * Resolve a qualified name (namespace/name).
	 */
	private resolveQualifiedName(qualifiedName: string): ResolutionResult | null {
		const { namespace, name } = parseQualifiedIslandName(qualifiedName);
		const island = this._registry.resolve(name, namespace);

		if (!island) {
			return null;
		}

		// Check if there are other islands with the same name
		const allMatches = this._registry.findByName(name);
		const ambiguous = allMatches.length > 1;

		return {
			island,
			importPath: this.generateImportPath(island),
			ambiguous,
			alternatives: ambiguous ? allMatches.filter((i) => i !== island) : undefined,
		};
	}

	/**
	 * Resolve by name with priority-based resolution.
	 * Default /src/islands/ has highest priority.
	 */
	private resolveByName(name: string): ResolutionResult | null {
		const matches = this._registry.findByName(name);

		if (matches.length === 0) {
			return null;
		}

		// Sort matches by priority:
		// 1. Default directory first
		// 2. Then alphabetically by namespace
		const sortedMatches = [...matches].sort((a, b) => {
			if (a.directory.isDefault && !b.directory.isDefault) return -1;
			if (!a.directory.isDefault && b.directory.isDefault) return 1;
			return a.namespace.localeCompare(b.namespace);
		});

		const island = sortedMatches[0];
		const ambiguous = matches.length > 1;

		return {
			island,
			importPath: this.generateImportPath(island),
			ambiguous,
			alternatives: ambiguous ? sortedMatches.slice(1) : undefined,
		};
	}

	/**
	 * Generate an import path for an island.
	 * Handles both development and production paths.
	 *
	 * @param island - The island to generate an import path for
	 * @param options - Options for path generation
	 * @returns The import path string
	 */
	generateImportPath(island: DiscoveredIsland, options: ImportPathOptions = {}): string {
		const opts = { ...DEFAULT_IMPORT_OPTIONS, ...options };
		const projectRoot = opts.projectRoot || this._projectRoot;

		if (opts.absolute) {
			// Return absolute file path
			return island.filePath;
		}

		if (opts.isDevelopment) {
			// Development: use relative path from project root with leading slash
			const relativePath = relative(projectRoot, island.filePath);
			const normalizedPath = relativePath.replace(/\\/g, "/");
			return `${opts.basePath}${normalizedPath}`;
		}

		// Production: use the relative path for bundled imports
		// The build system will handle the actual resolution
		return `${opts.basePath}${island.relativePath}`;
	}

	/**
	 * Generate a qualified import path for disambiguation.
	 * Always includes the namespace for clarity.
	 *
	 * @param island - The island to generate a path for
	 * @returns Qualified import path
	 */
	generateQualifiedImportPath(island: DiscoveredIsland): string {
		const qualifiedName = getQualifiedIslandName(island);
		return qualifiedName;
	}

	/**
	 * Get the resolution order documentation.
	 * Describes how islands are resolved when multiple matches exist.
	 *
	 * @returns Array of resolution order descriptions
	 */
	getResolutionOrder(): string[] {
		const directories = this._registry.directories;

		return [
			"Island Resolution Order:",
			"1. Explicit path-based references (e.g., 'src/modules/auth/islands/Counter')",
			"2. Qualified name matches (e.g., 'modules/auth/Counter')",
			"3. Default /src/islands/ directory (highest priority for unqualified names)",
			"4. Nested directories in alphabetical order by namespace",
			"",
			"Discovered directories (in priority order):",
			...directories.map(
				(dir, index) => `  ${index + 1}. ${dir.relativePath}${dir.isDefault ? " (default)" : ""}`,
			),
		];
	}

	/**
	 * Check if a reference would resolve ambiguously.
	 *
	 * @param reference - Island reference to check
	 * @returns True if the reference matches multiple islands
	 */
	isAmbiguous(reference: string): boolean {
		const result = this.resolve(reference);
		return result?.ambiguous ?? false;
	}

	/**
	 * Get all possible resolutions for a reference.
	 * Useful for providing suggestions when resolution is ambiguous.
	 *
	 * @param reference - Island reference
	 * @returns Array of all matching islands
	 */
	getAllMatches(reference: string): DiscoveredIsland[] {
		const normalized = this.normalizeReference(reference);

		// If it's a qualified name, return exact match only
		if (normalized.includes("/") && !normalized.includes("islands/")) {
			const { namespace, name } = parseQualifiedIslandName(normalized);
			const island = this._registry.resolve(name, namespace);
			return island ? [island] : [];
		}

		// For simple names, return all matches
		return this._registry.findByName(normalized);
	}

	/**
	 * Suggest qualified names for disambiguation.
	 *
	 * @param name - Component name with multiple matches
	 * @returns Array of qualified name suggestions
	 */
	suggestQualifiedNames(name: string): string[] {
		const matches = this._registry.findByName(name);
		return matches.map((island) => getQualifiedIslandName(island));
	}

	/**
	 * Resolve an island and throw if not found.
	 *
	 * @param reference - Island reference
	 * @throws Error if island is not found
	 * @returns Resolution result
	 */
	resolveOrThrow(reference: string): ResolutionResult {
		const result = this.resolve(reference);

		if (!result) {
			const suggestions = this.findSimilarNames(reference);
			let message = `Island not found: "${reference}"`;

			if (suggestions.length > 0) {
				message += `\n\nDid you mean one of these?\n${suggestions.map((s) => `  - ${s}`).join("\n")}`;
			}

			throw new Error(message);
		}

		return result;
	}

	/**
	 * Find similar island names for suggestions.
	 * Uses simple string similarity for fuzzy matching.
	 */
	private findSimilarNames(reference: string): string[] {
		const allIslands = this._registry.getAllIslands();
		const normalized = reference.toLowerCase();

		// Find islands with similar names
		const similar = allIslands
			.filter((island) => {
				const name = island.name.toLowerCase();
				const qualified = getQualifiedIslandName(island).toLowerCase();

				// Check for substring match
				return (
					name.includes(normalized) ||
					normalized.includes(name) ||
					qualified.includes(normalized) ||
					this.levenshteinDistance(name, normalized) <= 3
				);
			})
			.map((island) => getQualifiedIslandName(island))
			.slice(0, 5); // Limit suggestions

		return similar;
	}

	/**
	 * Calculate Levenshtein distance between two strings.
	 * Used for fuzzy name matching.
	 */
	private levenshteinDistance(a: string, b: string): number {
		const matrix: number[][] = [];

		for (let i = 0; i <= b.length; i++) {
			matrix[i] = [i];
		}

		for (let j = 0; j <= a.length; j++) {
			matrix[0][j] = j;
		}

		for (let i = 1; i <= b.length; i++) {
			for (let j = 1; j <= a.length; j++) {
				if (b.charAt(i - 1) === a.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1,
						matrix[i][j - 1] + 1,
						matrix[i - 1][j] + 1,
					);
				}
			}
		}

		return matrix[b.length][a.length];
	}
}

/**
 * Create an island resolver from a registry.
 *
 * @param registry - The island registry to use
 * @param projectRoot - The project root directory
 * @returns A new IslandResolver instance
 */
export function createIslandResolver(
	registry: IslandRegistry,
	projectRoot: string,
): IslandResolver {
	return new IslandResolver(registry, projectRoot);
}
