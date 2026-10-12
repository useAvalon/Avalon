import type { ProjectConfig, StarterTemplate } from "../types";
import { projectTemplate } from "../types";

function postBuildPrerenderRoutes(template: StarterTemplate): string {
	if (template === "blog") {
		return `['/', '/blog']`;
	}
	if (template === "storefront") {
		return `['/', '/catalog', '/cart', '/about']`;
	}
	return `['/']`;
}

export function generatePostBuildMjs(config: ProjectConfig): string {
	const template = projectTemplate(config);
	const prerenderRoutes = postBuildPrerenderRoutes(template);
	const clientRouterLine =
		template === "blog" || template === "storefront" ? `\tclientRouter: true,\n` : "";

	return [
		`/**`,
		` * Post-build script — delegates to Avalon's built-in post-build.`,
		` *`,
		` * All the heavy lifting (CSS patching, island redirects, prerendering,`,
		` * Cloudflare worker patches, Netlify function copying) is handled by`,
		` * the framework.`,
		` */`,
		`import { runPostBuild } from '@useavalon/avalon/post-build';`,
		``,
		`await runPostBuild({`,
		clientRouterLine,
		`\tprerender: {`,
		`\t\troutes: ${prerenderRoutes},`,
		`\t\tcrawlLinks: true,`,
		`\t\tfailOnError: false,`,
		`\t},`,
		`});`,
		``,
	].join("\n");
}
