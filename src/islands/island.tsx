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
}

/**
 * Universal Island component - renders components directly with optional hydration
 *
 * Just like traditional SSR: render component to HTML, then hydrate in place
 */
export default function Island({
	src,
	condition = 'on:load',
	props = {},
	children,
	ssr = condition !== 'on:client',
}: IslandProps): JSX.Element {
	// If we have SSR content (children), render it directly
	if (ssr && children) {
		// Generate unique ID for hydration
		const islandId = `island-${Math.random().toString(36).substr(2, 9)}`;
		const bundlePath = getIslandBundlePath(src);

		// Render the component directly with hydration attributes
		if (typeof children === 'string') {
			return h('div', {
				id: islandId,
				'data-hydrate': bundlePath,
				'data-condition': condition,
				'data-props': JSON.stringify(props),
				dangerouslySetInnerHTML: { __html: children },
			});
		} else {
			// For JSX children, wrap with hydration attributes
			return h(
				'div',
				{
					id: islandId,
					'data-hydrate': bundlePath,
					'data-condition': condition,
					'data-props': JSON.stringify(props),
				},
				children
			);
		}
	}

	// Client-only: render placeholder that will be hydrated
	const islandId = `island-${Math.random().toString(36).substr(2, 9)}`;
	const bundlePath = getIslandBundlePath(src);

	return h('div', {
		id: islandId,
		'data-hydrate': bundlePath,
		'data-condition': condition,
		'data-props': JSON.stringify(props),
	});
}

/**
 * Async Island component that automatically handles Vue SSR
 */
export async function AsyncIsland({
	src,
	condition = 'on:load',
	props = {},
	children,
	ssr = condition !== 'on:client',
}: IslandProps): Promise<JSX.Element> {
	console.log(`🏝️ AsyncIsland called for: ${src}, ssr: ${ssr}`);

	// If we have SSR content (children), render it directly
	if (ssr && children) {
		console.log(`✅ Using provided children for ${src}`);
		return Island({ src, condition, props, children, ssr });
	}

	// Auto-SSR for Vue files
	if (ssr && src.endsWith('.vue')) {
		console.log(`🔄 Attempting Vue SSR for: ${src}`);
		try {
			// Use Vite's SSR compilation to load the Vue component
			const isDev = Deno.env.get('DENO_ENV') !== 'production';

			if (isDev) {
				// In development, use Vite's ssrLoadModule to compile and load the component
				const viteServer = globalThis.__viteDevServer;
				if (viteServer) {
					console.log(`📡 Using Vite SSR for ${src}`);
					const module = await viteServer.ssrLoadModule(src);
					const VueComponent = module.default || module;
					const result = await renderVueIsland(VueComponent, props, src, condition);
					console.log(`✅ Vue SSR successful for ${src}`);
					return result;
				} else {
					console.warn(`⚠️ No Vite server available for ${src}`);
				}
			} else {
				// In production, load from pre-built SSR bundle
				const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace('.vue', '.js');
				console.log(`📦 Loading SSR bundle: ${ssrPath}`);
				const module = await import(ssrPath);
				const VueComponent = module.default || module;
				return await renderVueIsland(VueComponent, props, src, condition);
			}
		} catch (error) {
			console.error(`❌ Vue SSR failed for ${src}:`, error);
		}

		// Fallback to client-only with hydration placeholder
		console.log(`⚠️ Falling back to client-only with placeholder for ${src}`);
		return Island({
			src,
			condition,
			props,
			ssr: true, // We want the placeholder to render
			children: `<div class="island-placeholder" style="padding: 20px; background: #f0f0f0; border: 1px dashed #ccc; text-align: center;">Loading ${src
				.split('/')
				.pop()}...</div>`,
		});
	}

	// For non-Vue files or when SSR is disabled, use regular Island
	console.log(`📄 Using regular Island for ${src}`);
	return Island({ src, condition, props, children, ssr });
}

/**
 * Render Preact component with SSR + hydration
 */
export function renderPreactIsland(
	component: () => JSX.Element,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:load'
): JSX.Element {
	// Render component directly, then add hydration attributes
	const ssrHtml = renderToString(h(component, props));

	return Island({
		src,
		condition,
		props,
		children: ssrHtml,
		ssr: true,
	});
}

/**
 * Render Vue component with SSR + hydration
 */
export async function renderVueIsland(
	VueComponent: Record<string, unknown>,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:load'
): Promise<JSX.Element> {
	try {
		// Import Vue SSR dependencies with multiple fallback strategies
		let vueRenderToString, createSSRApp;

		try {
			// Strategy 1: Try to use Vite's resolved modules
			const viteServer = globalThis.__viteDevServer;
			if (viteServer) {
				// Get the Vue component first to ensure Vite has resolved Vue dependencies
				const componentModule = await viteServer.ssrLoadModule(src);

				// Now try to load Vue dependencies through Vite
				try {
					const vue = await viteServer.ssrLoadModule('vue');
					const vueSSR = await viteServer.ssrLoadModule('vue/server-renderer');
					createSSRApp = vue.createSSRApp || vue.default?.createSSRApp;
					vueRenderToString = vueSSR.renderToString || vueSSR.default?.renderToString;
				} catch (viteVueError) {
					// Strategy 2: Direct import with version-agnostic approach
					console.log('Vite Vue loading failed, trying direct import...');
					const vue = await import('vue');
					const vueSSR = await import('vue/server-renderer');
					createSSRApp = vue.createSSRApp;
					vueRenderToString = vueSSR.renderToString;
				}
			} else {
				throw new Error('No Vite server available');
			}
		} catch (importError) {
			// Strategy 3: Try npm: prefix as last resort
			console.log('Standard imports failed, trying npm: prefix...');
			try {
				const vue = await import('vue');
				const vueSSR = await import('vue/server-renderer');
				createSSRApp = vue.createSSRApp;
				vueRenderToString = vueSSR.renderToString;
			} catch (npmError) {
				throw new Error(`All Vue import strategies failed. Original: ${importError}, npm: ${npmError}`);
			}
		}

		if (!createSSRApp || !vueRenderToString) {
			throw new Error('Vue SSR functions not found after import');
		}

		// Render Vue component directly to HTML
		const app = createSSRApp(VueComponent, props);
		const ssrHtml = await vueRenderToString(app);

		return Island({
			src,
			condition,
			props,
			children: ssrHtml,
			ssr: true,
		});
	} catch (error) {
		console.warn(`Vue SSR failed, falling back to client-only:`, error);
		return Island({
			src,
			condition: 'on:client',
			props,
			ssr: false,
		});
	}
}

/**
 * Render Solid component with SSR + hydration
 */
export async function renderSolidIsland(
	SolidComponent: (props: Record<string, unknown>) => unknown,
	props: Record<string, unknown> = {},
	src: string,
	condition: IslandProps['condition'] = 'on:load'
): Promise<JSX.Element> {
	try {
		// Dynamic import Solid SSR
		const { renderToString: solidRenderToString } = await import('solid-js/web');

		// Render Solid component directly to HTML
		const ssrHtml = solidRenderToString(() => SolidComponent(props));

		return Island({
			src,
			condition,
			props,
			children: ssrHtml,
			ssr: true,
		});
	} catch (error) {
		console.warn(`Solid SSR failed, falling back to client-only:`, error);
		return Island({
			src,
			condition: 'on:client',
			props,
			ssr: false,
		});
	}
}
