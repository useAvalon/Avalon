import type { JSX } from 'preact';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { getIslandBundlePath } from '../build/island-manifest.ts';
import type { ViteDevServer } from 'vite';

// Extend globalThis to include Vite dev server
declare global {
	var __viteDevServer: ViteDevServer | undefined;
}

export interface IslandProps {
	/** Path to the island component (e.g., "/islands/Counter.tsx") */
	src: string;
	/** Hydration condition */
	condition?: 'on:load' | 'on:visible' | 'on:interaction' | 'on:idle' | 'on:client' | `media:${string}`;
	/** Props to pass to the island component */
	props?: Record<string, unknown>;
	/** Children to render inside the island (for SSR) */
	children?: JSX.Element | JSX.Element[] | string;
	/** Whether to render server-side (default: true unless condition is 'on:client') */
	ssr?: boolean;
	/** Framework hint for client hydration */
	framework?: 'solid' | 'vue' | 'preact' | 'react';
}

/**
 * Universal Island component - renders <is-land> custom elements for better DOM structure
 *
 * Uses custom elements instead of div wrappers for cleaner, more semantic markup
 */
export default function Island({
	src,
	condition = 'on:load',
	props = {},
	children,
	ssr = condition !== 'on:client',
	framework,
}: IslandProps): JSX.Element {
	// Generate deterministic ID for the island (SSR-safe)
	// Use src path to ensure server and client generate the same ID
	const islandId = `island-${src.replace(/[^a-zA-Z0-9]/g, '-')}`;
	const bundlePath = getIslandBundlePath(src);

	// If we have SSR content (children), render it directly in the is-land element
	if (ssr && children) {
		if (typeof children === 'string') {
			return h('is-land', {
				id: islandId,
				'data-island': condition,
				'data-hydrate': bundlePath,
				'data-props': JSON.stringify(props),
				...(framework ? { 'data-framework': framework } : {}),
				dangerouslySetInnerHTML: { __html: children },
			});
		} else {
			// For JSX children, include them directly
			return h(
				'is-land',
				{
					id: islandId,
					'data-island': condition,
					'data-hydrate': bundlePath,
					'data-props': JSON.stringify(props),
					...(framework ? { 'data-framework': framework } : {}),
				},
				children
			);
		}
	}

	// Client-only: render empty is-land that will be hydrated
	return h('is-land', {
		id: islandId,
		'data-island': condition,
		'data-hydrate': bundlePath,
		'data-props': JSON.stringify(props),
		...(framework ? { 'data-framework': framework } : {}),
	});
}

/**
 * Universal renderIsland function - auto-detects framework and handles SSR + hydration
 *
 * This is the main function you should use - it automatically:
 * - Detects the component framework (Vue, Solid.js, Preact/React)
 * - Handles server-side rendering when possible
 * - Falls back to client-only rendering when needed
 * - Returns the appropriate Island component
 */
export async function renderIsland({
	src,
	condition = 'on:load',
	props = {},
	children,
	ssr = condition !== 'on:client',
}: IslandProps): Promise<JSX.Element> {
	console.log(`🏝️ renderIsland called for: ${src}, ssr: ${ssr}, condition: ${condition}`);

	// If SSR is disabled or we already have children, use basic Island
	if (!ssr || children) {
		console.log(`📄 Using basic Island (SSR disabled or children provided)`);
		return Island({ src, condition, props, children, ssr });
	}

	// Auto-detect framework and attempt SSR
	try {
		// Vue detection
		if (src.endsWith('.vue')) {
			console.log(`🔍 Detected Vue component: ${src}`);
			return await renderVueComponent({ src, condition, props, ssr });
		}

		// TypeScript/JavaScript files
		if (src.endsWith('.tsx') || src.endsWith('.jsx') || src.endsWith('.ts') || src.endsWith('.js')) {
			const framework = await detectFramework(src);
			console.log(`🔍 Detected framework: ${framework} for ${src}`);

			switch (framework) {
				case 'solid':
					return await renderSolidComponent({ src, condition, props, ssr });
				case 'vue':
					return await renderVueComponent({ src, condition, props, ssr });
				case 'preact':
				case 'react':
				default:
					return await renderPreactComponent({ src, condition, props, ssr });
			}
		}

		// Unknown file type, use basic Island
		console.log(`❓ Unknown file type for ${src}, using basic Island`);
		return Island({ src, condition, props, children: undefined, ssr: false });
	} catch (error) {
		console.error(`❌ SSR failed for ${src}:`, error);
		console.log(`🔄 Falling back to client-only rendering`);
		return Island({ src, condition: 'on:client', props, ssr: false });
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
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	ssr: boolean;
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
				return await renderVueToString(VueComponent, props, src, condition);
			}
		} else {
			// In production, load from pre-built SSR bundle
			const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace('.vue', '.js');
			console.log(`📦 Loading Vue SSR bundle: ${ssrPath}`);
			const module = await import(ssrPath);
			const VueComponent = module.default || module;
			return await renderVueToString(VueComponent, props, src, condition);
		}
	} catch (error) {
		console.error(`❌ Vue SSR failed for ${src}:`, error);
	}

	// Fallback to client-only
	console.log(`🔄 Vue SSR failed, falling back to client-only for ${src}`);
	return Island({ src, condition: 'on:client', props, ssr: false });
}

/**
 * Render Solid component with SSR
 */
async function renderSolidComponent({
	src,
	condition,
	props,
	ssr: _ssr,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	ssr: boolean;
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

	// Fallback to client-only
	console.log(`🔄 Solid SSR failed, falling back to client-only for ${src}`);
	return Island({ src, condition: 'on:client', props, ssr: false });
}

/**
 * Render Preact component with SSR
 */
async function renderPreactComponent({
	src,
	condition,
	props,
	ssr: _ssr,
}: {
	src: string;
	condition: IslandProps['condition'];
	props: Record<string, unknown>;
	ssr: boolean;
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

				return renderPreactToString(PreactComponent, props, src, condition);
			}
		} else {
			// In production, load from pre-built SSR bundle
			const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace(/\.(tsx|jsx)$/, '.js');
			console.log(`📦 Loading Preact SSR bundle: ${ssrPath}`);
			const module = await import(ssrPath);
			const PreactComponent = module.default || module;
			return renderPreactToString(PreactComponent, props, src, condition);
		}
	} catch (error) {
		console.error(`❌ Preact SSR failed for ${src}:`, error);
	}

	// Fallback to client-only
	console.log(`🔄 Preact SSR failed, falling back to client-only for ${src}`);
	return Island({ src, condition: 'on:client', props, ssr: false });
}

/**
 * Render Preact component to string
 */
function renderPreactToString(
	component: () => JSX.Element,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:load'
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
		});
	} catch (error) {
		console.error(`❌ Preact renderToString failed for ${src}:`, error);
		return Island({ src, condition: 'on:client', props, ssr: false, framework: 'preact' });
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
	condition: IslandProps['condition'] = 'on:load'
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

		// CRITICAL FIX: Use standard div element with data-hydrate attributes (working branch pattern)
		// This matches the working branch's AsyncIsland pattern
		return h('div', {
			id: containerId,
			'data-hydrate': src,
			'data-props': JSON.stringify(props),
			'data-condition': condition,
			dangerouslySetInnerHTML: { __html: ssrHtml },
		});
	} catch (error: unknown) {
		console.error(`❌ Vue renderToString failed for ${src}:`, error);
		// Fallback to client-only rendering with placeholder
		const containerId = `vue-component--${src.replace(/[^a-zA-Z0-9]/g, '-')}-fallback`;
		return h('div', {
			id: containerId,
			'data-hydrate': src,
			'data-props': JSON.stringify(props),
			'data-condition': 'on:client',
			// Empty content - client will render from scratch
		});
	}
}

/**
 * Render Solid component using proper SSR approach with semantic is-land element
 */
async function renderSolidToString(
	SolidComponent: (props: Record<string, unknown>) => unknown,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:load'
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
		// Fallback to client-only rendering with placeholder
		const containerId = `solid-island-${src.replace(/[^a-zA-Z0-9]/g, '-')}-fallback`;
		return h('is-land', {
			id: containerId,
			'data-solid-hydrate': src,
			'data-solid-props': JSON.stringify(props),
			'data-solid-condition': 'on:client',
		});
	}
}
