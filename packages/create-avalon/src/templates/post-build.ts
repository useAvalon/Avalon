import type { ProjectConfig } from "../types";
import { projectTemplate } from "../types";

export function generatePostBuildMjs(config: ProjectConfig): string {
	const isBlog = projectTemplate(config) === "blog";
	const prerenderRoutes = isBlog ? `['/', '/blog']` : `['/']`;
	const clientRouterLine = isBlog ? `\tclientRouter: true,\n` : "";

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
