/** www production SSR route rules — Nitro `integrity` from CI commit env vars. */
export function deployRevision(): string {
	return (
		process.env.CF_PAGES_COMMIT_SHA ??
		process.env.GITHUB_SHA ??
		process.env.VERCEL_GIT_COMMIT_SHA ??
		process.env.COMMIT_REF ??
		"dev"
	);
}

/**
 * Longest cache lifetime, in seconds, that survives the in-memory cache's expiry timer. The cache
 * calls `setTimeout(ttl * 1000)`, and Node clamps anything above 2^31 - 1 ms (about 24.8 days) to
 * 1 ms, which deletes every entry immediately.
 */
export const MAX_CACHE_SECONDS = Math.floor((2 ** 31 - 1) / 1000);

/** Nitro route-rule cache for pages that only change when you ship a new build. */
export function ssrCacheUntilDeploy(options?: { stream?: boolean }) {
	if (process.env.NODE_ENV !== "production") {
		return false as const;
	}
	// CI node_server build prerender-fetches routes; SSR response cache can stall that pass.
	if (process.env.NITRO_PRESET === "node_server") {
		return false as const;
	}

	return {
		// Entries are keyed by `integrity`, so a new deploy still invalidates them before this expires.
		maxAge: MAX_CACHE_SECONDS,
		swr: false,
		stream: options?.stream ?? true,
		integrity: deployRevision(),
	};
}
