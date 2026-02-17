/**
 * Cached Time API Route - Demonstrates defineCachedEventHandler
 *
 * This route demonstrates Nitro's built-in caching with defineCachedEventHandler.
 * The response is cached for 10 seconds with SWR enabled.
 *s
 * GET /api/cached-time
 *
 * Requirements: 4.1, 4.3
 */

import { defineCachedHandler } from "nitro/cache";

export default defineCachedHandler(
  async () => {
    // Simulate expensive computation
    const now = new Date();

    console.log("[cached-time] Handler executed at:", now.toISOString());

    return {
      timestamp: now.toISOString(),
      unix: now.getTime(),
      message: "This response is cached for 10 seconds",
      cached: true,
      generatedAt: now.toISOString(),
    };
  },
  {
    // Cache for 10 seconds
    maxAge: 10,

    // Enable stale-while-revalidate
    // Serves stale content immediately while fetching fresh content in background
    swr: true,

    // Allow stale content for up to 60 seconds
    staleMaxAge: 60,

    // Name for debugging and cache organization
    name: "cached-time",

    // Group related caches together
    group: "api",
  }
);
