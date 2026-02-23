/**
 * Root API Middleware - CORS and Logging
 *
 * This middleware runs for all API routes (/api/*).
 * It demonstrates:
 * - CORS header handling
 * - Request timing/logging
 * - OPTIONS preflight handling
 * - Context passing to downstream handlers
 *
 * Uses the new Nitro-aligned middleware format:
 * - Return nothing (void) to continue to next middleware
 * - Return a Response to terminate the chain
 * - Throw an error to trigger error handling
 */

import { defineMiddleware } from '@avalon/avalon/middleware';
import { setResponseHeader, getMethod, getRequestURL } from 'h3';

export default defineMiddleware(event => {
	const start = Date.now();
	const method = getMethod(event);
	const url = getRequestURL(event).pathname || '/';

	// Add timing to context
	event.context.timing = {
		start,
	};

	// Set CORS headers for all API routes
	setResponseHeader(event, 'Access-Control-Allow-Origin', '*');
	setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
	setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
	setResponseHeader(event, 'Access-Control-Max-Age', '86400');

	// Handle OPTIONS preflight requests
	if (method === 'OPTIONS') {
		// Return empty response for preflight
		return new Response(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
				'Access-Control-Max-Age': '86400',
			},
		});
	}

	// Development-only request logging
	if (import.meta.env?.DEV) {
		console.log(`[api] ${method} ${url} - Started`);

		// Log completion after response (using event hook if available)
		// Note: In production, you'd use proper observability tools
		const nodeEvent = event.node;
		const originalEnd = nodeEvent.res.end;
		nodeEvent.res.end = function (...args: Parameters<typeof originalEnd>) {
			const duration = Date.now() - start;
			console.log(`[api] ${method} ${url} - Completed in ${duration}ms`);
			return originalEnd.apply(this, args);
		};
	}

	// Return nothing to continue to next middleware/handler
});
