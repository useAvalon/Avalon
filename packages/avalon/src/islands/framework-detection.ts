import type { Framework } from './types.ts';
import { registry } from '../core/integrations/registry.ts';
import { IslandRegistry, createIslandRegistry } from './discovery/index.ts';
import { getCachedPath, setCachedPath } from './render-cache.ts';
import { stat as fsStat, readFile } from 'node:fs/promises';

/** Known synchronous framework types (excludes 'unknown') */
type SyncFramework = 'solid' | 'vue' | 'svelte' | 'preact' | 'react' | 'lit' | 'qwik';

/**
 * Resolve an island path using the island registry.
 * This enables resolution of nested island paths by component name.
 *
 * @param src - The source path or component name
 * @param registry - The island registry to use for resolution
 * @returns The resolved path or null if not found
 */
function resolveIslandPathFromRegistry(src: string, registry: IslandRegistry): string | null {
	// Extract component name from path
	const componentName = extractComponentName(src);
	if (!componentName) {
		return null;
	}

	// Try to resolve by name
	const island = registry.resolve(componentName);
	if (island) {
		// Return the relative path with leading slash
		return '/' + island.relativePath;
	}

	// Try to resolve by qualified name (namespace/name)
	if (src.includes('/')) {
		// Extract potential namespace from path
		const namespace = extractNamespaceFromPath(src);
		if (namespace) {
			const islandByNamespace = registry.resolve(componentName, namespace);
			if (islandByNamespace) {
				return '/' + islandByNamespace.relativePath;
			}
		}
	}

	return null;
}

/**
 * Extract component name from a path.
 * Handles various path formats and removes extensions.
 *
 * @param path - The path to extract from
 * @returns The component name or null
 */
function extractComponentName(path: string): string | null {
	// Get the filename from the path
	const parts = path.split('/').filter(Boolean);
	if (parts.length === 0) {
		return null;
	}

	let filename = parts.at(-1)!;

	// Remove framework-specific extensions first (e.g., .solid.tsx -> .tsx)
	const frameworkPatterns = [/\.solid\.(tsx|jsx)$/, /\.react\.(tsx|jsx)$/, /\.lit\.(ts|js)$/, /\.preact\.(tsx|jsx)$/];

	for (const pattern of frameworkPatterns) {
		if (pattern.test(filename)) {
			filename = filename.replace(pattern, '');
			break;
		}
	}

	// Remove standard extensions
	filename = filename.replace(/\.(tsx|ts|jsx|js|vue|svelte)$/, '');

	return filename || null;
}

/**
 * Extract namespace from a nested island path.
 *
 * @param path - The path to extract namespace from
 * @returns The namespace or empty string for default
 */
function extractNamespaceFromPath(path: string): string {
	// Match patterns like /src/modules/auth/islands/ or /modules/auth/islands/
	const match = new RegExp(/(?:\/src)?\/(.+?)\/islands\//).exec(path);
	if (match) {
		return match[1];
	}
	return '';
}

/**
 * Check if a file exists asynchronously
 */
async function fileExists(path: string): Promise<boolean> {
	try {
		await fsStat(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Normalize nested island paths to include /src/ prefix.
 */
function normalizeIslandPath(resolvedPath: string): string {
	if (resolvedPath.includes('/islands/') && !resolvedPath.startsWith('/src/')) {
		if (/^\/(?:modules\/)?[^/]+\/islands\//.test(resolvedPath)) {
			return '/src' + resolvedPath;
		}
		if (resolvedPath.startsWith('/islands/')) {
			return resolvedPath.replace('/islands/', '/src/islands/');
		}
	}
	return resolvedPath;
}

/**
 * Try to resolve a .tsx path to a framework-specific file that exists on disk.
 */
async function resolveFrameworkSpecificPath(resolvedPath: string): Promise<string | null> {
	const integrations = registry.getAll();
	const possiblePaths: string[] = [];
	const basePath = resolvedPath.replace('.tsx', '');

	for (const integration of integrations) {
		const config = integration.config();
		for (const ext of config.fileExtensions) {
			if (ext === '.tsx' || ext === '.jsx') {
				possiblePaths.push(`${basePath}.${config.name}${ext}`);
			} else {
				possiblePaths.push(`${basePath}${ext}`);
			}
		}
	}

	possiblePaths.push(resolvedPath);

	for (const possiblePath of possiblePaths) {
		const pathVariation = possiblePath.startsWith('/') ? possiblePath.substring(1) : possiblePath;
		if (await fileExists(pathVariation)) {
			return possiblePath;
		}
	}

	return null;
}

/**
 * Resolve Island component path for Vite SSR loading
 * Converts /islands/* paths to /src/islands/* for proper resolution
 * Also handles framework-specific naming conventions and nested islands.
 * Uses async file operations and caching for better performance.
 *
 * @param src - The source path or component name
 * @returns The resolved path
 */
export async function resolveIslandPath(src: string): Promise<string> {
	// Check cache first
	const cachedPath = getCachedPath(src);
	if (cachedPath !== null) {
		return cachedPath;
	}

	// Normalize path separators and nested island paths
	let resolvedPath = normalizeIslandPath(src.replaceAll('\\', '/'));

	// Try to resolve using the island registry if available
	const islandRegistry = _global.__islandRegistry;
	if (islandRegistry) {
		const resolvedFromRegistry = resolveIslandPathFromRegistry(resolvedPath, islandRegistry);
		if (resolvedFromRegistry) {
			setCachedPath(src, resolvedFromRegistry);
			return resolvedFromRegistry;
		}
	}

	// Handle framework-specific naming conventions
	if (resolvedPath.endsWith('.tsx') && !resolvedPath.includes('.solid.') && !resolvedPath.includes('.preact.')) {
		const frameworkPath = await resolveFrameworkSpecificPath(resolvedPath);
		if (frameworkPath) {
			setCachedPath(src, frameworkPath);
			return frameworkPath;
		}
	}

	// Cache the resolved path (even if it's the same as input)
	setCachedPath(src, resolvedPath);
	return resolvedPath;
}

/**
 * Check if a path is a nested island path (not in default /src/islands/).
 *
 * @param path - The path to check
 * @returns True if the path is a nested island path
 */
export function isNestedIslandPath(path: string): boolean {
	const normalized = path.replaceAll('\\', '/');

	// Check if it contains /islands/ but not at the root level
	if (!normalized.includes('/islands/')) {
		return false;
	}

	// Default path patterns
	const defaultPatterns = [/^\/islands\//, /^\/src\/islands\//, /^src\/islands\//, /^islands\//];

	for (const pattern of defaultPatterns) {
		if (pattern.test(normalized)) {
			return false;
		}
	}

	// If it contains /islands/ but doesn't match default patterns, it's nested
	return true;
}

/** Typed accessor for the global island registry */
const _global = globalThis as unknown as {
	__islandRegistry?: IslandRegistry;
	__viteDevServer?: { ssrLoadModule: (path: string) => Promise<Record<string, unknown>> };
};

/**
 * Get the island registry, initializing it if necessary.
 *
 * @param projectRoot - The project root directory
 * @returns The island registry
 */
export async function getOrCreateIslandRegistry(projectRoot: string = process.cwd()): Promise<IslandRegistry> {
	_global.__islandRegistry ??= await createIslandRegistry(projectRoot);
	return _global.__islandRegistry;
}

/**
 * Set the global island registry.
 * Useful for testing or when the registry is created elsewhere.
 *
 * @param registry - The registry to set
 */
export function setIslandRegistry(registry: IslandRegistry): void {
	_global.__islandRegistry = registry;
}

/**
 * Clear the global island registry.
 * Useful for testing or hot module replacement.
 */
export function clearIslandRegistry(): void {
	_global.__islandRegistry = undefined;
}

/**
 * Quick framework detection based on file extension and naming conventions
 * Used for setting framework attributes without async file reading
 *
 * Updated to query integration configs for detection patterns
 */
export function detectFrameworkFromSrc(src: string): SyncFramework {
	// Normalize path separators
	const normalizedSrc = src.replaceAll('\\', '/');

	// Get all registered integrations
	const integrations = registry.getAll();

	// First pass: Check for framework-specific naming conventions (e.g., .solid.tsx)
	// This takes priority over generic extensions
	for (const integration of integrations) {
		const config = integration.config();

		if (normalizedSrc.includes(`.${config.name}.`)) {
			return config.name as SyncFramework;
		}
	}

	// Second pass: Check file extensions for unique extensions (e.g., .vue, .svelte)
	for (const integration of integrations) {
		const config = integration.config();

		// Check if file extension matches
		for (const ext of config.fileExtensions) {
			if (normalizedSrc.endsWith(ext)) {
				return config.name as SyncFramework;
			}
		}
	}

	return detectFrameworkFromFallback(normalizedSrc);
}

/**
 * Fallback detection for when no integrations are loaded yet.
 */
function detectFrameworkFromFallback(normalizedSrc: string): SyncFramework {
	if (normalizedSrc.endsWith('.vue')) {
		return 'vue';
	}
	if (normalizedSrc.endsWith('.svelte')) {
		return 'svelte';
	}
	if (normalizedSrc.includes('.solid.') || normalizedSrc.toLowerCase().includes('solid')) {
		return 'solid';
	}
	if (normalizedSrc.includes('.qwik.') || normalizedSrc.toLowerCase().includes('qwik')) {
		return 'qwik';
	}
	if (normalizedSrc.includes('react') || normalizedSrc.toLowerCase().includes('react')) {
		return 'react';
	}

	// Default to preact for .tsx/.jsx files
	return 'preact';
}

/**
 * Detect framework from file content by checking integration detection patterns.
 */
function detectFrameworkFromContent(
	fileContent: string,
	integrations: ReturnType<typeof registry.getAll>,
): Framework | null {
	for (const integration of integrations) {
		const config = integration.config();

		for (const pattern of config.detectionPatterns.imports) {
			if (pattern.test(fileContent)) {
				return config.name as Framework;
			}
		}

		for (const pattern of config.detectionPatterns.content) {
			if (pattern.test(fileContent)) {
				return config.name as Framework;
			}
		}
	}

	return null;
}

/**
 * Fallback content-based detection when no integrations are loaded.
 */
function detectFrameworkFromContentFallback(fileContent: string): Framework {
	const checks = [
		{ pattern: /solid-js|@jsxImportSource solid-js/, framework: 'solid' as const },
		{ pattern: /@builder\.io\/qwik|@jsxImportSource @builder\.io\/qwik/, framework: 'qwik' as const },
		{ pattern: /vue|Vue/, framework: 'vue' as const },
		{ pattern: /svelte/, framework: 'svelte' as const },
		{ pattern: /react/, framework: 'react' as const },
		{ pattern: /preact/, framework: 'preact' as const },
	];

	for (const check of checks) {
		if (check.pattern.test(fileContent)) {
			return check.framework;
		}
	}

	return 'preact';
}

/**
 * Read file content for framework detection, trying direct read then Vite SSR.
 */
async function readFileContentForDetection(src: string): Promise<string | null> {
	try {
		const resolvedPath = await resolveIslandPath(src);
		const filePath = resolvedPath.replace(/^\//, '');
		return await readFile(filePath, 'utf-8');
	} catch {
		const viteServer = _global.__viteDevServer;
		if (viteServer) {
			const resolvedPath = await resolveIslandPath(src);
			const mod = await viteServer.ssrLoadModule(resolvedPath);
			return JSON.stringify(mod);
		}
		return null;
	}
}

/**
 * Detect the framework used by a component file
 * Updated to query integration configs for detection patterns
 */
export async function detectFramework(src: string): Promise<Framework> {
	const integrations = registry.getAll();

	// Quick filename-based detection using integration configs
	for (const integration of integrations) {
		const config = integration.config();

		for (const ext of config.fileExtensions) {
			if (src.endsWith(ext)) {
				return config.name as Framework;
			}
		}

		if (src.includes(`.${config.name}.`)) {
			return config.name as Framework;
		}
	}

	// Try to read file content for more accurate detection
	try {
		const fileContent = await readFileContentForDetection(src);
		if (!fileContent) {
			return 'unknown';
		}

		const detected = detectFrameworkFromContent(fileContent, integrations);
		if (detected) {
			return detected;
		}

		if (integrations.length === 0) {
			return detectFrameworkFromContentFallback(fileContent);
		}

		return 'preact';
	} catch {
		return 'unknown';
	}
}
