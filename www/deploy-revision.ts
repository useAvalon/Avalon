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

/** Nitro route-rule cache for pages that only change when you ship a new build. */
export function ssrCacheUntilDeploy(options?: { stream?: boolean }) {
	if (process.env.NODE_ENV !== "production") {
		return false as const;
	}

	return {
		maxAge: 60 * 60 * 24 * 365,
		swr: false,
		stream: options?.stream ?? true,
		integrity: deployRevision(),
	};
}
