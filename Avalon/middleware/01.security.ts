/**
 * Security Middleware - Nitro Format
 * 
 * Adds security headers to all responses.
 * Migrated from: Avalon/src/middleware/_middleware.ts
 * 
 * Requirements: 6.1, 6.2, 6.4, 6.5
 */

import { defineEventHandler, getHeader } from 'h3';

export default defineEventHandler(async (event) => {
  const start = Date.now();
  const userAgent = getHeader(event, 'user-agent') || 'Unknown';

  console.log(`🌐 ${event.method} ${event.path} - ${userAgent.split(' ')[0]}`);

  // Store security headers in event context for later application
  event.context.securityHeaders = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };

  // Store start time for logging in response
  event.context.requestStartTime = start;

  // No return = continue to next middleware/handler
});
