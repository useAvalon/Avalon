/**
 * Post-build script — delegates to Avalon's built-in post-build.
 *
 * Handles CSS patching, island redirects, prerendering, and
 * Netlify function copying.
 *
 * When AVALON_SKIP_PRERENDER=1 (set by build.mjs for edge presets),
 * prerendering is skipped — edge functions serve all routes directly.
 */
import { runPostBuild } from '@useavalon/avalon/post-build';

const skipPrerender = process.env.AVALON_SKIP_PRERENDER === '1';

await runPostBuild({
	prerender: skipPrerender
		? false
		: {
				routes: ['/'],
				crawlLinks: true,
				ignore: ['/demo/data-fetching'],
				failOnError: false,
			},
});
