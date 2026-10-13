/**
 * Generates the Nitro virtual module that registers SEO HTML transforms at runtime.
 */

import type { SeoConfig } from "./config.ts";

export const SEO_HTML_POST_PROCESS_VIRTUAL_ID = "virtual:avalon/html-post-process-register";

export function generateSeoNitroRegisterModule(config: SeoConfig): string {
	const serialized = JSON.stringify(config);
	return [
		`import { registerHtmlPostProcess } from '@useavalon/avalon/nitro/html-post-process';`,
		`import { transformSeoHtml } from '@useavalon/seo/transform';`,
		`const seoConfig = ${serialized};`,
		`registerHtmlPostProcess((html, pathname) => transformSeoHtml(html, pathname, seoConfig));`,
		``,
	].join("\n");
}
