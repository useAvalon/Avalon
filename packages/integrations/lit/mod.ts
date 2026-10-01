/**
 * @useavalon/lit
 *
 * Lit integration for Avalon framework
 * Provides server-side rendering and client-side hydration for Lit web components
 */

// Import DOM shim FIRST - must be before any Lit imports anywhere
import "./server/dom-shim.ts";

import type { Integration, IntegrationConfig } from "@useavalon/core/types";
import type { Plugin } from "vite";
import { render } from "./server/renderer.ts";

/**
 * Lit integration configuration
 */
const config: IntegrationConfig = {
	name: "lit",
	fileExtensions: [".ts", ".js"],
	jsxImportSources: [],
	detectionPatterns: {
		imports: [
			/^lit$/,
			/^lit\//,
			/from\s+['"]lit['"]/,
			/from\s+['"]lit\/[^'"]+['"]/,
			/@lit-labs\/ssr/,
		],
		content: [
			/\bLitElement\b/,
			/\bcustomElement\b/,
			/@customElement/,
			/@property/,
			/@state/,
			/\bhtml`/,
			/\bcss`/,
		],
	},
};

/**
 * Virtual module ID for the Lit SSR DOM shim
 */
const LIT_SSR_SHIM_ID = "virtual:avalon-lit-ssr-shim";
const RESOLVED_LIT_SSR_SHIM_ID = "\0" + LIT_SSR_SHIM_ID;

/**
 * Creates a Vite plugin that ensures the Lit DOM shim is loaded before any Lit code.
 * This plugin must be placed first in the plugin array to ensure proper initialization.
 */
function createLitSSRShimPlugin(): Plugin {
	return {
		name: "avalon:lit-ssr-shim",
		// Enforce "pre" to ensure this runs before other plugins
		enforce: "pre",

		resolveId(id: string) {
			if (id === LIT_SSR_SHIM_ID) {
				return RESOLVED_LIT_SSR_SHIM_ID;
			}
			return null;
		},

		load(id: string) {
			if (id === RESOLVED_LIT_SSR_SHIM_ID) {
				// Return code that imports the DOM shim
				return `
          // Lit SSR DOM Shim - ensures DOM APIs are available before Lit loads
          import "@lit-labs/ssr-dom-shim";
          export const LIT_SSR_SHIM_LOADED = true;
        `;
			}
			return null;
		},

		// Transform Lit files to ensure DOM shim is imported first
		transform(code: string, id: string) {
			// Only process .lit.ts or .lit.js files, or files that import from 'lit'
			// Skip MDX/MD files — they may contain Lit code examples in fenced blocks
			// that match the import pattern but aren't actual Lit source files.
			const isLitFile = /\.lit\.(ts|js)$/.test(id);
			const isMdx = /\.mdx?$/.test(id);
			const importsLit = /from\s+['"]lit['"]/.test(code) || /from\s+['"]lit\//.test(code);

			if (!isMdx && (isLitFile || importsLit) && !id.includes("node_modules")) {
				// Prepend the shim import to ensure DOM APIs are available
				return {
					code: `import "${LIT_SSR_SHIM_ID}";\n${code}`,
					map: null,
				};
			}

			return null;
		},
	};
}

/**
 * Creates a Vite plugin that transforms Lit decorators using Babel.
 *
 * Oxc (Vite 8's transformer) does not support lowering TC39 standard decorators.
 * Node.js also can't evaluate them, so SSR fails with SyntaxError.
 *
 * Following Vite 8's official recommendation, we use @rolldown/plugin-babel with
 * @babel/plugin-proposal-decorators to properly compile decorators. This handles
 * all Lit decorators (@customElement, @state, @property, @query, @queryAll, etc.)
 * correctly and avoids the class-field-shadowing problem that breaks Lit reactivity.
 *
 * Only runs on .lit.ts / .lit.js files that contain decorator syntax.
 */
function createLitDecoratorPlugin(): Plugin {
	return {
		name: "avalon:lit-decorator-babel",
		enforce: "pre",

		async transform(code: string, id: string) {
			const isLitFile = /\.lit\.(ts|js)$/.test(id);
			if (!isLitFile || id.includes("node_modules")) {
				return null;
			}

			// Only run Babel on files that actually import Lit decorators
			if (!code.includes("lit/decorators")) {
				return null;
			}

			// Lazy-import babel to avoid loading it when no decorators are used
			const babel = await import("@babel/core");

			// Strip TypeScript type annotations first so Babel can parse the file.
			// We use Babel's own TS plugin for this.
			const result = await babel.transformAsync(code, {
				filename: id,
				babelrc: false,
				configFile: false,
				sourceMaps: true,
				// Use simple assignment for class fields instead of Object.defineProperty.
				// This is equivalent to useDefineForClassFields:false in tsconfig and is
				// required so that decorated fields don't shadow Lit's reactive accessors.
				assumptions: {
					setPublicClassFields: true,
				},
				plugins: [
					// Must come before decorators so TS syntax is removed first
					["@babel/plugin-transform-typescript", { isTSX: false, allowDeclareFields: true }],
					// Legacy mode matches Lit's recommended experimentalDecorators behavior:
					// - no accessor keyword needed
					// - produces minimal output (no decorator runtime polyfill)
					["@babel/plugin-proposal-decorators", { legacy: true }],
					// Transform class properties with simple assignment
					["@babel/plugin-transform-class-properties"],
				],
			});

			if (!result?.code) {
				return null;
			}

			// Babel's legacy decorator transform uses _initializerDefineProperty which calls
			// Object.defineProperty — this creates own data properties that shadow Lit's
			// reactive accessors. We patch the helper to use simple assignment instead.
			// The helper is always emitted as a single-line function at the top of the file.
			let output = result.code;
			const helperStart = output.indexOf("function _initializerDefineProperty(");
			if (helperStart !== -1) {
				// Find the matching closing brace by counting braces
				let braceCount = 0;
				let i = output.indexOf("{", helperStart);
				for (; i < output.length; i++) {
					if (output[i] === "{") braceCount++;
					else if (output[i] === "}") {
						braceCount--;
						if (braceCount === 0) break;
					}
				}
				const replacement =
					"function _initializerDefineProperty(e, i, r, l) { e[i] = r && r.initializer ? r.initializer.call(l) : void 0; }";
				output = output.slice(0, helperStart) + replacement + output.slice(i + 1);
			}

			return {
				code: output,
				map: result.map,
			};
		},
	};
}

/**
 * Lit integration object
 * Implements the Integration interface
 */
export const litIntegration: Integration = {
	name: "lit",
	version: "0.1.0",

	async render(params) {
		// Cast component to Lit element class
		const litParams = {
			...params,
			component: params.component as typeof import("lit").LitElement | undefined,
		};
		return await render(litParams);
	},

	config(): IntegrationConfig {
		return config;
	},

	/**
	 * Provides the Lit SSR shim plugin for DOM shim support.
	 * This plugin MUST be placed first in the plugin array (handled by Avalon's plugin ordering).
	 * Also includes a decorator fix plugin for Vite 8 compatibility.
	 */
	async vitePlugin(): Promise<Plugin | Plugin[]> {
		return [createLitSSRShimPlugin(), createLitDecoratorPlugin()];
	},
};

// Default export
export default litIntegration;

export type {
	Integration,
	IntegrationConfig,
	RenderParams,
	RenderResult,
} from "@useavalon/core/types";
export { hydrate } from "./client/hydration.ts";
// Re-export public API
export { render, renderWithErrorBoundary } from "./server/renderer.ts";
export {
	collectStyles,
	extractTagNameFromSource,
	getTagName,
	loadComponent,
	serializeAttributes,
} from "./server/utils.ts";
// Re-export types
export type * from "./types.ts";
