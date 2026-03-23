/**
 * Avalon Prerender Module
 *
 * Post-build prerendering for static site generation (SSG).
 *
 * Nitro v3's Vite builder does not yet support the built-in prerender
 * pipeline. This module provides an equivalent: after the Vite/Nitro build
 * completes, it boots the built server locally, fetches each configured
 * route, and writes the resulting HTML to the public output directory.
 *
 * Prerendered pages are served as static files from the CDN — zero
 * function invocations. Islands on prerendered pages still hydrate
 * normally on the client.
 *
 * @example
 * ```ts
 * // In post-build.mjs or build.mjs:
 * import { prerenderRoutes } from '@useavalon/avalon/prerender';
 *
 * await prerenderRoutes({
 *   serverEntryPath: '.output/server/index.mjs',
 *   outputDir: '.output/public',
 *   routes: ['/'],
 *   crawlLinks: true,
 *   ignore: ['/demo/data-fetching'],
 * });
 * ```
 */

export interface PrerenderConfig {
	/** Path to the built Nitro server entry (e.g. '.output/server/index.mjs') */
	serverEntryPath: string;
	/** Directory to write prerendered HTML files */
	outputDir: string;
	/** Explicit routes to prerender */
	routes?: string[];
	/** Crawl <a> links in prerendered pages to discover more routes */
	crawlLinks?: boolean;
	/** Routes to ignore (strings, RegExps, or filter functions) */
	ignore?: Array<string | RegExp | ((path: string) => undefined | null | boolean)>;
	/** Number of concurrent prerender requests @default 4 */
	concurrency?: number;
	/** Fail the build if a prerender route errors @default false */
	failOnError?: boolean;
	/** Write /about as /about/index.html @default true */
	autoSubfolderIndex?: boolean;
	/** Number of retry attempts per route @default 3 */
	retry?: number;
	/** Delay between retries in ms @default 500 */
	retryDelay?: number;
	/** Port to run the prerender server on @default 13172 */
	port?: number;
}

export { prerenderRoutes } from "./prerender.ts";
