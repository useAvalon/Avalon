/**
 * Component Detection System
 *
 * This module provides utilities to analyze components and determine their
 * hydration requirements based on script content and framework patterns.
 */

export interface ComponentAnalysis {
	hasScript: boolean;
	hasHydrateFunction: boolean;
	framework: 'vue' | 'svelte' | 'solid' | 'preact' | 'react' | 'unknown';
	recommendedStrategy: 'hydrate' | 'ssr-only';
}

export interface DetectionResult {
	shouldHydrate: boolean;
	reason: string;
	warnings?: string[];
}

export interface ComponentMetadata {
	path: string;
	framework: 'vue' | 'svelte' | 'solid' | 'preact' | 'react';
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
		fileExtensions: ['.tsx', '.jsx', '.solid.tsx', '.solid.jsx'],
		scriptTags: [], // Solid uses JSX, no separate script tags
		hydratePatterns: ['hydrate', 'render', 'createSignal', 'createEffect'],
		imports: ['solid-js', 'solid-js/web'],
	},
	preact: {
		fileExtensions: ['.tsx', '.jsx', '.preact.tsx', '.preact.jsx'],
		scriptTags: [], // Preact uses JSX, no separate script tags
		hydratePatterns: ['hydrate', 'render'],
		imports: ['preact', 'preact/hooks'],
	},
	react: {
		fileExtensions: ['.tsx', '.jsx', '.react.tsx', '.react.jsx'],
		scriptTags: [], // React uses JSX, no separate script tags
		hydratePatterns: ['hydrate', 'render'],
		imports: ['react', 'react-dom'],
	},
} as const;

/**
 * Detects the framework type based on file extension and content
 */
export function detectFramework(filePath: string, content: string): ComponentAnalysis['framework'] {
	// Check for explicit naming conventions first (highest priority)
	if (filePath.includes('.solid.')) {
		return 'solid';
	}
	if (filePath.includes('.preact.')) {
		return 'preact';
	}
	if (filePath.includes('.react.')) {
		return 'react';
	}

	// Check file extension first - this is the most reliable method
	if (filePath.endsWith('.vue')) {
		return 'vue';
	}
	if (filePath.endsWith('.svelte')) {
		return 'svelte';
	}

	// For .tsx/.jsx files, check content patterns to distinguish frameworks
	if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
		// Check imports for framework-specific patterns
		if (content.includes('solid-js') || content.includes('from "solid-js"') || content.includes("from 'solid-js'")) {
			return 'solid';
		}
		if (content.includes('preact') || content.includes('from "preact"') || content.includes("from 'preact'")) {
			return 'preact';
		}
		if (content.includes('react') && !content.includes('preact')) {
			return 'react';
		}
		
		// Default to preact for .tsx/.jsx files if no specific framework detected
		return 'preact';
	}

	// Check content patterns for other cases
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
			// Svelte components have script sections if they contain <script> tags
			// Also check for module context scripts
			return (
				content.includes('<script>') ||
				content.includes('<script ') ||
				content.includes('<script\n') ||
				content.includes('<script\t')
			);

		case 'solid':
			// Solid components are JSX files, so they inherently have script content
			// Check if it's not just a pure template
			return (
				content.includes('function') || content.includes('=>') || content.includes('const') || content.includes('let')
			);

		case 'preact':
		case 'react':
			// Preact/React components are JSX files, so they inherently have script content
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
			// Look for Svelte-specific hydration patterns - be more restrictive for explicit hydrate detection
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

		case 'preact':
			// Look for Preact-specific hydration patterns
			return (
				(content.includes('hydrate') && content.includes('preact')) ||
				(content.includes('render') && content.includes('preact'))
			);

		case 'react':
			// Look for React-specific hydration patterns
			return (
				(content.includes('hydrate') && content.includes('react')) ||
				(content.includes('render') && content.includes('react-dom'))
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
 * Extracts script content from Preact components (JSX)
 */
export function extractPreactScript(content: string): string {
	// For Preact JSX, similar to Solid - entire file is script content
	const lines = content.split('\n');
	const scriptLines = lines.filter(line => {
		const trimmed = line.trim();
		// Skip JSX return statements and pure HTML-like content
		return !trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.match(/^\s*return\s*\(/);
	});
	return scriptLines.join('\n');
}

/**
 * Extracts script content from React components (JSX)
 */
export function extractReactScript(content: string): string {
	// For React JSX, similar to Solid - entire file is script content
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

	// Determine recommended strategy with framework-specific logic
	let recommendedStrategy: ComponentAnalysis['recommendedStrategy'];

	if (!hasScript) {
		// No script = pure template component = SSR-only
		recommendedStrategy = 'ssr-only';
	} else {
		// Framework-specific hydration strategy decisions
		switch (framework) {
			case 'svelte':
				// Svelte components with script sections are typically interactive
				// Use more intelligent detection based on content patterns
				recommendedStrategy = analyzeSvelteHydrationStrategy(content, hasHydrate);
				break;
			
			case 'solid':
			case 'preact':
			case 'react':
				// JSX frameworks typically need hydration if they have script content
				recommendedStrategy = 'hydrate';
				break;
			
			case 'vue':
				// Vue components need explicit hydration indicators
				recommendedStrategy = hasHydrate ? 'hydrate' : 'ssr-only';
				break;
			
			default:
				// Conservative approach for unknown frameworks
				recommendedStrategy = hasHydrate ? 'hydrate' : 'ssr-only';
				break;
		}
	}

	return {
		hasScript,
		hasHydrateFunction: hasHydrate,
		framework,
		recommendedStrategy,
	};
}

/**
 * Analyzes Svelte component to determine if it needs hydration
 */
function analyzeSvelteHydrationStrategy(content: string, hasExplicitHydrate: boolean): ComponentAnalysis['recommendedStrategy'] {
	// If there's an explicit hydrate function, definitely hydrate
	if (hasExplicitHydrate) {
		return 'hydrate';
	}

	// Check for interactive patterns that indicate need for hydration
	const interactivePatterns = [
		'on:', // Event handlers (Svelte 4 style)
		'onclick', // Event handlers (HTML style)
		'onchange',
		'oninput',
		'onsubmit',
		'onkeydown',
		'onkeyup',
		'onmousedown',
		'onmouseup',
		'bind:', // Two-way bindings
		'$:', // Reactive statements
		'$state', // Svelte 5 runes
		'$derived',
		'$effect',
		'$props',
		'onMount', // Lifecycle functions
		'onDestroy',
		'beforeUpdate',
		'afterUpdate',
		'tick',
		'writable', // Stores
		'readable',
		'derived',
		'get(',
		'set(',
		'update(',
		'subscribe(',
	];

	const hasInteractiveFeatures = interactivePatterns.some(pattern => content.includes(pattern));

	// Check for static-only patterns
	const staticPatterns = [
		'export let', // Only props, no interactivity
	];

	const isLikelyStatic = staticPatterns.some(pattern => content.includes(pattern)) && !hasInteractiveFeatures;

	if (isLikelyStatic) {
		return 'ssr-only';
	}

	// Default to hydration for Svelte components with script sections
	// This is safer and aligns with Svelte's typical usage patterns
	return 'hydrate';
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

	// Has script section - check framework-specific hydration requirements
	if (analysis.hasScript) {
		// SolidJS components don't need explicit hydrate functions - they use solid-hydration.js
		if (analysis.framework === 'solid') {
			return {
				shouldHydrate: true,
				reason: 'SolidJS component detected - uses solid-hydration.js system',
			};
		}

		// Preact/React components typically need hydration if they have interactive features
		if (analysis.framework === 'preact' || analysis.framework === 'react') {
			return {
				shouldHydrate: true,
				reason: `${analysis.framework} component with script content - likely needs hydration`,
			};
		}

		// Svelte components with script sections should be hydrated by default
		// unless they explicitly opt out
		if (analysis.framework === 'svelte') {
			return {
				shouldHydrate: true,
				reason: 'Svelte component with script section - uses Svelte hydration system',
			};
		}

		// Other frameworks need explicit hydrate functions
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
		framework: analysis.framework === 'unknown' ? 'vue' : analysis.framework, // Default fallback to vue for backward compatibility
		hasScript: analysis.hasScript,
		hasHydrateFunction: analysis.hasHydrateFunction,
		renderStrategy: analysis.recommendedStrategy,
		detectionConfidence,
	};
}
