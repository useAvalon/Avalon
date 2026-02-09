/**
 * Cached User Profile API Route - Demonstrates parameter-based caching
 *
 * This route demonstrates caching with dynamic route parameters.
 * Each user ID gets its own cache entry.
 *
 * GET /api/users/:id/profile
 *
 * Requirements: 4.1, 4.3
 */

import { defineCachedEventHandler, getRouterParam, createError } from "h3";

// Mock user profiles (simulating database)
const userProfiles: Record<
  string,
  {
    id: string;
    name: string;
    email: string;
    bio: string;
    avatar: string;
    joinedAt: string;
  }
> = {
  "123": {
    id: "123",
    name: "Alice Johnson",
    email: "alice@example.com",
    bio: "Software engineer passionate about web technologies",
    avatar: "https://example.com/avatars/alice.jpg",
    joinedAt: "2023-01-15",
  },
  "456": {
    id: "456",
    name: "Bob Smith",
    email: "bob@example.com",
    bio: "Full-stack developer and open source contributor",
    avatar: "https://example.com/avatars/bob.jpg",
    joinedAt: "2023-03-22",
  },
  "789": {
    id: "789",
    name: "Carol Davis",
    email: "carol@example.com",
    bio: "DevOps engineer specializing in cloud infrastructure",
    avatar: "https://example.com/avatars/carol.jpg",
    joinedAt: "2023-06-10",
  },
};

export default defineCachedEventHandler(
  async (event) => {
    const userId = getRouterParam(event, "id");

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: "User ID is required",
      });
    }

    // Simulate database lookup delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    const profile = userProfiles[userId];

    if (!profile) {
      throw createError({
        statusCode: 404,
        message: "User profile not found",
        data: { availableIds: Object.keys(userProfiles) },
      });
    }

    console.log(`[user-profile] Fetched profile for user ${userId}`);

    return {
      profile,
      fetchedAt: new Date().toISOString(),
      cached: true,
    };
  },
  {
    // Cache for 5 minutes
    maxAge: 300,

    // Enable SWR for better UX
    swr: true,

    // Allow stale content for up to 1 hour
    staleMaxAge: 3600,

    // Name for debugging
    name: "user-profile",

    // Group with other API caches
    group: "api",

    // Generate cache key from user ID parameter
    // Each user ID gets its own cache entry
    getKey: (event) => {
      const userId = getRouterParam(event, "id");
      return `user:${userId || "unknown"}`;
    },
  }
);
