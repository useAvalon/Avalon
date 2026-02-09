/**
 * Cached Functions Utility Module
 *
 * This module demonstrates how to use Nitro's defineCachedFunction
 * for caching expensive computations that are not HTTP handlers.
 *
 * defineCachedFunction is useful for:
 * - External API calls that can be cached
 * - Database queries with stable results
 * - Expensive computations (parsing, transformations)
 * - Shared data that multiple handlers need
 *
 * Requirements: 4.2, 4.5
 */

import { defineCachedFunction } from "nitropack/runtime";

/**
 * Cached function to fetch GitHub repository stars
 *
 * This demonstrates caching external API calls. The result is cached
 * for 1 hour to avoid hitting GitHub's rate limits.
 *
 * @example
 * const stars = await getGitHubStars('denoland', 'deno');
 */
export const getGitHubStars = defineCachedFunction(
  async (owner: string, repo: string): Promise<number> => {
    console.log(`[getGitHubStars] Fetching stars for ${owner}/${repo}`);

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Avalon-Demo",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return data.stargazers_count;
  },
  {
    // Cache for 1 hour
    maxAge: 3600,

    // Enable SWR for better UX
    swr: true,

    // Allow stale content for up to 24 hours
    staleMaxAge: 86400,

    // Name for debugging
    name: "github-stars",

    // Group with other external API caches
    group: "external-api",

    // Generate cache key from owner and repo
    getKey: (owner, repo) => `${owner}/${repo}`,
  }
);

/**
 * Cached function to compute Fibonacci numbers
 *
 * This demonstrates caching expensive computations.
 * Results are cached indefinitely since they never change.
 *
 * @example
 * const fib50 = await computeFibonacci(50);
 */
export const computeFibonacci = defineCachedFunction(
  async (n: number): Promise<bigint> => {
    console.log(`[computeFibonacci] Computing fibonacci(${n})`);

    // Simulate expensive computation
    if (n <= 1) return BigInt(n);

    let a = BigInt(0);
    let b = BigInt(1);

    for (let i = 2; i <= n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }

    return b;
  },
  {
    // Cache for 24 hours (results never change)
    maxAge: 86400,

    // No SWR needed for deterministic computations
    swr: false,

    // Name for debugging
    name: "fibonacci",

    // Group with computation caches
    group: "computation",

    // Use the input number as cache key
    getKey: (n) => `fib:${n}`,
  }
);

/**
 * Cached function to fetch and parse configuration
 *
 * This demonstrates caching configuration data that rarely changes.
 *
 * @example
 * const config = await getAppConfig();
 */
export const getAppConfig = defineCachedFunction(
  async (): Promise<{
    features: string[];
    limits: Record<string, number>;
    version: string;
  }> => {
    console.log("[getAppConfig] Loading application configuration");

    // In a real app, this might fetch from a config service or database
    // Simulating async config loading
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      features: ["islands", "streaming", "multi-framework"],
      limits: {
        maxUploadSize: 10 * 1024 * 1024, // 10MB
        maxRequestsPerMinute: 100,
        maxConcurrentConnections: 1000,
      },
      version: "1.0.0",
    };
  },
  {
    // Cache for 5 minutes
    maxAge: 300,

    // Enable SWR for config updates
    swr: true,

    // Allow stale config for up to 1 hour
    staleMaxAge: 3600,

    // Name for debugging
    name: "app-config",

    // Group with config caches
    group: "config",

    // No parameters, so use a constant key
    getKey: () => "app-config",
  }
);

/**
 * Cached function to aggregate user statistics
 *
 * This demonstrates caching aggregated data that's expensive to compute.
 *
 * @example
 * const stats = await getUserStats('123');
 */
export const getUserStats = defineCachedFunction(
  async (
    userId: string
  ): Promise<{
    userId: string;
    totalPosts: number;
    totalComments: number;
    totalLikes: number;
    lastActive: string;
  }> => {
    console.log(`[getUserStats] Computing stats for user ${userId}`);

    // Simulate expensive aggregation query
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Mock data - in real app, this would query a database
    return {
      userId,
      totalPosts: Math.floor(Math.random() * 100),
      totalComments: Math.floor(Math.random() * 500),
      totalLikes: Math.floor(Math.random() * 1000),
      lastActive: new Date().toISOString(),
    };
  },
  {
    // Cache for 2 minutes
    maxAge: 120,

    // Enable SWR for better UX
    swr: true,

    // Allow stale stats for up to 10 minutes
    staleMaxAge: 600,

    // Name for debugging
    name: "user-stats",

    // Group with user-related caches
    group: "user",

    // Use userId as cache key
    getKey: (userId) => `stats:${userId}`,
  }
);
