/**
 * Vue Server Renderer
 *
 * Provides server-side rendering capabilities for Vue components.
 * Uses Vue's official SSR API with proper hydration support.
 *
 * Migrated from src/islands/renderers/vue-renderer.ts
 */

import { resolveIslandPath } from "@useavalon/avalon/islands/framework-detection";
import type { RenderParams, RenderResult } from "@useavalon/core/types";
import { toImportSpecifier } from "@useavalon/core/utils";
import { createSSRApp } from "vue";
import { renderToString as vueRenderToString } from "vue/server-renderer";
import { extractCSS } from "./css-extractor.ts";

/**
 * Render a Vue component to HTML string with SSR
 *
 * Creates a Vue SSR app instance and renders it to string.
 * Extracts and applies scoped CSS from the component.
 *
 * Based on Vue.js SSR documentation and Astro's Vue integration:
 * - Creates proper SSR app with createSSRApp
 * - Wraps SSR HTML in a div with data-server-rendered="true"
 * - Uses consistent container structure for client hydration
 *
 * @param params - Render parameters including component, props, and source path
 * @returns Render result with HTML, CSS, and hydration data
 */
export async function render(params: RenderParams): Promise<RenderResult> {
	const {
		component: _component,
		props = {},
		src,
		condition = "on:client",
		ssrOnly = false,
	} = params;

	try {
		const VueComponent = _component || (await loadComponent(src));

		const app = createSSRApp(VueComponent as any, props);
		const ssrHtml = await vueRenderToString(app);

		// Extract the scope ID from the compiled Vue SFC. The Vue compiler
		// sets __scopeId on the component (e.g. "data-v-1c086bc5") and
		// renderToString applies it to the HTML. We use the same ID to
		// scope the extracted CSS so SSR styles match the SSR HTML and
		// the client build's compiled output.
		const compiledScopeId = (VueComponent as any).__scopeId as string | undefined;

		let componentCSS = "";
		if (compiledScopeId) {
			try {
				// Extract raw CSS from the .vue file's <style scoped> blocks,
				// then apply the compiler's scope ID (not a custom one).
				componentCSS = await extractCSS(src, { scopeId: compiledScopeId });
			} catch {
				// CSS extraction may fail in production if the raw .vue file
				// isn't available — the client CSS chunk covers it.
			}
		}

		return {
			html: ssrHtml,
			css: componentCSS || undefined,
			scopeId: compiledScopeId || undefined,
			hydrationData: { src, props, framework: "vue", condition, ssrOnly },
		};
	} catch (error) {
		throw new Error(`Vue SSR rendering failed: ${error}`);
	}
}

/**
 * Load a Vue component module
 *
 * Handles both development (via Vite) and production (pre-built) scenarios.
 *
 * @param src - Component source path
 * @returns Vue component module
 */
async function loadComponent(src: string) {
	const isDev = process.env.NODE_ENV !== "production";

	if (isDev && (globalThis as any).__viteDevServer) {
		// Development: use Vite's SSR module loading

		const viteServer = (globalThis as any).__viteDevServer;
		const resolvedPath = await resolveIslandPath(src);
		const module = await viteServer.ssrLoadModule(resolvedPath);
		return module.default || module;
	}

	// Production: load from build output
	const ssrPath = src.replace("/islands/", "/dist/ssr/islands/").replace(".vue", ".js");

	const module = await import(
		/* @vite-ignore */
		toImportSpecifier(ssrPath)
	);
	return module.default || module;
}

/**
 * Get component metadata for debugging
 *
 * @param component - Vue component
 * @returns Component metadata object
 */
export function getComponentMetadata(component: unknown) {
	if (typeof component === "object" && component !== null) {
		return {
			name: (component as { name?: string }).name || "Anonymous",
			type: "component",
			hasSetup: "setup" in component,
			hasTemplate: "template" in component,
			hasRender: "render" in component,
		};
	}

	return {
		type: typeof component,
	};
}
