/**
 * API CORS Middleware - Nitro Format
 * 
 * Adds CORS headers for API routes.
 * Migrated from: Avalon/src/api/_middleware.ts
 * 
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */

import { defineEventHandler } from 'h3';

export default defineEventHandler(async (event) => {
  // Only apply to API routes
  if (!event.path.startsWith('/api')) {
    // No return = continue to next middleware/handler
    return;
  }

  const start = Date.now();

  console.log(`🔌 API ${event.method} ${event.path} - Started`);

  // Store CORS headers in event context for later application
  event.context.corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Store API start time for logging
  event.context.apiStartTime = start;

  // No return = continue to next middleware/handler
});
