/**
 * Type declarations for Avalon virtual modules.
 *
 * These modules are resolved at build time by Avalon's Vite plugin.
 * Including `@useavalon/avalon/types` in your tsconfig `types` array
 * makes these declarations available project-wide.
 */

declare module "virtual:avalon/page-loader" {
	export function loadPage(pathname: string): {
		default: unknown;
		metadata?: Record<string, unknown>;
		clientNavigation?: boolean;
	} | null;
}

declare module "virtual:avalon/config" {
	const config: {
		streaming: boolean;
		pagesDir: string;
		layoutsDir: string;
		isDev: boolean;
		clientRouter?: boolean;
		[key: string]: unknown;
	};
	export default config;
}

declare module "virtual:avalon/layouts" {
	import type { NitroRenderContext, PageModule } from "@useavalon/avalon/nitro/types";
	export function wrapWithLayouts(
		pageHtml: string,
		pageModule: PageModule,
		context: NitroRenderContext,
		injectAssets?: (html: string) => string,
	): Promise<string>;
}

declare module "virtual:avalon/assets" {
	export function injectAssets(html: string): string;
	export const clientAssets: {
		css: Array<{ href: string; [key: string]: string }>;
		js: Array<{ href: string; [key: string]: string }>;
		entry: string;
	};
}

declare module "virtual:avalon/ssr-dom" {
	// Side-effect module: installs a `document` stub before Lit SSR loads.
}

declare module "virtual:avalon/renderer" {
	const handler: {
		(event: unknown): Promise<Response>;
		fetch(request: Request): Promise<Response>;
	};
	export default handler;
}

declare module "virtual:avalon/client-entry" {
	// Side-effect-only module: imports hydration runtime, global CSS, and layout CSS.
	// No exports — just import it as your client entry point.
}

declare module "virtual:avalon/integration-loader" {
	export function loadIntegrationModule(framework: string): Promise<{
		hydrate?: (
			el: HTMLElement,
			component: unknown,
			props: Record<string, unknown>,
		) => void | Promise<void>;
		mount?: (
			el: HTMLElement,
			component: unknown,
			props: Record<string, unknown>,
		) => void | Promise<void>;
		unmount?: (el: HTMLElement) => void | Promise<void>;
		preLitHydration?: () => Promise<void>;
	}>;
	export function preLitHydration(): Promise<void>;
	export function loadHMRAdapter(framework: string): Promise<unknown>;
}

declare module "virtual:server-island-manifest" {
	/** Mapping of componentId → module path for all registered server islands */
	export const serverIslandManifest: Record<string, string>;
	/** Lazy loaders that dynamically import each server island component, preventing tree-shaking */
	export const serverIslandLoaders: Record<string, () => Promise<{ default: unknown }>>;
	/** Pre-extracted CSS for Svelte components (componentId → raw CSS string) */
	export const serverIslandCSS: Record<string, string>;
}

declare module "virtual:server-island-key" {
	/** The AES-256-GCM encryption key (base64-encoded) embedded at build time */
	export const serverIslandKey: string;
}

declare module "virtual:server-island-integrations" {
	/** Registers framework SSR integrations into the global registry (idempotent). */
	export function ensureServerIslandIntegrations(): void;
}

declare module "virtual:avalon-actions-manifest" {
	/** The project's `server` export (tree of actions/namespaces), bundled into the Nitro server. */
	export const server: Record<string, unknown>;
}

declare module "virtual:avalon/actions" {
	/**
	 * The typed action client proxy. This declaration is overridden by the
	 * generated `avalon-actions.d.ts` when an actions entry exists, which types
	 * `actions` against the project's `server` export.
	 */
	export const actions: Record<string, (input?: unknown) => Promise<unknown>>;
}
