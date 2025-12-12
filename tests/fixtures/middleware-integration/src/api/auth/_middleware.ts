/**
 * Auth API-specific middleware fixture for integration tests
 * Simulates CSRF protection and authentication-specific logic
 */

import type { MiddlewareHandler } from '../../../../../../packages/avalon/src/schemas/middleware.ts';

const authApiMiddleware: MiddlewareHandler = async (context: any, next: any) => {
	// Mark that auth API middleware executed
	context.state.set('authApiMiddlewareExecuted', true);

	// Add auth-specific rate limiting (stricter than general API) - check this first
	const clientIp = context.request.headers.get('X-Forwarded-For') || 'unknown';
	const authRateLimitKey = `auth_rate_limit_${clientIp}`;

	const currentAuthRequests = (context.state.get(authRateLimitKey) as number) || 0;
	if (currentAuthRequests >= 10) {
		return {
			response: new Response(JSON.stringify({ error: 'Auth rate limit exceeded' }), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'X-Auth-RateLimit-Limit': '10',
					'X-Auth-RateLimit-Remaining': '0',
				},
			}),
			continue: false,
		};
	}

	context.state.set(authRateLimitKey, currentAuthRequests + 1);

	// CSRF protection for state-changing operations
	if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(context.request.method)) {
		const csrfToken = context.request.headers.get('X-CSRF-Token');

		// Extract session ID if not already set
		let sessionId = context.locals.sessionId;
		if (!sessionId) {
			const sessionCookie = context.request.headers.get('Cookie')?.match(/session=([^;]+)/)?.[1];
			if (sessionCookie) {
				sessionId = sessionCookie;
				context.locals.sessionId = sessionCookie;
			}
		}

		// Skip CSRF for API key authenticated requests
		const apiKey = context.request.headers.get('X-API-Key');
		if (!apiKey && (!csrfToken || !sessionId)) {
			return {
				response: new Response(JSON.stringify({ error: 'CSRF token required' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' },
				}),
				continue: false,
			};
		}

		// Validate CSRF token (mock validation)
		if (csrfToken && csrfToken !== `csrf-${sessionId}`) {
			return {
				response: new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' },
				}),
				continue: false,
			};
		}

		context.state.set('csrfValidated', true);
	}

	// Add auth-specific headers
	context.locals.authApiHeaders = {
		'X-Auth-API-Version': '1.0',
		'X-Auth-RateLimit-Limit': '10',
		'X-Auth-RateLimit-Remaining': String(9 - currentAuthRequests),
	};

	const result = await next();

	// Add auth API headers to response
	if (result.response && context.locals.authApiHeaders) {
		const headers = new Headers(result.response.headers);
		Object.entries(context.locals.authApiHeaders).forEach(([key, value]) => {
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

export default authApiMiddleware;
