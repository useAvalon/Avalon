import type { JSX } from 'preact';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { getIslandBundlePath } from '../build/island-manifest.ts';
import type { ViteDevServer } from 'vite';
import type { Component } from 'svelte';
import { analyzeComponentContent, type AnalyzerOptions } from '../helpers/component-analyzer.ts';

// Global CSS collector for SSR
declare global {
	var __viteDevServer: ViteDevServer | undefined;
	var __svelteSSRCSS: Set<string> | undefined;
}

// Initialize global CSS collector
if (typeof globalThis !== 'undefined' && !globalThis.__svelteSSRCSS) {
	globalThis.__svelteSSRCSS = new Set();
}

/**
 * Get collected Svelte SSR CSS and optionally clear the collection
 */
export function getSvelteSSRCSS(clear = false): string {
	if (!globalThis.__svelteSSRCSS) {
		return '';
	}

	const cssArray = Array.from(globalThis.__svelteSSRCSS);
	if (clear) {
		globalThis.__svelteSSRCSS.clear();
	}

	return cssArray.join('\n');
}

export interface IslandProps {
	/** Path to the island component (e.g., "/islands/Counter.tsx") */
	src: string;
	/** Hydration condition */
	condition?: 'on:visible' | 'on:interaction' | 'on:idle' | 'on:client' | `media:${string}`;
	/** Props to pass to the island component */
	props?: Record<string, unknown>;
	/** Children to render inside the island (for SSR) */
	children?: JSX.Element | JSX.Element[] | string;
	/** Whether to render server-side (default: true unless condition is 'on:client') */
	ssr?: boolean;
	/** Framework hint for client hydration */
	framework?: 'solid' | 'vue' | 'preact' | 'react' | 'svelte';
	/** Force SSR-only rendering without hydration */
	ssrOnly?: boolean;
	/** Component render options for intelligent detection */
	renderOptions?: AnalyzerOptions;
}

/**
 * Universal Island component - renders <is-land> custom elements for better DOM structure
 *
 * Uses custom elements instead of div wrappers for cleaner, more semantic markup
 * Supports intelligent rendering strategy detection to skip hydration for SSR-only components
 */
export default function Island({
	src,
	condition = 'on:client',
	props = {},
	children,
	ssr = condition !== 'on:client',
	framework,
	ssrOnly = false,
	renderOptions = {},
}: IslandProps): JSX.Element {
	// Generate deterministic ID for the island (SSR-safe)
	// Use src path to ensure server and client generate the same ID
	const islandId = `island-${src.replace(/[^a-zA-Z0-9]/g, '-')}`;

	// Determine if this should be SSR-only based on explicit flag or render options
	const shouldSkipHydration = ssrOnly || renderOptions.forceSSROnly;

	// Only get bundle path if we need hydration
	const bundlePath = shouldSkipHydration ? '' : getIslandBundlePath(src);

	// If we have SSR content (children), render it directly in the is-land element
	if (ssr && children) {
		const baseAttributes = {
			id: islandId,
			...(framework ? { 'data-framework': framework } : {}),
		};

		// Add hydration attributes only if not SSR-only
		const hydrationAttributes = shouldSkipHydration
			? {
					'data-render-strategy': 'ssr-only',
			  }
			: {
					'data-island': condition,
					'data-hydrate': bundlePath,
					'data-props': JSON.stringify(props),
					'data-render-strategy': 'hydrate',
			  };

		const allAttributes = { ...baseAttributes, ...hydrationAttributes };

		if (typeof children === 'string') {
			return h('is-land', {
				...allAttributes,
				dangerouslySetInnerHTML: { __html: children },
			});
		} else {
			// For JSX children, include them directly
			return h('is-land', allAttributes, children);
		}
	}

	// Client-only: render empty is-land that will be hydrated (unless SSR-only)
	if (shouldSkipHydration) {
		// For SSR-only components without children, render empty element
		return h('is-land', {
			id: islandId,
			'data-render-strategy': 'ssr-only',
			...(framework ? { 'data-framework': framework } : {}),
		});
	}

	return h('is-land', {
		id: islandId,
		'data-island': condition,
		'data-hydrate': bundlePath,
		'data-props': JSON.stringify(props),
		'data-render-strategy': 'hydrate',
		...(framework ? { 'data-framework': framework } : {}),
	});
}

/**
 * Universal renderIsland function - auto-detects framework and handles SSR + hydration
 *
 * This is the main function you should use - it automatically:
 * - Detects the component framework (Vue, Solid.js, Preact/React)
 * - Analyzes component for intelligent rendering strategy detection
 * - Handles server-side rendering when possible
 * - Falls back to client-only rendering when needed
 * - Returns the appropriate Island component
 */
export async function renderIsland({
	src,
	condition = 'on:client',
	props = {},
	children,
	ssr = condition !== 'on:client',
	ssrOnly = false,
	renderOptions = {},
}: IslandProps): Promise<JSX.Element> {
	console.log(`🏝️ renderIsland called for: ${src}, ssr: ${ssr}, condition: ${condition}, ssrOnly: ${ssrOnly}`);

	// Perform intelligent component analysis if not explicitly SSR-only
	let shouldSkipHydration = ssrOnly;
	let analysisReason = '';

	if (!ssrOnly && renderOptions.detectScripts !== false) {
		try {
			// Try to analyze the component for intelligent rendering strategy
			const analysisResult = await analyzeComponentFile(src, renderOptions);
			shouldSkipHydration = !analysisResult.decision.shouldHydrate;
			analysisReason = analysisResult.decision.reason;

			console.log(
				`🔍 Component analysis for ${src}: ${shouldSkipHydration ? 'SSR-ONLY' : 'HYDRATE'} (${analysisReason})`
			);

			if (analysisResult.decision.warnings && analysisResult.decision.warnings.length > 0) {
				analysisResult.decision.warnings.forEach(warning => console.warn(`⚠️ ${src}: ${warning}`));
			}
		} catch (error) {
			console.warn(`⚠️ Component analysis failed for ${src}:`, error);
			// Continue with original logic on analysis failure
		}
	}

	// If component is determined to be SSR-only, handle accordingly
	if (shouldSkipHydration) {
		console.log(`📄 Using SSR-only rendering for ${src}: ${analysisReason}`);

		// For SSR-only components, we still want to render them server-side if possible
		// but without hydration attributes
		if (ssr && !children) {
			// Try to render server-side content for SSR-only components
			try {
				return await renderComponentSSROnly({ src, condition, props, renderOptions });
			} catch (error) {
				console.warn(`SSR failed for SSR-only component ${src}:`, error);
				// Fall back to basic Island without hydration
				return Island({ src, condition, props, children: undefined, ssr: false, ssrOnly: true, renderOptions });
			}
		} else {
			// Use basic Island with SSR-only flag
			return Island({ src, condition, props, children, ssr, ssrOnly: true, renderOptions });
		}
	}

	// If SSR is disabled or we already have children, use basic Island
	if (!ssr || children) {
		console.log(`📄 Using basic Island (SSR disabled or children provided)`);
		return Island({ src, condition, props, children, ssr, renderOptions });
	}

	// Auto-detect framework and attempt SSR with hydration
	try {
		// Vue detection
		if (src.endsWith('.vue')) {
			console.log(`🔍 Detected Vue component: ${src}`);
			return await renderVueComponent({ src, condition, props, ssr, renderOptions });
		}

		// Svelte detection
		if (src.endsWith('.svelte')) {
			console.log(`🔍 Detected Svelte component: ${src}`);
			return await renderSvelteComponent({ src, condition, props, ssr, renderOptions });
		}

		// TypeScript/JavaScript files
		if (src.endsWith('.tsx') || src.endsWith('.jsx') || src.endsWith('.ts') || src.endsWith('.js')) {
			const framework = await detectFramework(src);
			console.log(`🔍 Detected framework: ${framework} for ${src}`);

			switch (framework) {
				case 'solid':
					return await renderSolidComponent({ src, condition, props, ssr, renderOptions });
				case 'vue':
					return await renderVueComponent({ src, condition, props, ssr, renderOptions });
				case 'preact':
				case 'react':
				default:
					return await renderPreactComponent({ src, condition, props, ssr, renderOptions });
			}
		}

		// Unknown file type, use basic Island
		console.log(`❓ Unknown file type for ${src}, using basic Island`);
		return Island({ src, condition, props, children: undefined, ssr: false, renderOptions });
	} catch (error) {
		console.error(`❌ SSR failed for ${src}:`, error);
		console.log(`🔄 Falling back to client-only rendering`);
		return Island({ src, condition: 'on:client', props, ssr: false, renderOptions });
	}
}

/**
 * Analyze component file for rendering strategy
 */
async function analyzeComponentFile(src: string, options: AnalyzerOptions = {}) {
	// Try multiple path variations to find the component
	const pathVariations = [
		src.startsWith('/') ? src.substring(1) : src,
		`examples/${src.split('/').pop()}`,
		`src/islands/${src.split('/').pop()}`,
		`islands/${src.split('/').pop()}`,
	];

	for (const pathVariation of pathVariations) {
		try {
			const content = await Deno.readTextFile(pathVariation);
			return analyzeComponentContent(pathVariation, content, options);
		} catch {
			// Continue to next path variation
			continue;
		}
	}

	throw new Error(`Component file not found: ${src}`);
}

/**
 * Render component with SSR-only strategy (no hydration)
 */
async function renderComponentSSROnly({
	src,
	condition,
	props,
	renderOptions,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	renderOptions: AnalyzerOptions;
}): Promise<JSX.Element> {
	console.log(`🔄 Attempting SSR-only rendering for: ${src}`);

	try {
		// Use the existing SSR rendering functions but with ssrOnly flag
		// This ensures proper handling of props, styles, and framework-specific features

		if (src.endsWith('.vue')) {
			return await renderVueComponent({ src, condition, props, ssr: true, renderOptions, ssrOnly: true });
		}

		if (src.endsWith('.svelte')) {
			return await renderSvelteComponent({ src, condition, props, ssr: true, renderOptions, ssrOnly: true });
		}

		if (src.endsWith('.tsx') || src.endsWith('.jsx') || src.endsWith('.ts') || src.endsWith('.js')) {
			const framework = await detectFramework(src);

			switch (framework) {
				case 'solid':
					return await renderSolidComponent({ src, condition, props, ssr: true, renderOptions, ssrOnly: true });
				case 'vue':
					return await renderVueComponent({ src, condition, props, ssr: true, renderOptions, ssrOnly: true });
				case 'preact':
				case 'react':
				default:
					return await renderPreactComponent({ src, condition, props, ssr: true, renderOptions, ssrOnly: true });
			}
		}

		// Unknown file type, return empty SSR-only Island
		return Island({ src, condition, props, children: undefined, ssr: false, ssrOnly: true, renderOptions });
	} catch (error) {
		console.error(`❌ SSR-only rendering failed for ${src}:`, error);
		throw error;
	}
}

/**
 * Detect the framework used by a component file
 */
async function detectFramework(src: string): Promise<'solid' | 'vue' | 'preact' | 'react' | 'unknown'> {
	// Quick filename-based detection
	if (src.includes('.solid.') || src.includes('Solid') || src.toLowerCase().includes('solid')) {
		return 'solid';
	}

	if (src.includes('.vue.') || src.includes('Vue')) {
		return 'vue';
	}

	// Try to read file content for more accurate detection
	try {
		let fileContent: string;

		try {
			// Try to read the file directly
			fileContent = await Deno.readTextFile(src.replace(/^\//, ''));
		} catch {
			// If direct read fails, try through Vite in development
			const viteServer = globalThis.__viteDevServer;
			if (viteServer) {
				const module = await viteServer.ssrLoadModule(src);
				fileContent = module.toString();
			} else {
				return 'unknown';
			}
		}

		// Check imports and pragmas
		if (fileContent.includes('solid-js') || fileContent.includes('@jsxImportSource solid-js')) {
			return 'solid';
		}

		if (fileContent.includes('vue') || fileContent.includes('Vue')) {
			return 'vue';
		}

		if (fileContent.includes('react')) {
			return 'react';
		}

		if (fileContent.includes('preact')) {
			return 'preact';
		}

		// Default to preact for JSX files
		return 'preact';
	} catch (error) {
		console.warn(`Could not detect framework for ${src}:`, error);
		return 'unknown';
	}
}

/**
 * Render Vue component with SSR
 */
async function renderVueComponent({
	src,
	condition,
	props,
	ssr: _ssr,
	renderOptions = {},
	ssrOnly = false,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	ssr: boolean;
	renderOptions?: AnalyzerOptions;
	ssrOnly?: boolean;
}): Promise<JSX.Element> {
	console.log(`🔄 Attempting Vue SSR for: ${src}`);

	try {
		const isDev = Deno.env.get('DENO_ENV') !== 'production';

		if (isDev) {
			// In development, use Vite's ssrLoadModule
			const viteServer = globalThis.__viteDevServer;
			if (viteServer) {
				console.log(`📡 Using Vite SSR for Vue: ${src}`);
				const module = await viteServer.ssrLoadModule(src);
				const VueComponent = module.default || module;
				return await renderVueToString(VueComponent, props, src, condition, ssrOnly, renderOptions);
			}
		} else {
			// In production, load from pre-built SSR bundle
			const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace('.vue', '.js');
			console.log(`📦 Loading Vue SSR bundle: ${ssrPath}`);
			const module = await import(ssrPath);
			const VueComponent = module.default || module;
			return await renderVueToString(VueComponent, props, src, condition, ssrOnly, renderOptions);
		}
	} catch (error) {
		console.error(`❌ Vue SSR failed for ${src}:`, error);
	}

	// For SSR-only components, try template-based fallback
	if (ssrOnly) {
		console.log(`🔄 Trying template-based fallback for SSR-only Vue component: ${src}`);
		try {
			const templateFallback = await renderVueTemplateFallback(src, props, condition, renderOptions);
			if (templateFallback) {
				console.log(`✅ Vue template fallback succeeded, returning result`);
				return templateFallback;
			} else {
				console.log(`⚠️ Vue template fallback returned null`);
			}
		} catch (fallbackError) {
			console.error(`❌ Vue template fallback failed:`, fallbackError);
		}
	}

	// Fallback to client-only (or SSR-only if specified)
	console.log(`🔄 Vue SSR failed, falling back to ${ssrOnly ? 'SSR-only' : 'client-only'} for ${src}`);
	return Island({ src, condition: ssrOnly ? condition : 'on:client', props, ssr: false, ssrOnly, renderOptions });
}

/**
 * Render Solid component with SSR
 */
async function renderSolidComponent({
	src,
	condition,
	props,
	ssr: _ssr,
	renderOptions = {},
	ssrOnly = false,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	ssr: boolean;
	renderOptions?: AnalyzerOptions;
	ssrOnly?: boolean;
}): Promise<JSX.Element> {
	console.log(`🔄 Attempting Solid SSR for: ${src}`);

	try {
		const isDev = Deno.env.get('DENO_ENV') !== 'production';

		if (isDev) {
			// In development, use Vite's ssrLoadModule
			const viteServer = globalThis.__viteDevServer;
			if (viteServer) {
				console.log(`📡 Loading Solid component: ${src}`);
				const module = await viteServer.ssrLoadModule(src);
				const SolidComponent = module.default || module;

				if (!SolidComponent || typeof SolidComponent !== 'function') {
					throw new Error(`Invalid Solid component in ${src}`);
				}

				return await renderSolidToString(SolidComponent, props, src, condition);
			}
		} else {
			// In production, load from pre-built SSR bundle
			const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace(/\.(tsx|jsx)$/, '.js');
			console.log(`📦 Loading Solid SSR bundle: ${ssrPath}`);
			const module = await import(ssrPath);
			const SolidComponent = module.default || module;
			return await renderSolidToString(SolidComponent, props, src, condition);
		}
	} catch (error) {
		console.error(`❌ Solid SSR failed for ${src}:`, error);
	}

	// Fallback to client-only (or SSR-only if specified)
	console.log(`🔄 Solid SSR failed, falling back to ${ssrOnly ? 'SSR-only' : 'client-only'} for ${src}`);
	return Island({ src, condition: ssrOnly ? condition : 'on:client', props, ssr: false, ssrOnly, renderOptions });
}

/**
 * Render Svelte component with SSR
 */
async function renderSvelteComponent({
	src,
	condition,
	props,
	ssr: _ssr,
	renderOptions = {},
	ssrOnly = false,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	ssr: boolean;
	renderOptions?: AnalyzerOptions;
	ssrOnly?: boolean;
}): Promise<JSX.Element> {
	console.log(`🔄 Attempting Svelte SSR for: ${src}`);

	try {
		const isDev = Deno.env.get('DENO_ENV') !== 'production';

		if (isDev) {
			// In development, use Vite's ssrLoadModule
			const viteServer = globalThis.__viteDevServer;
			if (viteServer) {
				console.log(`📡 Loading Svelte component: ${src}`);
				const module = await viteServer.ssrLoadModule(src);
				const SvelteComponent = module.default || module;

				if (!SvelteComponent || typeof SvelteComponent.render !== 'function') {
					throw new Error(`Invalid Svelte component in ${src}`);
				}

				return await renderSvelteToString(SvelteComponent, props, src, condition, ssrOnly, renderOptions);
			}
		} else {
			// In production, load from pre-built SSR bundle
			const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace('.svelte', '.js');
			console.log(`📦 Loading Svelte SSR bundle: ${ssrPath}`);
			const module = await import(ssrPath);
			const SvelteComponent = module.default || module;
			return await renderSvelteToString(SvelteComponent, props, src, condition, ssrOnly, renderOptions);
		}
	} catch (error) {
		console.error(`❌ Svelte SSR failed for ${src}:`, error);
		console.log(`🔍 ssrOnly flag is: ${ssrOnly}`);

		// For SSR-only components, try template-based fallback
		if (ssrOnly) {
			console.log(`🔄 Trying template-based fallback for SSR-only component: ${src}`);
			try {
				const templateFallback = await renderSvelteTemplateFallback(src, props, condition, renderOptions);
				if (templateFallback) {
					console.log(`✅ Template fallback succeeded, returning result`);
					return templateFallback;
				} else {
					console.log(`⚠️ Template fallback returned null`);
				}
			} catch (fallbackError) {
				console.error(`❌ Template fallback failed:`, fallbackError);
			}
		}
	}

	// For SSR-only components, try template-based fallback
	if (ssrOnly) {
		console.log(`🔄 Trying template-based fallback for SSR-only Svelte component: ${src}`);
		try {
			const templateFallback = await renderSvelteTemplateFallback(src, props, condition, renderOptions);
			if (templateFallback) {
				console.log(`✅ Svelte template fallback succeeded, returning result`);
				return templateFallback;
			} else {
				console.log(`⚠️ Svelte template fallback returned null`);
			}
		} catch (fallbackError) {
			console.error(`❌ Svelte template fallback failed:`, fallbackError);
		}
	}

	// Fallback to client-only (or SSR-only if specified)
	console.log(`🔄 Svelte SSR failed, falling back to ${ssrOnly ? 'SSR-only' : 'client-only'} for ${src}`);
	return Island({
		src,
		condition: ssrOnly ? condition : 'on:client',
		props,
		ssr: false,
		framework: 'svelte',
		ssrOnly,
		renderOptions,
	});
}

/**
 * Render Preact component with SSR
 */
async function renderPreactComponent({
	src,
	condition,
	props,
	ssr: _ssr,
	renderOptions = {},
	ssrOnly = false,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	ssr: boolean;
	renderOptions?: AnalyzerOptions;
	ssrOnly?: boolean;
}): Promise<JSX.Element> {
	console.log(`🔄 Attempting Preact SSR for: ${src}`);

	try {
		const isDev = Deno.env.get('DENO_ENV') !== 'production';

		if (isDev) {
			// In development, use Vite's ssrLoadModule
			const viteServer = globalThis.__viteDevServer;
			if (viteServer) {
				console.log(`📡 Loading Preact component: ${src}`);
				const module = await viteServer.ssrLoadModule(src);
				const PreactComponent = module.default || module;

				if (!PreactComponent || typeof PreactComponent !== 'function') {
					throw new Error(`Invalid Preact component in ${src}`);
				}

				return renderPreactToString(PreactComponent, props, src, condition, ssrOnly, renderOptions);
			}
		} else {
			// In production, load from pre-built SSR bundle
			const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace(/\.(tsx|jsx)$/, '.js');
			console.log(`📦 Loading Preact SSR bundle: ${ssrPath}`);
			const module = await import(ssrPath);
			const PreactComponent = module.default || module;
			return renderPreactToString(PreactComponent, props, src, condition, ssrOnly, renderOptions);
		}
	} catch (error) {
		console.error(`❌ Preact SSR failed for ${src}:`, error);
	}

	// Fallback to client-only (or SSR-only if specified)
	console.log(`🔄 Preact SSR failed, falling back to ${ssrOnly ? 'SSR-only' : 'client-only'} for ${src}`);
	return Island({ src, condition: ssrOnly ? condition : 'on:client', props, ssr: false, ssrOnly, renderOptions });
}

/**
 * Render Preact component to string
 */
function renderPreactToString(
	component: () => JSX.Element,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:client',
	ssrOnly: boolean = false,
	renderOptions: AnalyzerOptions = {}
): JSX.Element {
	try {
		// Render component directly, then add hydration attributes
		const ssrHtml = renderToString(h(component, props));

		return Island({
			src,
			condition,
			props,
			children: ssrHtml,
			ssr: true,
			framework: 'preact',
			ssrOnly,
			renderOptions,
		});
	} catch (error) {
		console.error(`❌ Preact renderToString failed for ${src}:`, error);
		return Island({
			src,
			condition: ssrOnly ? condition : 'on:client',
			props,
			ssr: false,
			framework: 'preact',
			ssrOnly,
			renderOptions,
		});
	}
}

/**
 * Render Vue component to string with proper SSR/hydration setup
 *
 * Based on Vue.js SSR documentation and Astro's Vue integration:
 * - Creates proper SSR app with createSSRApp
 * - Wraps SSR HTML in a div with data-server-rendered="true"
 * - Uses consistent container structure for client hydration
 */
async function renderVueToString(
	VueComponent: Record<string, unknown>,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:client',
	ssrOnly: boolean = false,
	renderOptions: AnalyzerOptions = {}
): Promise<JSX.Element> {
	try {
		// CRITICAL FIX: Import the dedicated Vue server renderer.
		// This ensures the server-generated HTML is compatible with client hydration.
		const { renderToString: vueRenderToString } = await import('vue/server-renderer');
		const { createSSRApp } = await import('vue');

		// Create a new Vue app instance for each server-side render
		const app = createSSRApp(VueComponent, props);
		const ssrHtml = await vueRenderToString(app);

		console.log(`✅ Vue component rendered successfully with vue/server-renderer for ${src}`);

		// Generate deterministic container ID (SSR-safe)
		const containerId = `vue-component--${src.replace(/[^a-zA-Z0-9]/g, '-')}`;

		// Use Island component with proper SSR-only handling
		return Island({
			src,
			condition,
			props,
			children: ssrHtml,
			ssr: true,
			ssrOnly,
			renderOptions,
		});
	} catch (error: unknown) {
		console.error(`❌ Vue renderToString failed for ${src}:`, error);
		throw `❌ Vue renderToString failed for ${src}: ${error}`;
	}
}

/**
 * Render Solid component using proper SSR approach with semantic is-land element
 */
async function renderSolidToString(
	SolidComponent: (props: Record<string, unknown>) => unknown,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:client'
): Promise<JSX.Element> {
	try {
		console.log(`🔄 Rendering Solid component to string for ${src}`);

		// Import Solid.js SSR utilities
		let renderToStringAsync: (fn: () => unknown) => Promise<string>;

		try {
			const solidWeb = await import('solid-js/web');
			renderToStringAsync = (solidWeb.renderToStringAsync ||
				solidWeb.default?.renderToStringAsync) as typeof renderToStringAsync;

			if (!renderToStringAsync) {
				// Fallback to synchronous renderToString
				const renderToString = (solidWeb.renderToString || solidWeb.default?.renderToString) as (
					fn: () => unknown
				) => string;
				if (!renderToString) {
					throw new Error('Neither renderToStringAsync nor renderToString found in solid-js/web import');
				}
				renderToStringAsync = fn => Promise.resolve(renderToString(fn));
			}
		} catch (importError: unknown) {
			console.error(`Failed to import solid-js/web:`, importError);
			const errorMessage = importError instanceof Error ? importError.message : String(importError);
			throw new Error(`Cannot import solid-js/web: ${errorMessage}`);
		}

		console.log(`📦 Successfully imported solid-js/web for ${src}`);

		// Validate component
		if (typeof SolidComponent !== 'function') {
			throw new Error(`Expected SolidComponent to be a function, got ${typeof SolidComponent}`);
		}

		// Render the component - SolidJS will add its own hydration markers
		const ssrHtml = await renderToStringAsync(() => SolidComponent(props));

		if (!ssrHtml || typeof ssrHtml !== 'string') {
			throw new Error(`renderToStringAsync returned invalid result: ${typeof ssrHtml}`);
		}

		console.log(`✅ Solid component rendered successfully for ${src}, HTML length: ${ssrHtml.length}`);

		// Generate deterministic container ID (SSR-safe)
		const containerId = `solid-island-${src.replace(/[^a-zA-Z0-9]/g, '-')}`;

		// Use semantic is-land element with dedicated Solid hydration attributes
		return h('is-land', {
			id: containerId,
			'data-solid-hydrate': src,
			'data-solid-props': JSON.stringify(props),
			'data-solid-condition': condition,
			dangerouslySetInnerHTML: { __html: ssrHtml },
		});
	} catch (error: unknown) {
		console.error(`❌ Solid SSR failed for ${src}:`, error);
		throw `❌ Solid renderToString failed for ${src}: ${error}`;
	}
}

/**
 * Render Svelte component to string using Svelte 5 SSR approach
 */
async function renderSvelteToString(
	SvelteComponent: Component,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:client',
	ssrOnly: boolean = false,
	renderOptions: AnalyzerOptions = {}
): Promise<JSX.Element> {
	try {
		console.log(`🔄 Rendering Svelte component to string for ${src}`);

		// Import Svelte 5 render function
		const { render } = await import('svelte/server');
		console.log(`📦 Using Svelte 5 render from svelte/server`);

		// Use Svelte 5 render API
		console.log(`🔍 About to call Svelte render() for ${src}`);
		const result = render(SvelteComponent, { props });
		console.log(`🔍 Svelte render() result:`, {
			hasBody: !!result.body,
			bodyType: typeof result.body,
			bodyLength: result.body?.length,
			hasHead: !!result.head,
			headType: typeof result.head,
			headLength: result.head?.length,
			resultKeys: Object.keys(result),
		});

		const ssrHtml = result.body; // Svelte 5 returns { body, head }
		const ssrHead = result.head; // Contains CSS and other head content

		// Log the head content for debugging
		if (ssrHead) {
			console.log(`📝 Svelte component has head content: ${ssrHead.length} chars`);
			console.log(`📝 Head content preview:`, ssrHead.substring(0, 300));

			// Collect CSS globally for document head injection
			if (globalThis.__svelteSSRCSS && ssrHead.trim()) {
				globalThis.__svelteSSRCSS.add(ssrHead);
				console.log(`📝 Added Svelte CSS to global collector, total styles: ${globalThis.__svelteSSRCSS.size}`);
			}
		} else {
			console.log(`⚠️ No head content from Svelte SSR - this is the problem!`);
		}

		if (!ssrHtml || typeof ssrHtml !== 'string') {
			throw new Error(`Svelte render returned invalid HTML: ${typeof ssrHtml}`);
		}

		console.log(`✅ Svelte component rendered successfully for ${src}, HTML length: ${ssrHtml.length}`);
		console.log(`📝 Body HTML preview:`, ssrHtml.substring(0, 300));

		// For now, let's include the CSS inline to ensure it works
		// This is not ideal but will help us debug
		const styledContent = ssrHead ? `${ssrHead}${ssrHtml}` : ssrHtml;

		// Return Island component with SSR content and Svelte-specific attributes
		return Island({
			src,
			condition,
			props,
			children: styledContent, // Include CSS inline for now
			ssr: true,
			framework: 'svelte',
			ssrOnly,
			renderOptions,
		});
	} catch (error: unknown) {
		console.error(`❌ Svelte SSR failed for ${src}:`, error);
		throw `❌ Svelte renderToString failed for ${src}: ${error}`;
	}
}
/**
 * Template-based fallback for Svelte SSR-only components when full SSR fails
 * This handles props and styles properly without requiring a full Svelte runtime
 */
async function renderSvelteTemplateFallback(
	src: string,
	props: Record<string, unknown>,
	condition: IslandProps['condition'],
	renderOptions: AnalyzerOptions
): Promise<JSX.Element | null> {
	try {
		// Try multiple path variations to find the component
		const pathVariations = [
			src.startsWith('/') ? src.substring(1) : src,
			`examples/${src.split('/').pop()}`,
			`src/islands/${src.split('/').pop()}`,
			`islands/${src.split('/').pop()}`,
		];

		let componentContent = '';
		for (const pathVariation of pathVariations) {
			try {
				componentContent = await Deno.readTextFile(pathVariation);
				break;
			} catch {
				continue;
			}
		}

		if (!componentContent) {
			return null;
		}

		// Parse the Svelte component more carefully
		const result = parseSvelteComponent(componentContent, props);

		if (!result.template) {
			return null;
		}

		// Combine styles and template
		let content = result.template;
		if (result.styles) {
			content = `<style>${result.styles}</style>${result.template}`;
		}

		console.log(`✅ Svelte template fallback successful for ${src}`);

		return Island({
			src,
			condition,
			props,
			children: content,
			ssr: true,
			framework: 'svelte',
			ssrOnly: true,
			renderOptions,
		});
	} catch (error) {
		console.warn(`Svelte template fallback failed for ${src}:`, error);
		return null;
	}
}

/**
 * Parse Svelte component and handle props/styles properly
 */
function parseSvelteComponent(
	content: string,
	props: Record<string, unknown>
): {
	template: string;
	styles: string;
} {
	// Extract styles first
	const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
	let styles = '';
	if (styleMatches) {
		styles = styleMatches
			.map(match => {
				const styleContent = match.replace(/<\/?style[^>]*>/gi, '');
				return styleContent.trim();
			})
			.join('\n');
	}

	// Remove script and style sections to get template
	let template = content
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script sections
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style sections
		.trim();

	// Handle prop interpolation more intelligently
	for (const [key, value] of Object.entries(props)) {
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			// Replace {prop} with the actual value
			template = template.replace(new RegExp(`\\{\\s*${key}\\s*\\}`, 'g'), String(value));
		}
	}

	// Handle common Svelte patterns for static rendering
	template = template
		// Remove remaining expressions but preserve the structure
		.replace(/\{[^}]*\}/g, '')
		// Remove event handlers but keep the element structure
		.replace(/\s*on:[a-z-]+\s*=\s*[^>\s]*/gi, '')
		// Remove bindings
		.replace(/\s*bind:[a-z-]+\s*=\s*[^>\s]*/gi, '')
		// Remove actions
		.replace(/\s*use:[a-z-]+\s*=\s*[^>\s]*/gi, '')
		// Remove class directives
		.replace(/\s*class:[a-z-]+\s*=\s*[^>\s]*/gi, '')
		// Clean up extra whitespace
		.replace(/\s+/g, ' ')
		.trim();

	return { template, styles };
}
/**
 * Template-based fallback for Vue SSR-only components when full SSR fails
 */
async function renderVueTemplateFallback(
	src: string,
	props: Record<string, unknown>,
	condition: IslandProps['condition'],
	renderOptions: AnalyzerOptions
): Promise<JSX.Element | null> {
	try {
		// Try multiple path variations to find the component
		const pathVariations = [
			src.startsWith('/') ? src.substring(1) : src,
			`examples/${src.split('/').pop()}`,
			`src/islands/${src.split('/').pop()}`,
			`islands/${src.split('/').pop()}`,
		];

		let componentContent = '';
		for (const pathVariation of pathVariations) {
			try {
				componentContent = await Deno.readTextFile(pathVariation);
				break;
			} catch {
				continue;
			}
		}

		if (!componentContent) {
			return null;
		}

		// Parse the Vue component
		const result = parseVueComponent(componentContent, props);

		if (!result.template) {
			return null;
		}

		// Combine styles and template
		let content = result.template;
		if (result.styles) {
			content = `<style>${result.styles}</style>${result.template}`;
		}

		console.log(`✅ Vue template fallback successful for ${src}`);

		return Island({
			src,
			condition,
			props,
			children: content,
			ssr: true,
			ssrOnly: true,
			renderOptions,
		});
	} catch (error) {
		console.warn(`Vue template fallback failed for ${src}:`, error);
		return null;
	}
}

/**
 * Parse Vue component and handle props/styles properly
 */
function parseVueComponent(
	content: string,
	props: Record<string, unknown>
): {
	template: string;
	styles: string;
} {
	// Extract template content
	const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/i);
	if (!templateMatch) {
		return { template: '', styles: '' };
	}

	let template = templateMatch[1].trim();

	// Extract styles
	const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
	let styles = '';
	if (styleMatches) {
		styles = styleMatches
			.map(match => {
				const styleContent = match.replace(/<\/?style[^>]*>/gi, '');
				return styleContent.trim();
			})
			.join('\n');
	}

	// Handle prop interpolation for Vue - replace {{prop}} patterns
	for (const [key, value] of Object.entries(props)) {
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			// Replace {{prop}} with the actual value
			template = template.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), String(value));
		}
	}

	// Remove remaining Vue directives and interpolations for static rendering
	template = template
		// Remove remaining interpolations
		.replace(/\{\{[^}]*\}\}/g, '')
		// Remove Vue directives but keep the element structure
		.replace(/\s*v-[a-z-]+\s*=\s*"[^"]*"/gi, '')
		.replace(/\s*v-[a-z-]+\s*=\s*'[^']*'/gi, '')
		// Remove event handlers
		.replace(/\s*@[a-z-]+\s*=\s*"[^"]*"/gi, '')
		.replace(/\s*@[a-z-]+\s*=\s*'[^']*'/gi, '')
		// Remove prop bindings
		.replace(/\s*:[a-z-]+\s*=\s*"[^"]*"/gi, '')
		.replace(/\s*:[a-z-]+\s*=\s*'[^']*'/gi, '')
		// Clean up extra whitespace
		.replace(/\s+/g, ' ')
		.trim();

	return { template, styles };
}
