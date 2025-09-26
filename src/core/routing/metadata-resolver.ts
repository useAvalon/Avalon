import { join, dirname, relative } from '@std/path';
import { existsSync } from '@std/fs';
import type {
	Metadata,
	ResolvedMetadata,
	MetadataChain,
	RouteParams,
	MetadataGenerator,
} from '../../schemas/routing.ts';
// Removed MarkdownRouter - MDX files are handled by Vite plugins

/**
 * MetadataResolver handles hierarchical metadata resolution and merging
 * for file-system based routing. It discovers metadata files in the directory
 * hierarchy and intelligently merges them to create final metadata for routes.
 */
export class MetadataResolver {
	private metadataCache = new Map<string, ResolvedMetadata>();
	private chainCache = new Map<string, MetadataChain>();

	constructor(private pagesDirectory: string = 'src/pages', private enableCaching: boolean = true) {}

	/**
	 * Resolves the complete metadata chain for a given route path
	 * by walking up the directory hierarchy and collecting metadata files
	 */
	async resolveMetadataChain(routePath: string): Promise<MetadataChain> {
		// Check cache first
		if (this.enableCaching && this.chainCache.has(routePath)) {
			return this.chainCache.get(routePath)!;
		}

		const chain: MetadataChain = {
			sections: [],
		};

		// Convert route path to file path
		const filePath = this.routePathToFilePath(routePath);
		const directories = this.getDirectoryHierarchy(filePath);

		// Collect global metadata from root
		const globalMetadataPath = join(this.pagesDirectory, '_metadata.ts');
		if (existsSync(globalMetadataPath)) {
			try {
				const globalModule = await import(globalMetadataPath);
				if (globalModule.default && typeof globalModule.default === 'object') {
					chain.global = globalModule.default as Metadata;
				}
			} catch (error) {
				console.warn(`Failed to load global metadata from ${globalMetadataPath}:`, error);
			}
		}

		// Collect section metadata from each directory in hierarchy
		for (const dir of directories) {
			const metadataPath = join(dir, '_metadata.ts');
			if (existsSync(metadataPath)) {
				try {
					const metadataModule = await import(metadataPath);
					if (metadataModule.default && typeof metadataModule.default === 'object') {
						const relativePath = relative(this.pagesDirectory, dir);
						chain.sections.push({
							path: relativePath || '/',
							metadata: metadataModule.default as Metadata,
						});
					}
				} catch (error) {
					console.warn(`Failed to load metadata from ${metadataPath}:`, error);
				}
			}
		}

		// Cache the result
		if (this.enableCaching) {
			this.chainCache.set(routePath, chain);
		}

		return chain;
	}

	/**
	 * Merges metadata from multiple sources in the hierarchy
	 * with more specific metadata taking precedence
	 */
	async mergeMetadata(chain: MetadataChain, pageMetadata?: Metadata): Promise<ResolvedMetadata> {
		const sources: string[] = [];
		let merged: ResolvedMetadata = {
			sources,
			resolvedAt: Date.now(),
		};

		// Start with global metadata
		if (chain.global) {
			merged = this.deepMergeMetadata(merged, chain.global);
			sources.push('global');
		}

		// Apply section metadata in order (root to leaf)
		for (const section of chain.sections) {
			merged = this.deepMergeMetadata(merged, section.metadata);
			sources.push(`section:${section.path}`);
		}

		// Apply page-specific metadata last (highest priority)
		if (pageMetadata) {
			merged = this.deepMergeMetadata(merged, pageMetadata);
			sources.push('page');
		}

		return merged;
	}

	/**
	 * Generates dynamic metadata for a page using its generateMetadata function
	 */
	async generateDynamicMetadata(generateMetadata: MetadataGenerator, params: RouteParams): Promise<Metadata> {
		try {
			return await generateMetadata(params);
		} catch (error) {
			console.error('Failed to generate dynamic metadata:', error);
			return {};
		}
	}

	/**
	 * Resolves complete metadata for a route, including dynamic generation
	 */
	async resolveRouteMetadata(
		routePath: string,
		generateMetadata?: MetadataGenerator,
		params: RouteParams = {}
	): Promise<ResolvedMetadata> {
		// Check cache first
		const cacheKey = `${routePath}:${JSON.stringify(params)}`;
		if (this.enableCaching && this.metadataCache.has(cacheKey)) {
			return this.metadataCache.get(cacheKey)!;
		}

		// Resolve metadata chain
		const chain = await this.resolveMetadataChain(routePath);

		// Generate dynamic metadata if available
		let pageMetadata: Metadata | undefined;
		if (generateMetadata) {
			pageMetadata = await this.generateDynamicMetadata(generateMetadata, params);
		}

		// Merge all metadata
		const resolved = await this.mergeMetadata(chain, pageMetadata);

		// Cache the result
		if (this.enableCaching) {
			this.metadataCache.set(cacheKey, resolved);
		}

		return resolved;
	}

	// Removed resolveMarkdownMetadata - MDX files use standard metadata resolution

	/**
	 * Clears the metadata cache
	 */
	clearCache(): void {
		this.metadataCache.clear();
		this.chainCache.clear();
	}

	/**
	 * Invalidates cache entries for a specific route path
	 */
	invalidateRoute(routePath: string): void {
		// Remove direct cache entries
		this.chainCache.delete(routePath);

		// Remove resolved metadata entries that match this route
		for (const [key] of this.metadataCache) {
			if (key.startsWith(`${routePath}:`)) {
				this.metadataCache.delete(key);
			}
		}
	}

	/**
	 * Deep merges two metadata objects with intelligent handling of arrays and objects
	 */
	private deepMergeMetadata(target: ResolvedMetadata, source: Metadata): ResolvedMetadata {
		const result = { ...target };

		for (const [key, value] of Object.entries(source)) {
			if (value === undefined || value === null) {
				continue;
			}

			if (key === 'keywords' && Array.isArray(value)) {
				// Merge keyword arrays, removing duplicates
				const existingKeywords = result.keywords || [];
				const allKeywords = value.filter((v): v is string => typeof v === 'string');
				result.keywords = [...new Set([...existingKeywords, ...allKeywords])];
			} else if (key === 'schema' && Array.isArray(value)) {
				// Merge schema arrays
				const existingSchema = result.schema || [];
				const allSchema = value.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null);
				result.schema = [...existingSchema, ...allSchema];
			} else if (key === 'openGraph' && typeof value === 'object' && value !== null) {
				// Deep merge OpenGraph objects
				result.openGraph = {
					...result.openGraph,
					...value,
				};
			} else if (key === 'twitter' && typeof value === 'object' && value !== null) {
				// Deep merge Twitter Card objects
				result.twitter = {
					...result.twitter,
					...value,
				};
			} else {
				// For all other properties, source takes precedence
				(result as any)[key] = value;
			}
		}

		return result;
	}

	/**
	 * Converts a route path to a file path within the pages directory
	 */
	private routePathToFilePath(routePath: string): string {
		// Remove leading slash and convert to file path
		const cleanPath = routePath.startsWith('/') ? routePath.slice(1) : routePath;

		// Handle root route
		if (!cleanPath) {
			return join(this.pagesDirectory, 'index.tsx');
		}

		// Handle nested routes
		return join(this.pagesDirectory, cleanPath);
	}

	/**
	 * Gets the directory hierarchy for a file path, from root to leaf
	 */
	private getDirectoryHierarchy(filePath: string): string[] {
		const directories: string[] = [];
		let currentDir = dirname(filePath);

		// Walk up the directory tree until we reach the pages directory
		while (currentDir !== this.pagesDirectory && currentDir !== dirname(currentDir)) {
			directories.unshift(currentDir);
			currentDir = dirname(currentDir);
		}

		// Always include the pages directory itself
		directories.unshift(this.pagesDirectory);

		return directories;
	}

	/**
	 * Validates metadata object structure
	 */
	private validateMetadata(metadata: unknown): metadata is Metadata {
		if (!metadata || typeof metadata !== 'object') {
			return false;
		}

		const meta = metadata as Record<string, unknown>;

		// Check optional string fields
		const stringFields = ['title', 'description', 'canonical', 'robots'];
		for (const field of stringFields) {
			if (meta[field] !== undefined && typeof meta[field] !== 'string') {
				return false;
			}
		}

		// Check keywords array
		if (meta.keywords !== undefined) {
			if (!Array.isArray(meta.keywords) || !meta.keywords.every(k => typeof k === 'string')) {
				return false;
			}
		}

		// Check schema array
		if (meta.schema !== undefined) {
			if (!Array.isArray(meta.schema) || !meta.schema.every(s => typeof s === 'object')) {
				return false;
			}
		}

		// Check openGraph object
		if (meta.openGraph !== undefined && typeof meta.openGraph !== 'object') {
			return false;
		}

		// Check twitter object
		if (meta.twitter !== undefined && typeof meta.twitter !== 'object') {
			return false;
		}

		return true;
	}
}

/**
 * Default metadata resolver instance
 */
export const defaultMetadataResolver = new MetadataResolver();

/**
 * Utility function to create a metadata resolver with custom configuration
 */
export function createMetadataResolver(
	pagesDirectory: string = 'src/pages',
	enableCaching: boolean = true
): MetadataResolver {
	return new MetadataResolver(pagesDirectory, enableCaching);
}
