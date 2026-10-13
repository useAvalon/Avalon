/**
 * Vite plugin entry point for @useavalon/seo.
 *
 * Intercepts rendered HTML responses and auto-injects:
 * - Canonical URLs
 * - Open Graph meta tags (with og:image:width/height)
 * - Twitter card meta tags
 * - JSON-LD structured data (WebPage, WebSite, BreadcrumbList, Article)
 * - Font preconnect links
 *
 * Dev: patches res.end before Avalon's SSR handler runs.
 * Production: registers a Nitro HTML post-process hook and rewrites prerendered HTML after build.
 */

import type { Plugin, PluginOption, ViteDevServer } from "vite";
import type { SeoConfigInput } from "./config.ts";
import { validateSeoConfig } from "./config.ts";
import { patchResponseForSeo } from "./dev-middleware.ts";
import {
	generateSeoNitroRegisterModule,
	SEO_HTML_POST_PROCESS_VIRTUAL_ID,
} from "./nitro-register.ts";

async function registerNitroHtmlPostProcess(registerSource: () => string): Promise<void> {
	const { setHtmlPostProcessRegisterModuleSource } = await import(
		"@useavalon/avalon/nitro/html-post-process-register"
	);
	setHtmlPostProcessRegisterModuleSource(registerSource);
}

/**
 * Create the SEO Vite plugin.
 *
 * Automatically injects SEO meta tags and JSON-LD structured data into
 * every HTML response. Reads existing tags to avoid duplication.
 */
export function seo(config: SeoConfigInput): PluginOption[] {
	const resolvedConfig = validateSeoConfig(config);
	const plugins: Plugin[] = [];

	plugins.push({
		name: "avalon-seo",
		enforce: "pre",
		configureServer(server: ViteDevServer) {
			server.middlewares.use((req, res, next) => {
				const url = req.url ?? "/";

				if (
					url.startsWith("/@") ||
					url.startsWith("/__") ||
					url.startsWith("/node_modules/") ||
					url.startsWith("/src/") ||
					url.startsWith("/packages/") ||
					(url.includes(".") && !url.endsWith("/"))
				) {
					return next();
				}

				patchResponseForSeo(res, url, resolvedConfig);
				next();
			});
		},
	});

	const registerSource = () => generateSeoNitroRegisterModule(resolvedConfig);
	const resolvedVirtualId = `\0${SEO_HTML_POST_PROCESS_VIRTUAL_ID}`;

	plugins.push({
		name: "avalon-seo:nitro",
		enforce: "post",
		resolveId(id) {
			if (id === SEO_HTML_POST_PROCESS_VIRTUAL_ID) return resolvedVirtualId;
			return null;
		},
		load(id) {
			if (id === resolvedVirtualId) return registerSource();
			return null;
		},
		async configResolved() {
			await registerNitroHtmlPostProcess(registerSource);
		},
		async buildStart() {
			await registerNitroHtmlPostProcess(registerSource);
		},
	});

	return plugins as PluginOption[];
}
