/**
 * Hello API Route - Nitro Format
 * 
 * This route demonstrates Nitro's defineEventHandler pattern.
 * GET /api/hello?name=World
 * 
 * Requirements: 1.2
 */

import { defineEventHandler, getQuery } from 'h3';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const name = (query.name as string) || 'World';

  return {
    message: `Hello, ${name}!`,
    timestamp: new Date().toISOString(),
    framework: 'Avalon',
    version: '1.0.0',
  };
});
