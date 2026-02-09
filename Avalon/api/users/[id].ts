/**
 * User API Route with Dynamic Parameter - Nitro Format
 * 
 * This route demonstrates Nitro's dynamic parameter extraction.
 * GET /api/users/:id
 * 
 * Requirements: 1.2, 1.3
 */

import { defineEventHandler, getRouterParam, createError } from 'h3';

// Mock user data
const users: Record<string, { id: string; name: string; email: string; role: string }> = {
  '123': { id: '123', name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
  '456': { id: '456', name: 'Bob Smith', email: 'bob@example.com', role: 'user' },
  '789': { id: '789', name: 'Carol Davis', email: 'carol@example.com', role: 'moderator' },
};

export default defineEventHandler(async (event) => {
  // Use Nitro's getRouterParam to extract dynamic parameter
  const userId = getRouterParam(event, 'id');

  if (!userId) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required',
    });
  }

  const user = users[userId];

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
      data: {
        availableIds: Object.keys(users),
      },
    });
  }

  return {
    user,
    requestedAt: new Date().toISOString(),
    route: `/api/users/${userId}`,
  };
});
