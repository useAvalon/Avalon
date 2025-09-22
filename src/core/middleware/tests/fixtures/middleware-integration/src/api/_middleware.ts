/**
 * API-specific middleware fixture for integration tests
 * Simulates rate limiting, API key validation, and JSON parsing
 */

import type { MiddlewareHandler } from '../../../../../src/schemas/middleware.ts';

const apiMiddleware: MiddlewareHandler = async (context: any, next: any) => {
	// Mark that API middleware executed
	context.state.set('apiMiddlewareExecuted', true);

	// Simulate rate limiting
	const clientIp = context.request.headers.get('X-Forwarded-For') || 'unknown';
	const rateLimitKey = `rate_limit_${clientIp}`;

	// Mock rate limit check (in real app, this would use Redis or similar)
	const currentRequests = (context.state.get(rateLimitKey) as number) || 0;
	if (currentRequests >= 100) {
		return {
			response: new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'X-RateLimit-Limit': '100',
					'X-RateLimit-Remaining': '0',
				},
			}),
			continue: false,
		};
	}

	context.state.set(rateLimitKey, currentRequests + 1);

	// API key validation for certain endpoints
	const apiKey = context.request.headers.get('X-API-Key');
	const requiresApiKey = context.url.pathname.includes('/api/protected/');

	if (requiresApiKey && (!apiKey || apiKey !== 'valid-api-key')) {
		return {
			response: new Response(JSON.stringify({ error: 'Invalid API key' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			}),
			continue: false,
		};
	}

	// Parse JSON body for POST/PUT requests
	if (['POST', 'PUT', 'PATCH'].includes(context.request.method)) {
		const contentType = context.request.headers.get('Content-Type');
		if (contentType?.includes('application/json')) {
			try {
				// Check if there's actually a body to parse
				const clonedRequest = context.request.clone();
				const bodyText = await clonedRequest.text();
				if (bodyText.trim()) {
					const body = JSON.parse(bodyText);
					context.locals.parsedBody = body;
				}
			} catch (error) {
				return {
					response: new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					}),
					continue: false,
				};
			}
		}
	}

	// Add API-specific headers
	context.locals.apiHeaders = {
		'X-API-Version': '1.0',
		'X-RateLimit-Limit': '100',
		'X-RateLimit-Remaining': String(99 - currentRequests),
	};

	const result = await next();

	// Add API headers to response
	if (result.response && context.locals.apiHeaders) {
		const headers = new Headers(result.response.headers);
		Object.entries(context.locals.apiHeaders).forEach(([key, value]) => {
			headers.set(key, value as string);
		});

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

export default apiMiddleware;
