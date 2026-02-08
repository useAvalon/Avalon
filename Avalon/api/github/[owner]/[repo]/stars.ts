/**
 * GitHub Stars API Route - Demonstrates external API caching
 *
 * This route demonstrates using defineCachedFunction to cache
 * external API calls. The GitHub API response is cached for 1 hour.
 *
 * GET /api/github/:owner/:repo/stars
 *
 * Requirements: 4.2, 4.5
 */

import { defineEventHandler, getRouterParam, createError } from "h3";
import { getGitHubStars } from "../../../../server/utils/cached-functions.ts";

export default defineEventHandler(async (event) => {
  const owner = getRouterParam(event, "owner");
  const repo = getRouterParam(event, "repo");

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      message: "Owner and repo parameters are required",
    });
  }

  try {
    // This uses defineCachedFunction internally
    // The result is cached for 1 hour to avoid GitHub rate limits
    const stars = await getGitHubStars(owner, repo);

    return {
      owner,
      repo,
      stars,
      cached: true,
      message: "Star count is cached for 1 hour",
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw createError({
      statusCode: 502,
      message: `Failed to fetch GitHub data: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});
