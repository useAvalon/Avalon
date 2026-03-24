/**
 * Type declarations for Avalon virtual modules.
 *
 * These modules are resolved at build time by Avalon's Vite plugin.
 * Including `@useavalon/avalon/types` in your tsconfig `types` array
 * makes these declarations available project-wide.
 */

declare module "virtual:avalon/page-loader" {
	export function loadPage(
		pathname: string,
	): { default: unknown; metadata?: Record<string, unknown> } | null;
}

declare module "virtual:avalon/config" {
	const config: {
		streaming: boolean;
		pagesDir: string;
		layoutsDir: string;
		isDev: boolean;
		[key: string]: unknown;
	};
	export default config;
}

declare module "virtual:avalon/layouts" {
	import type { PageModule, NitroRenderContext } from "@useavalon/avalon/nitro/types";
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
