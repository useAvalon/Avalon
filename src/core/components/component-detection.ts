/**
 * Component Detection System
 *
 * This module provides utilities to analyze components and determine their
 * hydration requirements based on script content and framework patterns.
 */

export interface ComponentAnalysis {
	hasScript: boolean;
	hasHydrateFunction: boolean;
	framework: 'vue' | 'svelte' | 'solid' | 'unknown';
	recommendedStrategy: 'hydrate' | 'ssr-only';
}

export interface DetectionResult {
	shouldHydrate: boolean;
	reason: string;
	warnings?: string[];
}

export interface ComponentMetadata {
	path: string;
	framework: 'vue' | 'svelte' | 'solid';
	hasScript: boolean;
	hasHydrateFunction: boolean;
	renderStrategy: 'hydrate' | 'ssr-only';
	detectionConfidence: 'high' | 'medium' | 'low';
}

// Framework detection patterns
const FRAMEWORK_PATTERNS = {
	vue: {
		fileExtensions: ['.vue'],
		scriptTags: ['<script>', '<script setup>', '<script lang="ts">', '<script setup lang="ts">'],
		hydratePatterns: ['hydrate', 'mount', 'createApp', 'Vue.createApp'],
		imports: ['vue', '@vue/', 'vue/'],
	},
	svelte: {
		fileExtensions: ['.svelte'],
		scriptTags: ['<script>', '<script lang="ts">', '<script context="module">'],
		hydratePatterns: ['hydrate', 'mount', '$:', 'onMount'],
		imports: ['svelte', 'svelte/'],
	},
	solid: {
		fileExtensions: ['.tsx', '.jsx'],
		scriptTags: [], // Solid uses JSX, no separate script tags
		hydratePatterns: ['hydrate', 'render', 'createSignal', 'createEffect'],
		imports: ['solid-js', 'solid-js/web'],
	},
} as const;

/**
 * Detects the framework type based on file extension and content
 */
export function detectFramework(filePath: string, content: string): ComponentAnalysis['framework'] {
	// Check file extension first
	for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
		if (patterns.fileExtensions.some(ext => filePath.endsWith(ext))) {
			return framework as ComponentAnalysis['framework'];
		}
	}

	// Check content patterns if extension is ambiguous
	for (const [framework, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
		if (patterns.imports.some(importPattern => content.includes(importPattern))) {
			return framework as ComponentAnalysis['framework'];
		}
	}

	return 'unknown';
}

/**
 * Detects if a component has script sections
 */
export function hasScriptSection(content: string, framework: ComponentAnalysis['framework']): boolean {
	switch (framework) {
		case 'vue':
			return FRAMEWORK_PATTERNS.vue.scriptTags.some(tag => content.includes(tag));

		case 'svelte':
			return FRAMEWORK_PATTERNS.svelte.scriptTags.some(tag => content.includes(tag));

		case 'solid':
			// Solid components are JSX files, so they inherently have script content
			// Check if it's not just a pure template
			return (
				content.includes('function') || content.includes('=>') || content.includes('const') || content.includes('let')
			);

		default:
			// For unknown frameworks, look for any script-like patterns
			return content.includes('<script>') || content.includes('function') || content.includes('=>');
	}
}

/**
 * Detects if a component has hydration functions
 */
export function hasHydrateFunction(content: string, framework: ComponentAnalysis['framework']): boolean {
	const patterns = FRAMEWORK_PATTERNS[framework as keyof typeof FRAMEWORK_PATTERNS];
	if (!patterns) return false;

	// Look for explicit hydrate function exports or declarations
	const explicitHydratePatterns = [
		'export function hydrate',
		'export const hydrate',
		'function hydrate(',
		'const hydrate =',
		'let hydrate =',
		'var hydrate =',
	];

	// Check for explicit hydrate functions first
	const hasExplicitHydrate = explicitHydratePatterns.some(pattern =>
		content.toLowerCase().includes(pattern.toLowerCase())
	);

	if (hasExplicitHydrate) return true;

	// For framework-specific patterns, be more selective
	switch (framework) {
		case 'vue':
			// Look for Vue-specific hydration patterns
			return content.includes('createApp') && content.includes('mount');

		case 'svelte':
			// Look for Svelte-specific hydration patterns - be more restrictive
			// Only consider it hydration-ready if it has explicit hydrate function
			// or uses Svelte's hydrate import
			return (
				content.includes('import') &&
				content.includes('hydrate') &&
				(content.includes('svelte') || content.includes('hydrate('))
			);

		case 'solid':
			// Look for Solid-specific hydration patterns
			return (
				(content.includes('hydrate') && content.includes('solid-js')) ||
				(content.includes('render') && content.includes('solid-js/web'))
			);

		default:
			return false;
	}
}

/**
 * Extracts script content from Vue components
 */
export function extractVueScript(content: string): string {
	const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
	const matches = content.match(scriptRegex);
	return matches ? matches.join('\n') : '';
}

/**
 * Extracts script content from Svelte components
 */
export function extractSvelteScript(content: string): string {
	const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
	const matches = content.match(scriptRegex);
	return matches ? matches.join('\n') : '';
}

/**
 * Extracts script content from Solid components (JSX)
 */
export function extractSolidScript(content: string): string {
	// For Solid/JSX, the entire file is essentially script content
	// Remove JSX template parts and focus on logic
	const lines = content.split('\n');
	const scriptLines = lines.filter(line => {
		const trimmed = line.trim();
		// Skip JSX return statements and pure HTML-like content
		return !trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.match(/^\s*return\s*\(/);
	});
	return scriptLines.join('\n');
}

/**
 * Analyzes a component and returns detailed analysis
 */
export function analyzeComponent(filePath: string, content: string): ComponentAnalysis {
	const framework = detectFramework(filePath, content);
	const hasScript = hasScriptSection(content, framework);
	const hasHydrate = hasScript ? hasHydrateFunction(content, framework) : false;

	// Determine recommended strategy
	let recommendedStrategy: ComponentAnalysis['recommendedStrategy'];

	if (!hasScript) {
		// No script = pure template component = SSR-only
		recommendedStrategy = 'ssr-only';
	} else if (hasHydrate) {
		// Has script AND explicit hydrate function = hydrate
		recommendedStrategy = 'hydrate';
	} else {
		// Has script but no explicit hydrate function = SSR-only
		// Only hydrate components that explicitly define hydration functions
		recommendedStrategy = 'ssr-only';
	}

	return {
		hasScript,
		hasHydrateFunction: hasHydrate,
		framework,
		recommendedStrategy,
	};
}

/**
 * Determines if a component should be hydrated based on analysis
 */
export function shouldHydrateComponent(
	analysis: ComponentAnalysis,
	options: { forceSSROnly?: boolean; detectScripts?: boolean } = {}
): DetectionResult {
	const warnings: string[] = [];

	// Check for explicit SSR-only override
	if (options.forceSSROnly) {
		return {
			shouldHydrate: false,
			reason: 'Explicitly configured for SSR-only rendering',
		};
	}

	// If script detection is disabled, default to hydration
	if (options.detectScripts === false) {
		return {
			shouldHydrate: true,
			reason: 'Script detection disabled, defaulting to hydration',
		};
	}

	// No script section found - this is the ONLY case for SSR-only
	if (!analysis.hasScript) {
		return {
			shouldHydrate: false,
			reason: 'No script section detected, using SSR-only rendering',
		};
	}

	// Has script section - only hydrate if explicit hydrate function is found
	if (analysis.hasScript) {
		if (analysis.hasHydrateFunction) {
			return {
				shouldHydrate: true,
				reason: 'Component has script section with explicit hydration functions',
			};
		} else {
			return {
				shouldHydrate: false,
				reason: 'Component has script section but no explicit hydrate function, using SSR-only',
				warnings: ['Component has script section but no clear hydrate function detected'],
			};
		}
	}

	// Fallback case (should not reach here)
	return {
		shouldHydrate: false,
		reason: 'Unable to determine hydration requirements, defaulting to SSR-only for safety',
		warnings: ['Component analysis was inconclusive'],
	};
}

/**
 * Creates component metadata with confidence scoring
 */
export function createComponentMetadata(
	filePath: string,
	content: string,
	analysis: ComponentAnalysis
): ComponentMetadata {
	let detectionConfidence: ComponentMetadata['detectionConfidence'] = 'medium';

	// High confidence cases
	if (analysis.framework !== 'unknown' && analysis.hasScript && analysis.hasHydrateFunction) {
		detectionConfidence = 'high';
	} else if (analysis.framework !== 'unknown' && !analysis.hasScript) {
		detectionConfidence = 'high';
	}
	// Low confidence cases
	else if (analysis.framework === 'unknown') {
		detectionConfidence = 'low';
	}

	return {
		path: filePath,
		framework: analysis.framework === 'unknown' ? 'vue' : analysis.framework, // Default fallback
		hasScript: analysis.hasScript,
		hasHydrateFunction: analysis.hasHydrateFunction,
		renderStrategy: analysis.recommendedStrategy,
		detectionConfidence,
	};
}
