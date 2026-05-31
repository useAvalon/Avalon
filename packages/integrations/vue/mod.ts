/**
 * Vue Integration for Avalon
 *
 * Provides Vue 3 support with SSR, hydration, and scoped CSS extraction.
 * This integration enables Vue Single File Components (.vue) to work
 * seamlessly with Avalon's islands architecture.
 */

import type { Integration, IntegrationConfig } from "@useavalon/core/types";
import type { Plugin } from "vite";
import { getHydrationScript } from "./client/hydration.ts";
import { render } from "./server/renderer.ts";

/**
 * Vue integration instance
 *
 * Implements the standard Integration interface for Vue components.
 */
export const vueIntegration: Integration = {
	name: "vue",
	version: "0.1.0",

	render,
	getHydrationScript,

	config(): IntegrationConfig {
		return {
			name: "vue",
			fileExtensions: [".vue"],
			jsxImportSources: [],
			detectionPatterns: {
				imports: [/^vue$/, /^vue\//, /from\s+['"]vue['"]/],
				content: [
					/<template>/,
					/<script.*setup>/,
					/\bdefineComponent\b/,
					/\bref\b/,
					/\breactive\b/,
					/\bcomputed\b/,
				],
			},
		};
	},

	/**
	 * Provides the @vitejs/plugin-vue Vite plugin with avalon-island custom element configuration.
	 * This allows Vue components to work seamlessly with Avalon's islands architecture.
	 */
	async vitePlugin(): Promise<Plugin | Plugin[]> {
		const { default: vue } = await import("@vitejs/plugin-vue");
		return vue({
			template: {
				compilerOptions: {
					// Treat avalon-island as a custom element so Vue doesn't try to resolve it
					isCustomElement: (tag: string) => tag === "avalon-island",
				},
			},
		});
	},
};

export { getHydrationScript, hydrate } from "./client/hydration.ts";
export { applyScopedCSS, extractCSS, generateScopeId } from "./server/css-extractor.ts";
// Re-export public API
export { render } from "./server/renderer.ts";
export type * from "./types.ts";
