/**
 * Post-build script — delegates to Avalon's built-in post-build.
 *
 * Handles CSS patching, island redirects, prerendering, and
 * Netlify function copying.
 */
import { runPostBuild } from '@useavalon/avalon/post-build';

await runPostBuild({
	prerender: {
		routes: ['/'],
		crawlLinks: true,
		ignore: ['/demo/data-fetching'],
		failOnError: false,
	},
});
