/**
 * Core types for the Avalon framework integration system.
 * These types define the contract that all framework integrations must implement.
 */
import type { Plugin, ViteDevServer } from "vite";
/**
 * Hydration condition types that determine when an island should become interactive
 */
export type HydrationCondition =
	| "on:client"
	| "on:visible"
	| "on:interaction"
	| "on:idle"
	| `media:${string}`
	| `on:${string}`;
/**
 * Parameters passed to the integration's render function
 */
export interface RenderParams {
	/** The component to render (may be null if integration loads it) */
	component: unknown;
	/** Props to pass to the component */
	props: Record<string, unknown>;
	/** Source path to the component file */
	src: string;
	/** Hydration condition for the island */
	condition?: HydrationCondition;
	/** If true, component will not hydrate on client */
	ssrOnly?: boolean;
	/** Vite dev server instance (available in development) */
	viteServer?: ViteDevServer;
	/** Whether running in development mode */
	isDev?: boolean;
}
/**
 * Result returned from the integration's render function
 */
export interface RenderResult {
	/** Rendered HTML string */
	html: string;
	/** CSS to inject (for frameworks with scoped styles) */
	css?: string;
	/** Additional head content (scripts, meta tags, etc.) */
	head?: string;
	/** Scope ID for CSS scoping (e.g., Vue scoped styles) */
	scopeId?: string;
	/** Data to serialize for client-side hydration */
	hydrationData?: Record<string, unknown>;
}
/**
 * Configuration for a framework integration
 */
export interface IntegrationConfig {
	/** Unique name of the integration (e.g., "preact", "vue") */
	name: string;
	/** File extensions this integration handles */
	fileExtensions: string[];
	/** JSX import sources for this framework */
	jsxImportSources?: string[];
	/** Patterns to detect if a file uses this framework */
	detectionPatterns: {
		/** Regex patterns to match import statements */
		imports: RegExp[];
		/** Regex patterns to match code content */
		content: RegExp[];
	};
}
/**
 * Main integration interface that all framework integrations must implement
 */
export interface Integration {
	/** Unique name of the integration */
	name: string;
	/** Version of the integration package */
	version: string;
	/**
	 * Render a component to HTML on the server
	 * @param params - Rendering parameters
	 * @returns Promise resolving to render result
	 */
	render(params: RenderParams): Promise<RenderResult>;
	/**
	 * Get the hydration script for client-side initialization
	 * @returns JavaScript code as a string
	 */
	getHydrationScript(): string;
	/**
	 * Get the integration configuration
	 * @returns Integration configuration object
	 */
	config(): IntegrationConfig;
	/**
	 * Optional: Provide Vite plugins required for this framework's build-time processing.
	 *
	 * Each integration encapsulates its own Vite plugin configuration, eliminating
	 * the need for manual framework plugin setup in the user's vite.config.ts.
	 *
	 * **Plugin Ordering Requirements:**
	 * - Lit integration plugins MUST be placed first (DOM shim requirement)
	 * - MDX plugins should come after Lit but before other framework plugins
	 * - Framework-specific plugins (React, Vue, Svelte, etc.) come last
	 *
	 * The Avalon plugin handles ordering automatically when collecting plugins
	 * from all activated integrations.
	 *
	 * @returns Promise resolving to a single Vite plugin or array of plugins
	 *
	 * @example
	 * ```typescript
	 * async vitePlugin(): Promise<Plugin | Plugin[]> {
	 *   const { default: vue } = await import('@vitejs/plugin-vue');
	 *   return vue({
	 *     template: {
	 *       compilerOptions: {
	 *         isCustomElement: tag => tag === 'avalon-island',
	 *       },
	 *     },
	 *   });
	 * }
	 * ```
	 */
	vitePlugin?(): Promise<Plugin | Plugin[]>;
}
/**
 * Context available during component loading
 */
export interface LoadContext {
	/** Whether running in development mode */
	isDev: boolean;
	/** Vite dev server instance (available in development) */
	viteServer?: ViteDevServer;
	/** Path to build output directory (production) */
	buildOutput?: string;
}
/**
 * Options for component loading
 */
export interface ComponentLoadOptions {
	/** Source path to the component */
	src: string;
	/** Load context */
	context: LoadContext;
	/** Whether to load for SSR or client */
	target?: "ssr" | "client";
}
