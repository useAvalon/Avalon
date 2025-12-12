/**
 * Page-specific middleware fixture for integration tests
 * Simulates session handling and page-specific security
 */

import type { MiddlewareHandler } from '../../../../../packages/avalon/src/schemas/middleware.ts';

const pageMiddleware: MiddlewareHandler = async (context: any, next: any) => {
	// Mark that page middleware executed
	context.state.set('pageMiddlewareExecuted', true);

	// Simulate session handling
	const sessionCookie = context.request.headers.get('Cookie')?.match(/session=([^;]+)/)?.[1];
	if (sessionCookie) {
		context.locals.sessionId = sessionCookie;
		context.state.set('hasSession', true);
	}

	// Add page-specific security headers
	context.locals.pageSecurityHeaders = {
		'X-Frame-Options': 'DENY',
		'X-Content-Type-Options': 'nosniff',
		'X-XSS-Protection': '1; mode=block',
	};

	const result = await next();

	// Add security headers to response
	if (result.response && context.locals.pageSecurityHeaders) {
		const headers = new Headers(result.response.headers);
		Object.entries(context.locals.pageSecurityHeaders).forEach(([key, value]) => {
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

export default pageMiddleware;
