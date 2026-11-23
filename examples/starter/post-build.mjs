/**
 * Post-build script — delegates to Avalon's built-in post-build.
 *
 * All the heavy lifting (CSS patching, island redirects, prerendering,
 * Cloudflare worker patches, Netlify function copying) is handled by
 * the framework.
 */
import { runPostBuild } from '@useavalon/avalon/post-build';

await runPostBuild({

	prerender: {
		routes: ['/'],
		crawlLinks: true,
		failOnError: false,
	},
});
