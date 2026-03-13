/**
 * Component Detection System
 *
 * This module provides utilities to analyze components and determine their
 * hydration requirements based on script content and framework patterns.
 */

export interface ComponentAnalysis {
	hasScript: boolean;
	hasHydrateFunction: boolean;
	framework: 'vue' | 'svelte' | 'solid' | 'preact' | 'react' | 'lit' | 'qwik' | 'unknown';
	recommendedStrategy: 'hydrate' | 'ssr-only';
}

export interface DetectionResult {
	shouldHydrate: boolean;
	reason: string;
	warnings?: string[];
}

export interface ComponentMetadata {
	path: string;
	framework: 'vue' | 'svelte' | 'solid' | 'preact' | 'react' | 'lit' | 'qwik';
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
	lit: {
		fileExtensions: ['.ts', '.js'],
		scriptTags: [], // Lit uses TypeScript/JavaScript classes
		hydratePatterns: ['LitElement', 'customElement', '@customElement'],
		imports: ['lit', 'lit-element', 'lit/'],
	},
	qwik: {
		fileExtensions: ['.tsx', '.jsx', '.qwik.tsx', '.qwik.jsx'],
		scriptTags: [], // Qwik uses JSX with component$
		hydratePatterns: ['component$', 'useSignal', 'useStore', 'useTask$', 'useVisibleTask$'],
		imports: ['@builder.io/qwik', '@builder.io/qwik/'],
	},
} as const;

/** Detect framework from explicit naming conventions in the file path */
function detectByNamingConvention(filePath: string): ComponentAnalysis['framework'] | null {
	if (filePath.includes('.solid.')) return 'solid';
	if (filePath.includes('.preact.')) return 'preact';
	if (filePath.includes('.react.')) return 'react';
	if (filePath.includes('.qwik.')) return 'qwik';
	return null;
}

/** Detect framework from file extension alone */
function detectByExtension(filePath: string, content: string): ComponentAnalysis['framework'] | null {
	if (filePath.endsWith('.vue')) return 'vue';
	if (filePath.endsWith('.svelte')) return 'svelte';

	if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
		if (content.includes('lit') || content.includes('LitElement') || content.includes('@customElement')) {
			return 'lit';
		}
	}

	if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
		return detectJSXFramework(content);
	}

	return null;
}

/** Distinguish JSX frameworks by content patterns */
function detectJSXFramework(content: string): ComponentAnalysis['framework'] {
	if (content.includes('solid-js') || content.includes('from "solid-js"') || content.includes("from 'solid-js'")) {
		return 'solid';
	}
	if (content.includes('@builder.io/qwik') || content.includes('from "@builder.io/qwik"') || content.includes("from '@builder.io/qwik'")) {
		return 'qwik';
	}
	if (content.includes('preact') || content.includes('from "preact"') || content.includes("from 'preact'")) {
		return 'preact';
	}
	if (content.includes('react') && !content.includes('preact')) {
		return 'react';
	}
	return 'preact';
}

/**
 * Detects the framework type based on file extension and content
 */
export function detectFramework(filePath: string, content: string): ComponentAnalysis['framework'] {
	return (
		detectByNamingConvention(filePath) ??
		detectByExtension(filePath, content) ??
		detectByImports(content)
	);
}

/** Fallback: detect framework by scanning imports against known patterns */
function detectByImports(content: string): ComponentAnalysis['framework'] {
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
			// Check for any <script> tag (more flexible than exact string matching)
			return /<script[^>]*>/i.test(content);

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
		case 'preact':
		case 'react':
		case 'qwik':
			// JSX frameworks inherently have script content
			return (
				content.includes('function') || content.includes('=>') || content.includes('const') || content.includes('let')
			);

		case 'lit':
			// Lit components are TypeScript/JavaScript classes
			// They always have script content (class definitions)
			return (
				content.includes('class') || content.includes('LitElement') || content.includes('@customElement')
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

		case 'qwik':
			// Qwik uses resumability instead of hydration — component$ is the marker
			return (
				content.includes('component$') ||
				content.includes('@builder.io/qwik')
			);

		default:
			return false;
	}
}

/**
 * Extracts script content from Vue components
 */
export function extractVueScript(content: string): string {
	return extractScriptTags(content);
}

/**
 * Extracts script content from Svelte components
 */
export function extractSvelteScript(content: string): string {
	return extractScriptTags(content);
}

/** Shared: extract `<script>` tag contents from SFC-style components */
function extractScriptTags(content: string): string {
	const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
	const results: string[] = [];
	let match;
	while ((match = scriptRegex.exec(content)) !== null) {
		results.push(match[0]);
	}
	return results.join('\n');
}

const JSX_RETURN_RE = /^\s*return\s*\(/;

/** Shared: extract script-like lines from JSX component files */
function extractJSXScript(content: string): string {
	return content
		.split('\n')
		.filter(line => {
			const trimmed = line.trim();
			return !trimmed.startsWith('<') && !trimmed.startsWith('</') && !JSX_RETURN_RE.exec(trimmed);
		})
		.join('\n');
}

/**
 * Extracts script content from Solid components (JSX)
 */
export function extractSolidScript(content: string): string {
	return extractJSXScript(content);
}

/**
 * Extracts script content from Preact components (JSX)
 */
export function extractPreactScript(content: string): string {
	return extractJSXScript(content);
}

function extractQwikScript(content: string): string {
	return extractJSXScript(content);
}

/**
 * Extracts script content from React components (JSX)
 */
export function extractReactScript(content: string): string {
	return extractJSXScript(content);
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

	if (hasScript) {
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
			
			case 'qwik':
				// Qwik uses resumability — components with component$ always resume on client
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
	} else {
		// No script = pure template component = SSR-only
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

/** Framework-specific hydration reasons for known frameworks with script sections */
const FRAMEWORK_HYDRATION_REASONS: Record<string, string> = {
	solid: 'SolidJS component detected - uses integration system',
	preact: 'preact component with script content - likely needs hydration',
	react: 'react component with script content - likely needs hydration',
	svelte: 'Svelte component with script section - uses Svelte hydration system',
	vue: 'Vue component with script section - uses Vue integration system',
	lit: 'Lit component detected - Web Components require client-side registration',
	qwik: 'Qwik component detected - uses resumability instead of hydration',
};

/**
 * Determines if a component should be hydrated based on analysis
 */
export function shouldHydrateComponent(
	analysis: ComponentAnalysis,
	options: { forceSSROnly?: boolean; detectScripts?: boolean } = {}
): DetectionResult {
	if (options.forceSSROnly) {
		return { shouldHydrate: false, reason: 'Explicitly configured for SSR-only rendering' };
	}

	if (options.detectScripts === false) {
		return { shouldHydrate: true, reason: 'Script detection disabled, defaulting to hydration' };
	}

	if (!analysis.hasScript) {
		return { shouldHydrate: false, reason: 'No script section detected, using SSR-only rendering' };
	}

	// Known frameworks with script sections always hydrate
	const frameworkReason = FRAMEWORK_HYDRATION_REASONS[analysis.framework];
	if (frameworkReason) {
		return { shouldHydrate: true, reason: frameworkReason };
	}

	// Unknown frameworks need explicit hydrate functions
	if (analysis.hasHydrateFunction) {
		return { shouldHydrate: true, reason: 'Component has script section with explicit hydration functions' };
	}

	return {
		shouldHydrate: false,
		reason: 'Component has script section but no explicit hydrate function, using SSR-only',
		warnings: ['Component has script section but no clear hydrate function detected'],
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
