import type { JSX } from 'preact';
import {
	analyzeComponentContent,
	type AnalyzerOptions,
	type AnalysisReport,
} from '../core/components/component-analyzer.ts';
import { resolveIslandPath } from './framework-detection.ts';
import type { IslandProps } from './types.ts';
import { getCachedAnalysis, setCachedAnalysis, getCachedPath, setCachedPath } from './render-cache.ts';
import { readFile } from 'node:fs/promises';

/**
 * Check if we're in development mode
 */
function isDev(): boolean {
	try {
		return process.env.NODE_ENV !== 'production';
	} catch {
		return true; // Default to dev mode if we can't check
	}
}

/**
 * Log cache hit/miss in dev mode
 */
function logCacheEvent(_type: 'hit' | 'miss', _cacheType: string, _src: string): void {
	// Silenced — set AVALON_VERBOSE=1 to enable
}

/**
 * Get essential path variations for a component
 * Reduced from 22 variations to essential ones for better performance
 */
function getEssentialPathVariations(src: string, resolvedSrc: string): string[] {
	const baseName =
		src
			.split('/')
			.pop()
			?.replace(/\.(tsx|jsx|vue|svelte|ts|js)$/, '') || '';

	// Get the original file extension
	const originalExt = src.split('.').pop() || 'tsx';

	// Essential path variations - prioritized by likelihood
	return [
		// Direct paths first (most likely to succeed)
		resolvedSrc.startsWith('/') ? resolvedSrc.substring(1) : resolvedSrc,
		src.startsWith('/') ? src.substring(1) : src,
		// Standard island locations
		`src/islands/${baseName}.${originalExt}`,
		`src/islands/${baseName}.tsx`,
		`islands/${baseName}.${originalExt}`,
		`islands/${baseName}.tsx`,
		// Framework-specific extensions (only for common frameworks)
		`src/islands/${baseName}.svelte`,
		`src/islands/${baseName}.vue`,
		`src/islands/${baseName}.solid.tsx`,
	];
}

/**
 * Try to read a file asynchronously, returning null if not found
 */
async function tryReadFile(path: string): Promise<string | null> {
	try {
		return await readFile(path, 'utf-8');
	} catch {
		return null;
	}
}

/**
 * Analyze component file for rendering strategy
 *
 * Attempts to read the component file from various path variations and
 * analyzes its content to determine the optimal rendering strategy.
 * Uses caching to avoid repeated file I/O and analysis for the same components.
 *
 * @param src - The source path to the component
 * @param options - Analyzer options for customizing the analysis
 * @returns Analysis result with rendering strategy decision
 * @throws Error if component file cannot be found
 */
export async function analyzeComponentFile(src: string, options: AnalyzerOptions = {}): Promise<AnalysisReport> {
	// Check analysis cache first
	const cachedAnalysis = getCachedAnalysis(src);
	if (cachedAnalysis) {
		logCacheEvent('hit', 'analysis', src);
		return cachedAnalysis;
	}
	logCacheEvent('miss', 'analysis', src);

	// Check if we have a cached resolved path
	let resolvedSrc = getCachedPath(src);
	if (resolvedSrc) {
		logCacheEvent('hit', 'path', src);
	} else {
		logCacheEvent('miss', 'path', src);
		resolvedSrc = await resolveIslandPath(src);
	}

	// Get essential path variations (reduced from 22 to ~9)
	const pathVariations = getEssentialPathVariations(src, resolvedSrc);

	// Try each path variation
	for (const pathVariation of pathVariations) {
		const content = await tryReadFile(pathVariation);
		if (content !== null) {
			// Cache the resolved path for future lookups
			setCachedPath(src, pathVariation);

			// Analyze the component content
			const result = analyzeComponentContent(pathVariation, content, options);

			// Cache the analysis result
			setCachedAnalysis(src, result);

			return result;
		}
	}

	throw new Error(`Component file not found: ${src}`);
}

/**
 * Render component with SSR-only strategy (no hydration)
 *
 * Renders a component server-side without adding client-side hydration.
 * This is useful for static components that don't require interactivity.
 *
 * @param params - Rendering parameters
 * @param params.src - Component source path
 * @param params.condition - Island hydration condition
 * @param params.props - Props to pass to the component
 * @param params.framework - Optional explicit framework (if not provided, will be detected)
 * @param params.renderOptions - Additional render options
 * @returns Island component with SSR-only rendering
 * @throws Error if SSR rendering fails
 */
export async function renderComponentSSROnly({
	src,
	condition,
	props,
	framework: explicitFramework,
	renderOptions,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	framework?: string;
	renderOptions: AnalyzerOptions;
}) {
	try {
		// Import Island component dynamically to avoid circular dependencies
		const { default: Island } = await import('./island.tsx');

		// Import integration loader to load the appropriate framework integration
		const { loadIntegration } = await import('./integration-loader.ts');
		const { detectFramework } = await import('./framework-detection.ts');

		// Use explicit framework if provided, otherwise detect it
		let framework: string;
		if (explicitFramework) {
			framework = explicitFramework;
		} else if (src.endsWith('.vue')) {
			framework = 'vue';
		} else if (src.endsWith('.svelte')) {
			framework = 'svelte';
		} else if (src.endsWith('.tsx') || src.endsWith('.jsx') || src.endsWith('.ts') || src.endsWith('.js')) {
			framework = await detectFramework(src);
		} else {
			framework = 'preact'; // Default fallback
		}

		// Load the appropriate integration
		const integration = await loadIntegration(framework);

		// Get Vite server reference for dev mode
		const viteServer = globalThis.__viteDevServer;
		const isDev = process.env.NODE_ENV !== 'production';

		// Render the component using the integration
		const renderResult = await integration.render({
			component: null, // Integration will load the component from src
			props,
			src,
			condition,
			ssrOnly: true,
			viteServer,
			isDev,
		});

		// Return Island component with the rendered HTML as children
		// This ensures the HTML is properly wrapped in <avalon-island> with ssrOnly attributes
		return Island({
			src,
			condition,
			props,
			children: renderResult.html, // Pass rendered HTML as children
			ssr: true,
			framework: framework as 'solid' | 'vue' | 'preact' | 'react' | 'svelte' | 'lit',
			ssrOnly: true,
			renderOptions,
			hydrationData: undefined, // No hydration data for SSR-only components
		});
	} catch (error) {
		// Only log errors in development
		if (process.env.NODE_ENV !== 'production') {
			console.error(`SSR-only rendering failed for ${src}:`, error);
		}
		throw error;
	}
}
