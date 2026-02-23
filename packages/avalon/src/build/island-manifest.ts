import { join } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import {
	getQualifiedIslandName,
	type IslandDirectory,
	type IslandCollision,
	createIslandRegistry,
} from '../islands/discovery/index.ts';

export interface IslandManifest {
	islands: Record<string, IslandEntry>;
	version: string;
	buildTime: number;
}

/**
 * Extended island manifest with nested islands support
 */
export interface ExtendedIslandManifest extends IslandManifest {
	/** All discovered island directories */
	directories: IslandDirectory[];
	/** Detected naming collisions */
	collisions: IslandCollision[];
}

export interface IslandEntry {
	/** Original source path */
	src: string;
	/** Built bundle path */
	bundle: string;
	/** Bundle hash for cache busting */
	hash: string;
	/** Framework type (preact, solid, vue, svelte, vanilla, lit, react) */
	framework: 'preact' | 'solid' | 'vue' | 'svelte' | 'vanilla' | 'lit' | 'react' | 'unknown';
	/** Import dependencies */
	deps: string[];
}

/**
 * Extended island entry with namespace support
 */
export interface ExtendedIslandEntry extends IslandEntry {
	/** Namespace for the island (empty string for default directory) */
	namespace: string;
	/** Qualified name including namespace (e.g., "modules/auth/Counter") */
	qualifiedName: string;
	/** Original directory path */
	sourceDirectory: string;
}

/**
 * Generate island manifest during build using the nested islands discovery service.
 * Discovers all islands across all directories and generates manifest entries
 * with namespace and qualified name support.
 */
export async function generateIslandManifest(): Promise<ExtendedIslandManifest> {
	const islands: Record<string, ExtendedIslandEntry> = {};
	const cwd = process.cwd();

	try {
		// Use the discovery service to find all islands
		const registry = await createIslandRegistry(cwd);
		const discoveredIslands = registry.getAllIslands();
		const directories = registry.directories;
		const collisions = registry.collisions;

		for (const island of discoveredIslands) {
			const qualifiedName = getQualifiedIslandName(island);
			const src = `/${island.relativePath}`;

			// Read file content for analysis
			const content = await readFile(island.filePath, 'utf-8');
			const framework = mapFrameworkType(island.framework);
			const deps = extractDependencies(content);
			const hash = await generateHash(content);

			// Generate bundle path based on qualified name
			const bundlePath =
				island.namespace === ''
					? `/dist/islands/${island.name}.${hash}.js`
					: `/dist/islands/${qualifiedName}.${hash}.js`;

			islands[qualifiedName] = {
				src,
				bundle: bundlePath,
				hash,
				framework,
				deps,
				namespace: island.namespace,
				qualifiedName,
				sourceDirectory: island.directory.relativePath,
			};
		}

		return {
			islands,
			directories,
			collisions,
			version: '1.0.0',
			buildTime: Date.now(),
		};
	} catch (error) {
		console.warn('Failed to generate island manifest:', error);
		return {
			islands: {},
			directories: [],
			collisions: [],
			version: '1.0.0',
			buildTime: Date.now(),
		};
	}
}

/**
 * Generate island manifest (legacy function for backward compatibility)
 * Uses the old single-directory approach for projects that haven't migrated.
 */
export async function generateIslandManifestLegacy(): Promise<IslandManifest> {
	const islands: Record<string, IslandEntry> = {};
	const islandsDir = 'src/islands';

	try {
		const entries = await readdir(islandsDir, { withFileTypes: true });
		for (const dirEntry of entries) {
			if (
				dirEntry.isFile() &&
				(dirEntry.name.endsWith('.tsx') ||
					dirEntry.name.endsWith('.ts') ||
					dirEntry.name.endsWith('.vue') ||
					dirEntry.name.endsWith('.svelte'))
			) {
				const name = dirEntry.name.replace(/\.(tsx?|jsx?|vue|svelte)$/, '');
				const src = `/islands/${dirEntry.name}`;
				const fullPath = join(islandsDir, dirEntry.name);

				// Analyze the island file to determine framework and dependencies
				const content = await readFile(fullPath, 'utf-8');
				const framework = detectFramework(content, dirEntry.name);
				const deps = extractDependencies(content);

				// Generate hash from content for cache busting
				const hash = await generateHash(content);

				islands[name] = {
					src,
					bundle: `/dist/islands/${name}.${hash}.js`,
					hash,
					framework,
					deps,
				};
			}
		}
	} catch (error) {
		console.warn('Failed to read islands directory:', error);
	}

	return {
		islands,
		version: '1.0.0',
		buildTime: Date.now(),
	};
}

/**
 * Map the discovery service framework type to manifest framework type
 */
function mapFrameworkType(framework: string): ExtendedIslandEntry['framework'] {
	switch (framework) {
		case 'preact':
			return 'preact';
		case 'react':
			return 'react';
		case 'solid':
			return 'solid';
		case 'vue':
			return 'vue';
		case 'svelte':
			return 'svelte';
		case 'lit':
			return 'lit';
		case 'unknown':
		default:
			return 'vanilla';
	}
}

/**
 * Detect framework based on imports in the island file
 */
function detectFramework(content: string, filename: string): IslandEntry['framework'] {
	// Check file extension first
	if (filename.endsWith('.vue')) {
		return 'vue';
	}
	if (filename.endsWith('.svelte')) {
		return 'svelte';
	}

	// Check imports for framework detection
	if (
		content.includes('from "preact"') ||
		content.includes("from 'preact'") ||
		content.includes('preact/hooks') ||
		content.includes('preact-render-to-string')
	) {
		return 'preact';
	}
	if (content.includes('from "solid-js"') || content.includes("from 'solid-js'")) {
		return 'solid';
	}
	if (content.includes('from "vue"') || content.includes("from 'vue'")) {
		return 'vue';
	}

	// Default to preact for .tsx files if no specific framework detected
	if (filename.endsWith('.tsx')) {
		return 'preact';
	}

	return 'vanilla';
}

/**
 * Extract import dependencies from the island file
 */
function extractDependencies(content: string): string[] {
	const deps: string[] = [];
	const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

	let match;
	while ((match = importRegex.exec(content)) !== null) {
		const importPath = match[1];
		// Only include external dependencies, not relative imports
		if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
			deps.push(importPath);
		}
	}

	return [...new Set(deps)]; // Remove duplicates
}

/**
 * Generate hash from content for cache busting
 */
async function generateHash(content: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(content);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	return hashHex.slice(0, 8); // Use first 8 characters
}

/**
 * Load island manifest (for production)
 */
export async function loadIslandManifest(): Promise<ExtendedIslandManifest | null> {
	try {
		const manifestPath = 'dist/island-manifest.json';
		const content = await readFile(manifestPath, 'utf-8');
		return JSON.parse(content);
	} catch (error) {
		console.warn('Failed to load island manifest:', error);
		return null;
	}
}

/**
 * Get bundle path for an island (development vs production)
 * Supports both simple names and qualified names (namespace/name)
 */
export function getIslandBundlePath(src: string, manifest?: ExtendedIslandManifest | IslandManifest | null): string {
	const isDev = process.env.NODE_ENV !== 'production';

	// If manifest is provided, use it (production mode)
	if (manifest) {
		const qualifiedName = extractQualifiedNameFromSrc(src);
		const extendedManifest = manifest as ExtendedIslandManifest;
		if (extendedManifest.islands[qualifiedName]) {
			return extendedManifest.islands[qualifiedName].bundle;
		}
		const simpleName = src.replace(/^\/islands\//, '').replace(/\.(tsx?|jsx?|vue|svelte)$/, '');
		const island = manifest.islands[simpleName];
		if (island) {
			return island.bundle;
		}
	}

	if (isDev) {
		if (src.startsWith('/islands/')) {
			return src.replaceAll('/islands/', '/src/islands/');
		}
		if (src.startsWith('/src/')) {
			return src;
		}
		return `/src/${src}`;
	}

	const qualifiedName = extractQualifiedNameFromSrc(src);
	return `/dist/islands/${qualifiedName}.js`;
}

/**
 * Extract qualified name from a source path
 */
function extractQualifiedNameFromSrc(src: string): string {
	let path = src.replace(/^\//, '');
	path = path.replace(/\.(tsx?|jsx?|vue|svelte)$/, '');
	path = path.replace(/\.(solid|react|lit|preact)$/, '');

	const nestedMatch = new RegExp(/^src\/(.+)\/islands\/([^/]+)$/).exec(path);
	if (nestedMatch) {
		const [, namespace, name] = nestedMatch;
		return `${namespace}/${name}`;
	}

	const defaultMatch = new RegExp(/^(?:src\/)?islands\/([^/]+)$/).exec(path);
	if (defaultMatch) {
		return defaultMatch[1];
	}

	return path;
}

/**
 * Get island entry by qualified name or simple name
 */
export function getIslandEntry(
	nameOrQualified: string,
	manifest: ExtendedIslandManifest | IslandManifest,
): ExtendedIslandEntry | IslandEntry | null {
	if (manifest.islands[nameOrQualified]) {
		return manifest.islands[nameOrQualified];
	}

	const extendedManifest = manifest as ExtendedIslandManifest;
	if (extendedManifest.directories) {
		for (const [qualifiedName, entry] of Object.entries(manifest.islands)) {
			const simpleName = qualifiedName.split('/').pop();
			if (simpleName === nameOrQualified) {
				return entry;
			}
		}
	}

	return null;
}
