/**
 * Post-build script — delegates to Avalon's built-in post-build.
 *
 * Handles CSS patching, island redirects, prerendering, and
 * Netlify function copying.
 */
import { runPostBuild } from '@useavalon/avalon/post-build';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

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

// Run Pagefind to index prerendered HTML for site search.
// Pagefind crawls the static output and generates a search index.
const outputDir = existsSync('.output/public') ? '.output/public' : 'dist';
try {
	execSync(`npx pagefind --site ${outputDir}`, { stdio: 'inherit' });
	console.log('[pagefind] ✅ Search index generated');
} catch (err) {
	console.warn('[pagefind] Search indexing skipped:', err.message);
}
