/**
 * Stats API Route - Demonstrates defineCachedFunction usage
 *
 * This route demonstrates using cached functions within an API handler.
 * The cached functions handle their own caching, so the handler itself
 * doesn't need to be cached.
 *
 * GET /api/stats?userId=123
 *
 * Requirements: 4.2, 4.5
 */

import { defineEventHandler, getQuery, createError } from "h3";
import {
  getUserStats,
  getAppConfig,
  computeFibonacci,
} from "../server/utils/cached-functions.ts";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const userId = query.userId as string | undefined;

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: "userId query parameter is required",
    });
  }

  // These functions use defineCachedFunction internally
  // Results are cached automatically based on their configuration
  const [userStats, appConfig, fibonacci] = await Promise.all([
    getUserStats(userId),
    getAppConfig(),
    computeFibonacci(50), // Compute 50th Fibonacci number
  ]);

  return {
    user: userStats,
    config: {
      version: appConfig.version,
      features: appConfig.features,
    },
    demo: {
      fibonacci50: fibonacci.toString(),
      message: "This response uses multiple cached functions",
    },
    requestedAt: new Date().toISOString(),
  };
});
