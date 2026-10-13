/**
 * Post-build script — delegates to Avalon's built-in post-build.
 *
 * Handles CSS patching, island redirects, prerendering, and
 * Netlify function copying.
 */
import { runPostBuild } from '@useavalon/avalon/post-build';
import { applySeoToDist } from '@useavalon/seo/dist-transform';
import { withEnvSiteUrl } from '@useavalon/seo/site-config';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { wwwSeoConfig } from './seo.config.ts';

await runPostBuild({
	clientRouter: true,
	prerender: {
		routes: [
			"/",
			"/demo",
			"/demo/data-fetching",
			"/demo/server-islands",
			"/demo/server-island-pure",
			"/demo/server-island-hydrated",
			"/demo/server-actions",
		],
		crawlLinks: true,
		ignore: [],
		failOnError: false,
	},
});

const seoConfig = withEnvSiteUrl(wwwSeoConfig);
const distDir = join(process.cwd(), 'dist');
const seoPatched = applySeoToDist(distDir, seoConfig);
if (seoPatched > 0) {
	console.log(`[post-build] Applied SEO tags to ${seoPatched} HTML file(s)`);
}

/** Nitro may create an empty `.output/public` before prerender copies HTML into `dist`. */
function countHtmlFiles(dir) {
	if (!existsSync(dir)) return 0;
	let count = 0;
	const walk = (current) => {
		for (const name of readdirSync(current)) {
			const path = join(current, name);
			const stat = statSync(path);
			if (stat.isDirectory()) walk(path);
			else if (name.endsWith(".html")) count++;
		}
	};
	walk(dir);
	return count;
}

function pagefindSiteDir() {
	const candidates = ["dist", ".output/public"];
	let best = "dist";
	let bestCount = -1;
	for (const dir of candidates) {
		const htmlCount = countHtmlFiles(dir);
		if (htmlCount > bestCount) {
			bestCount = htmlCount;
			best = dir;
		}
	}
	return best;
}

// Run Pagefind to index prerendered HTML for site search.
const outputDir = pagefindSiteDir();
try {
	execSync(`bunx pagefind --site ${outputDir}`, { stdio: "inherit" });
	console.log(`[pagefind] ✅ Search index generated under ${outputDir}/pagefind`);
} catch (err) {
	console.warn("[pagefind] Search indexing skipped:", err.message);
}
