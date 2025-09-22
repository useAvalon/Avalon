/**
 * Global middleware fixture for integration tests
 * Simulates CORS, logging, and request ID generation
 */

import type { MiddlewareHandler } from '../../../../src/schemas/middleware.ts';

const globalMiddleware: MiddlewareHandler = async (context: any, next: any) => {
	// Add request ID for tracking
	const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	context.locals.requestId = requestId;

	// Add CORS headers
	context.locals.corsHeaders = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
	};

	// Log request
	context.state.set('requestStartTime', Date.now());
	context.state.set('globalMiddlewareExecuted', true);

	// Continue to next middleware
	const result = await next();

	// Add CORS headers to response if present
	if (result.response && context.locals.corsHeaders) {
		const headers = new Headers(result.response.headers);
		Object.entries(context.locals.corsHeaders).forEach(([key, value]) => {
			headers.set(key, value as string);
		});

		// Add request ID header
		headers.set('X-Request-ID', requestId);

		return {
			response: new Response(result.response.body, {
				status: result.response.status,
				statusText: result.response.statusText,
				headers,
			}),
			continue: false,
		};
	}

	return result;
};

export default globalMiddleware;
