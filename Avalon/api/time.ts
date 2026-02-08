/**
 * Time API Route - Nitro Format
 * 
 * This route returns current server time information.
 * GET /api/time
 * 
 * Requirements: 1.2
 */

import { defineEventHandler } from 'h3';

export default defineEventHandler(async () => {
  const now = new Date();

  return {
    timestamp: now.toISOString(),
    unix: now.getTime(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    formatted: {
      date: now.toDateString(),
      time: now.toTimeString(),
      locale: now.toLocaleString(),
    },
    server: 'Avalon/Nitro',
  };
});
