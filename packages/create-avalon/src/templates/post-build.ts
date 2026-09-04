export function generatePostBuildMjs(): string {
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
		`\tprerender: {`,
		`\t\troutes: ['/'],`,
		`\t\tcrawlLinks: true,`,
		`\t\tfailOnError: false,`,
		`\t},`,
		`});`,
		``,
	].join("\n");
}
