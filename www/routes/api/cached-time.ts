/**
 * Cached Time API Route
 * GET /api/cached-time
 *
 * Demonstrates Nitro defineCachedHandler — responses are cached for 60s with SWR.
 */

import { defineCachedHandler } from "nitro/cache";

export default defineCachedHandler(
	() => {
		const now = new Date();

		return {
			timestamp: now.toISOString(),
			unix: now.getTime(),
			message: "Current server time (cached handler)",
			generatedAt: now.toISOString(),
		};
	},
	{ maxAge: 60, swr: true },
);
