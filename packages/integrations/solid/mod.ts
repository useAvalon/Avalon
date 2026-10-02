/**
 * @useavalon/solid
 *
 * Solid integration for Avalon framework
 * Provides server-side rendering and client-side hydration for Solid components
 */

import type { Integration, IntegrationConfig } from "@useavalon/core/types";
import type { Plugin } from "vite";
import { render } from "./server/renderer.ts";

/**
 * Solid integration configuration
 */
const config: IntegrationConfig = {
	name: "solid",
	fileExtensions: [".tsx", ".jsx", ".ts", ".js"],
	jsxImportSources: ["solid-js", "solid-js/h"],
	detectionPatterns: {
		imports: [
			/^solid-js$/,
			/^solid-js\//,
			/from\s+['"]solid-js['"]/,
			/from\s+['"]solid-js\/[^'"]+['"]/,
		],
		content: [
			/\bcreateSignal\b/,
			/\bcreateEffect\b/,
			/\bcreateMemo\b/,
			/\bcreateResource\b/,
			/\bShow\b/,
			/\bFor\b/,
			/\bSwitch\b/,
			/\bMatch\b/,
			/\bSuspense\b/,
			/\bErrorBoundary\b/,
			/\.solid\./,
		],
	},
};

/**
 * Solid integration object
 * Implements the Integration interface
 */
export const solidIntegration: Integration = {
	name: "solid",
	version: "0.1.0",

	render,

	config(): IntegrationConfig {
		return config;
	},

	/**
	 * Provides the vite-plugin-solid Vite plugin with SSR configuration.
	 * Includes only .solid.tsx/.solid.jsx files to avoid conflicts with React/Preact.
	 *
	 * Returns three companion plugins:
	 *
	 * 1. **avalon:solid-oxc-exclude** — Excludes .solid.tsx/.solid.jsx from Vite 8's
	 *    built-in vite:oxc plugin via the config() hook. Without this, OXC re-compiles
	 *    the JSX that vite-plugin-solid's Babel transform already compiled to SSR
	 *    template calls (_$ssr), overwriting them with DOM-style code (_$template).
	 *
	 * 2. **vite-plugin-solid** (the upstream plugin) — Compiles Solid JSX to SSR or DOM
	 *    code via Babel. Its Babel parser handles TypeScript syntax (parserOpts.plugins
	 *    includes 'typescript'), but the preset-solid Babel preset does NOT strip
	 *    TypeScript type annotations from the output. `hot: false` disables
	 *    solid-refresh HMR wrapping — its createMemo wrapper adds an extra reactive
	 *    node that shifts hydration key counters vs the SSR output (which has no
	 *    solid-refresh), causing "Hydration Mismatch" errors. Avalon's own HMR
	 *    coordinator handles island hot-reloading instead.
	 *
	 * 3. **avalon:solid-ts-strip** — Strips remaining TypeScript syntax from the solid
	 *    plugin's Babel output using Vite's transformWithOxc with lang:'ts'. This runs
	 *    OXC in TypeScript-only mode (no JSX transform), preserving the Solid SSR code.
	 *    Without this, ssrTransformScript (Rolldown's parser) fails on `as` casts.
	 */
	async vitePlugin(): Promise<Plugin | Plugin[]> {
		const { default: solid } = await import("vite-plugin-solid");
		const solidPlugin = solid({
			ssr: true,
			hot: false,
			// Enable hydratable mode — tells Solid's compiler to generate
			// hydration-aware code. This produces smaller output by using
			// hydration markers instead of full render() fallback paths,
			// and aligns with how Astro's Solid integration achieves ~4 KiB.
			hydratable: true,
			include: [/\.solid\.(tsx|jsx)$/],
			exclude: [/node_modules/],
		});

		// Plugin 1: Exclude .solid.tsx/.solid.jsx from vite:oxc and ensure
		// solid-js resolves to server builds in SSR. vite-plugin-solid's
		// configEnvironment hook prepends ['solid', 'development'] to
		// resolve.conditions for ALL environments. The 'development' condition
		// in solid-js/web's exports maps to dev.js (client DOM), which takes
		// priority over 'node'/'worker' (server.js). We counteract this by
		// adding resolve aliases in the SSR environment only, forcing solid-js
		// and solid-js/web to their server builds.
		const solidOxcExcludePlugin: Plugin = {
			name: "avalon:solid-oxc-exclude",
			enforce: "pre",
			config() {
				return {
					oxc: {
						exclude: [/\.solid\.(tsx|jsx)$/],
					},
				};
			},
			// Redirect solid-js imports to the correct build per environment.
			//
			// Why this is needed:
			// 1. vite-plugin-solid's configEnvironment prepends ['solid','development']
			//    to resolve.conditions for ALL environments.
			// 2. With ssr.target:'webworker', the SSR environment uses
			//    defaultClientConditions as its base. The 'development' condition
			//    in solid-js's exports maps to dev.js (client DOM build), not
			//    server.js (SSR build).
			// 3. Vite 8's optimizeDeps pre-bundler resolves solid-js using base
			//    config conditions (which include 'node' from ssr.resolve.conditions),
			//    landing on server.js even for the client environment.
			//
			// resolveId runs in both the pre-bundler and the dev server, so it
			// correctly redirects in all contexts.
			async resolveId(source, _importer, options) {
				if (source !== "solid-js" && source !== "solid-js/web") return null;
				const isSsr =
					options?.ssr === true || (this as any).environment?.config?.consumer === "server";
				const isDev =
					(this as any).environment?.mode === "development" ||
					process.env.NODE_ENV === "development";
				const target = isSsr ? "server" : isDev ? "dev" : "solid";
				const subpath =
					source === "solid-js/web"
						? `solid-js/web/dist/${target}.js`
						: `solid-js/dist/${target}.js`;
				// Resolve the redirected path through Vite's normal resolution,
				// skipping this plugin to avoid infinite recursion.
				const resolved = await this.resolve(subpath, _importer, { ...options, skipSelf: true });
				return resolved;
			},
		};

		// Plugin 3: Strip TypeScript from solid plugin's Babel output.
		// Must run after vite-plugin-solid — no enforce so it runs in the normal
		// phase, and array order places it after the solid plugin.
		const solidTsStripPlugin: Plugin = {
			name: "avalon:solid-ts-strip",
			async transform(code, id, options) {
				if (!id.includes(".solid.") || !(id.endsWith(".tsx") || id.endsWith(".jsx"))) {
					return null;
				}
				// Only strip if the code still has TypeScript syntax
				// (the solid plugin's Babel output preserves TS type annotations)
				if (!code.includes(" as ") && !code.includes("<") && !code.includes(": ")) {
					return null;
				}
				const { transformWithOxc } = await import("vite");
				// Use lang:'ts' so OXC only strips TypeScript, doesn't touch JSX
				// The solid plugin already compiled JSX → _$ssr() / _$template() calls
				const result = await transformWithOxc(code, id.replace(/\.[jt]sx$/, ".ts"), {
					lang: "ts",
					sourcemap: true,
				});
				return { code: result.code, map: result.map };
			},
		};

		return [solidOxcExcludePlugin, solidPlugin, solidTsStripPlugin];
	},
};

export type {
	Integration,
	IntegrationConfig,
	RenderParams,
	RenderResult,
} from "@useavalon/core/types";
export { hydrate } from "./client/hydration.ts";
// Re-export public API
export { render } from "./server/renderer.ts";
export {
	isSolidComponent,
	loadComponent,
	normalizeProps,
	resolveIslandPath,
} from "./server/utils.ts";
// Re-export types
export type * from "./types.ts";
