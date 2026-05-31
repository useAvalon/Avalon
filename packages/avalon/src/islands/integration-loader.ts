import type { Integration } from "@useavalon/core";
import { registry } from "../core/integrations/registry.ts";
import { devWarn } from "../utils/dev-logger.ts";

/**
 * Cache for loaded integrations to avoid repeated lookups
 */
const frameworkCache = new Map<string, Integration>();

// Pattern to match nested island paths like /modules/*/islands/ or /src/*/islands/
const NESTED_ISLANDS_PATTERN = /\/(?:src\/)?(?:modules\/)?([^/]+\/)*islands\//;

/**
 * Load an integration by framework name
 * Uses cache to avoid repeated dynamic imports
 *
 * This function supports on-demand loading: if an integration hasn't been
 * preloaded, it will be loaded and cached on first use. This enables
 * lazy loading at server startup while ensuring fast subsequent renders.
 */
export async function loadIntegration(framework: string) {
	// Check local cache first (fastest path)
	if (frameworkCache.has(framework)) {
		return frameworkCache.get(framework)!;
	}

	// Check if already loaded in registry (e.g., by native preloader)
	if (registry.has(framework)) {
		const integration = registry.get(framework)!;
		frameworkCache.set(framework, integration);
		return integration;
	}

	// On-demand loading: load the integration now and cache it
	try {
		const integration = await registry.load(framework);
		frameworkCache.set(framework, integration);
		return integration;
	} catch (error) {
		throw new Error(
			`Integration '${framework}' could not be loaded. Make sure @useavalon/${framework} is installed.`,
			{ cause: error },
		);
	}
}

/**
 * Detect framework from file path and load the appropriate integration
 */
export async function detectAndLoadIntegration(src: string) {
	const framework = detectFrameworkFromPath(src);
	return await loadIntegration(framework);
}

/**
 * Detect framework from file path based on extension and naming conventions.
 *
 * Updated to support nested island paths like:
 * - /src/islands/Counter.tsx
 * - /src/modules/auth/islands/Counter.tsx
 * - /modules/dashboard/islands/Chart.vue
 *
 * @param src - The source path to detect framework from
 * @returns The detected framework name
 */
export function detectFrameworkFromPath(src: string) {
	// Normalize path separators
	const normalizedSrc = src.replaceAll("\\", "/");

	// Vue files (.vue)
	if (normalizedSrc.endsWith(".vue")) {
		return "vue";
	}

	// Svelte files (.svelte)
	if (normalizedSrc.endsWith(".svelte")) {
		return "svelte";
	}

	// Solid files (convention: .solid.tsx or .solid.jsx)
	if (normalizedSrc.includes(".solid.")) {
		return "solid";
	}

	// Qwik files (convention: .qwik.tsx or .qwik.jsx)
	if (normalizedSrc.includes(".qwik.")) {
		return "qwik";
	}

	// React files (convention: .react.tsx or .react.jsx)
	if (normalizedSrc.includes(".react.")) {
		return "react";
	}

	// Lit files (convention: .lit.ts or .lit.js, or files starting with "Lit")
	if (normalizedSrc.includes(".lit.")) {
		return "lit";
	}

	// Lit files by naming convention (LitComponent.ts)
	const fileName = normalizedSrc.split("/").pop() || "";
	if (
		fileName.startsWith("Lit") &&
		(normalizedSrc.endsWith(".ts") || normalizedSrc.endsWith(".js"))
	) {
		return "lit";
	}

	// Check if path is in any islands directory (including nested)
	// Plain .ts/.js files in islands are likely Lit components (Lit doesn't use JSX)
	if (
		isInIslandsDirectory(normalizedSrc) &&
		(normalizedSrc.endsWith(".ts") || normalizedSrc.endsWith(".js"))
	) {
		return "lit";
	}

	// Default to Preact for .tsx and .jsx files
	if (normalizedSrc.endsWith(".tsx") || normalizedSrc.endsWith(".jsx")) {
		return "preact";
	}

	// Fallback to Preact
	return "preact";
}

/**
 * Check if a path is within any islands directory (including nested).
 *
 * Matches patterns like:
 * - /islands/
 * - /src/islands/
 * - /src/modules/auth/islands/
 * - /modules/dashboard/islands/
 * - /src/features/user/islands/
 *
 * @param path - The path to check
 * @returns True if the path is in an islands directory
 */
export function isInIslandsDirectory(path: string): boolean {
	const normalized = path.replaceAll("\\", "/");

	// Check for /islands/ anywhere in the path
	return normalized.includes("/islands/");
}

/**
 * Check if a path is a nested island path (not in default /src/islands/).
 *
 * @param path - The path to check
 * @returns True if the path is a nested island path
 */
export function isNestedIslandPath(path: string): boolean {
	const normalized = path.replaceAll("\\", "/");

	// Check if it contains /islands/ but not at the root level
	if (!normalized.includes("/islands/")) {
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

/**
 * Extract the namespace from a nested island path.
 *
 * Examples:
 * - /src/modules/auth/islands/Counter.tsx -> "modules/auth"
 * - /src/features/user/islands/Profile.tsx -> "features/user"
 * - /src/islands/Button.tsx -> ""
 *
 * @param path - The path to extract namespace from
 * @returns The namespace or empty string for default islands
 */
export function extractNamespaceFromPath(path: string): string {
	const normalized = path.replaceAll("\\", "/");

	// Match patterns like /src/modules/auth/islands/ or /modules/auth/islands/
	const match = new RegExp(/(?:\/src)?\/(.+?)\/islands\//).exec(normalized);
	if (match) {
		return match[1];
	}

	return "";
}

/**
 * Detect framework from file content by analyzing imports and patterns.
 *
 * Updated to support nested island paths.
 *
 * @param src - The source path
 * @param content - The file content to analyze
 * @returns The detected framework name
 */
export function detectFrameworkFromContent(src: string, content: string) {
	// First try path-based detection
	const pathFramework = detectFrameworkFromPath(src);

	// If we have a definitive answer from path (not default), use it
	if (
		pathFramework === "vue" ||
		pathFramework === "svelte" ||
		pathFramework === "react" ||
		pathFramework === "lit"
	) {
		return pathFramework;
	}

	// For .tsx/.jsx files, analyze content to distinguish between frameworks

	// Check for React imports (must check before Preact since they share hooks)
	if (
		content.includes("from 'react'") ||
		content.includes('from "react"') ||
		content.includes("from 'react-dom'") ||
		content.includes('from "react-dom"') ||
		content.includes('"use client"') ||
		content.includes("'use client'") ||
		content.includes('"use server"') ||
		content.includes("'use server'")
	) {
		return "react";
	}

	// Check for Lit imports
	if (
		content.includes("from 'lit'") ||
		content.includes('from "lit"') ||
		content.includes("@lit-labs/ssr") ||
		content.includes("LitElement") ||
		content.includes("@customElement")
	) {
		return "lit";
	}

	// Check for Solid imports
	if (
		content.includes("solid-js") ||
		content.includes("from 'solid-js'") ||
		content.includes('from "solid-js"')
	) {
		return "solid";
	}

	// Check for Preact imports
	if (
		content.includes("from 'preact'") ||
		content.includes('from "preact"') ||
		content.includes("preact/hooks")
	) {
		return "preact";
	}

	// Check for Lit-specific patterns
	if (
		content.includes("extends LitElement") ||
		content.includes("@property") ||
		content.includes("@state") ||
		content.includes("html`") ||
		content.includes("css`")
	) {
		return "lit";
	}

	// Check for Solid-specific patterns
	if (
		content.includes("createSignal") ||
		content.includes("createEffect") ||
		content.includes("createMemo")
	) {
		return "solid";
	}

	// Check for React/Preact-specific patterns (hooks)
	// Note: React and Preact share the same hooks API, so we default to Preact
	// unless React imports are explicitly detected above
	if (content.includes("useState") || content.includes("useEffect") || content.includes("useRef")) {
		return "preact";
	}

	// Default to path-based detection
	return pathFramework;
}

/**
 * Get integration for a specific framework, with error handling
 */
export async function getIntegration(framework: string) {
	try {
		return await loadIntegration(framework);
	} catch (error) {
		console.error(`Failed to load integration for ${framework}:`, error);
		return null;
	}
}

/**
 * Check if an integration is available for a framework
 */
export async function hasIntegration(framework: string) {
	try {
		await loadIntegration(framework);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get all loaded integrations from cache
 */
export function getLoadedIntegrations() {
	return Array.from(frameworkCache.values());
}

/**
 * Get all loaded framework names from cache
 */
export function getLoadedFrameworks() {
	return Array.from(frameworkCache.keys());
}

/**
 * Clear the integration cache
 * Useful for testing or hot module replacement
 */
export function clearIntegrationCache() {
	frameworkCache.clear();
}

/**
 * Check if an integration is loaded in cache
 */
export function isIntegrationLoaded(framework: string) {
	return frameworkCache.has(framework);
}

/**
 * Default frameworks to preload at server startup
 * These are the most commonly used frameworks in island architecture
 */
export const DEFAULT_PRELOAD_FRAMEWORKS = [
	"preact",
	"react",
	"vue",
	"svelte",
	"solid",
	"lit",
] as const;

/**
 * Options for preloading integrations
 */
export interface PreloadIntegrationsOptions {
	/**
	 * When true, only preload integrations that are actually used on the page.
	 * This is determined by analyzing page components for framework usage.
	 * When false (default), preload all specified frameworks.
	 */
	lazy?: boolean;

	/**
	 * Array of framework names to preload.
	 * Defaults to DEFAULT_PRELOAD_FRAMEWORKS.
	 */
	frameworks?: readonly string[];

	/**
	 * Array of detected frameworks from page analysis.
	 * Only used when lazy=true to filter which frameworks to preload.
	 */
	detectedFrameworks?: string[];
}

/**
 * Preload integrations for multiple frameworks
 * Useful for warming up the cache during build or startup
 *
 * Uses Promise.allSettled to load all integrations concurrently,
 * ensuring that one failed integration doesn't block others.
 *
 * @param options - Preload options
 * @returns Promise that resolves when all preloading attempts complete
 */
export async function preloadIntegrations(options?: PreloadIntegrationsOptions): Promise<void> {
	let frameworks: readonly string[];
	let lazy = false;
	let detectedFrameworks: string[] | undefined;

	if (options) {
		frameworks = options.frameworks ?? DEFAULT_PRELOAD_FRAMEWORKS;
		lazy = options.lazy ?? false;
		detectedFrameworks = options.detectedFrameworks;
	} else {
		frameworks = DEFAULT_PRELOAD_FRAMEWORKS;
	}

	// When lazy mode is enabled, only preload detected frameworks
	if (lazy && detectedFrameworks && detectedFrameworks.length > 0) {
		// Filter to only frameworks that are both in the default list and detected
		const frameworksToLoad = frameworks.filter((fw) => detectedFrameworks.includes(fw));

		if (frameworksToLoad.length === 0) {
			return;
		}

		frameworks = frameworksToLoad;
	} else if (lazy && (!detectedFrameworks || detectedFrameworks.length === 0)) {
		// Lazy mode but no detected frameworks - skip preloading entirely
		return;
	}

	const results = await Promise.allSettled(
		frameworks.map((framework) => loadIntegration(framework)),
	);

	// Track success/failure counts for logging
	let successCount = 0;
	let failureCount = 0;

	// Log any failures (dev mode only)
	results.forEach((result, index) => {
		if (result.status === "rejected") {
			failureCount++;
			devWarn(`⚠️ Failed to preload integration '${frameworks[index]}':`, result.reason);
		} else {
			successCount++;
		}
	});
}

/**
 * Detect frameworks used in a page by analyzing component imports.
 * This is used for lazy integration loading to only preload what's needed.
 *
 * @param pageContent - The content of the page file to analyze
 * @returns Array of detected framework names
 */
export function detectFrameworksFromPageContent(pageContent: string): string[] {
	const detectedFrameworks: Set<string> = new Set();

	// Check for island imports and their framework hints
	// Look for patterns like: <Island src="/src/islands/Counter.tsx" framework="preact" />
	const frameworkPropMatches = pageContent.matchAll(/framework\s*=\s*["'](\w+)["']/g);
	for (const match of frameworkPropMatches) {
		detectedFrameworks.add(match[1]);
	}

	// Check for island source paths to detect framework from file extension
	const srcMatches = pageContent.matchAll(/src\s*=\s*["']([^"']+)["']/g);
	for (const match of srcMatches) {
		const src = match[1];
		const framework = detectFrameworkFromPath(src);
		detectedFrameworks.add(framework);
	}

	// Check for direct framework imports
	if (pageContent.includes("from 'react'") || pageContent.includes('from "react"')) {
		detectedFrameworks.add("react");
	}
	if (pageContent.includes("from 'preact'") || pageContent.includes('from "preact"')) {
		detectedFrameworks.add("preact");
	}
	if (pageContent.includes("from 'vue'") || pageContent.includes('from "vue"')) {
		detectedFrameworks.add("vue");
	}
	if (pageContent.includes("from 'svelte'") || pageContent.includes('from "svelte"')) {
		detectedFrameworks.add("svelte");
	}
	if (pageContent.includes("from 'solid-js'") || pageContent.includes('from "solid-js"')) {
		detectedFrameworks.add("solid");
	}
	if (pageContent.includes("from 'lit'") || pageContent.includes('from "lit"')) {
		detectedFrameworks.add("lit");
	}

	return Array.from(detectedFrameworks);
}
