import { join } from '@std/path';

export interface IslandManifest {
	islands: Record<string, IslandEntry>;
	version: string;
	buildTime: number;
}

export interface IslandEntry {
	/** Original source path */
	src: string;
	/** Built bundle path */
	bundle: string;
	/** Bundle hash for cache busting */
	hash: string;
	/** Framework type (preact, solid, vue, vanilla) */
	framework: 'preact' | 'solid' | 'vue' | 'vanilla';
	/** Import dependencies */
	deps: string[];
}

/**
 * Generate island manifest during build
 */
export async function generateIslandManifest(): Promise<IslandManifest> {
	const islands: Record<string, IslandEntry> = {};
	const islandsDir = 'src/islands';

	try {
		for await (const dirEntry of Deno.readDir(islandsDir)) {
			if (dirEntry.isFile && (dirEntry.name.endsWith('.tsx') || dirEntry.name.endsWith('.ts'))) {
				const name = dirEntry.name.replace(/\.(tsx?|jsx?)$/, '');
				const src = `/islands/${dirEntry.name}`;
				const fullPath = join(islandsDir, dirEntry.name);

				// Analyze the island file to determine framework and dependencies
				const content = await Deno.readTextFile(fullPath);
				const framework = detectFramework(content);
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
 * Detect framework based on imports in the island file
 */
function detectFramework(content: string): IslandEntry['framework'] {
	if (content.includes('from "preact"') || content.includes("from 'preact'")) {
		return 'preact';
	}
	if (content.includes('from "solid-js"') || content.includes("from 'solid-js'")) {
		return 'solid';
	}
	if (content.includes('from "vue"') || content.includes("from 'vue'")) {
		return 'vue';
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
export async function loadIslandManifest(): Promise<IslandManifest | null> {
	try {
		const manifestPath = 'dist/island-manifest.json';
		const content = await Deno.readTextFile(manifestPath);
		return JSON.parse(content);
	} catch (error) {
		console.warn('Failed to load island manifest:', error);
		return null;
	}
}

/**
 * Get bundle path for an island (development vs production)
 */
export function getIslandBundlePath(src: string, manifest?: IslandManifest | null): string {
	const isDev = Deno.env.get('DENO_ENV') !== 'production';

	if (isDev) {
		// In development, serve islands from Avalon server with simple compilation
		// This provides a batteries-included experience without requiring Vite
		return src;
	}

	if (manifest) {
		// In production, use manifest to get bundled path
		const name = src.replace(/^\/islands\//, '').replace(/\.(tsx?|jsx?)$/, '');
		const island = manifest.islands[name];
		if (island) {
			return island.bundle;
		}
	}

	// Fallback
	const name = src.replace(/^\/islands\//, '').replace(/\.(tsx?|jsx?)$/, '');
	return `/dist/islands/${name}.js`;
}
