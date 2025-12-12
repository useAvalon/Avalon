/**
 * Protected API middleware fixture for integration tests
 * Simulates additional security layers for protected endpoints
 */

import type { MiddlewareHandler } from '../../../../../../packages/avalon/src/schemas/middleware.ts';

const protectedApiMiddleware: MiddlewareHandler = async (context: any, next: any) => {
	// Mark that protected API middleware executed
	context.state.set('protectedApiMiddlewareExecuted', true);

	// Require API key for all protected endpoints
	const apiKey = context.request.headers.get('X-API-Key');
	if (!apiKey) {
		return {
			response: new Response(JSON.stringify({ error: 'API key required for protected endpoints' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			}),
			continue: false,
		};
	}

	// Validate API key (mock validation)
	if (apiKey !== 'valid-api-key' && apiKey !== 'admin-api-key') {
		return {
			response: new Response(JSON.stringify({ error: 'Invalid API key' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			}),
			continue: false,
		};
	}

	// Set API key info in context
	context.locals.apiKeyType = apiKey === 'admin-api-key' ? 'admin' : 'standard';
	context.state.set('apiKeyValidated', true);

	// Add additional security headers for protected endpoints
	context.locals.protectedApiHeaders = {
		'X-Protected-API': 'true',
		'X-Security-Level': 'high',
		'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
	};

	const result = await next();

	// Add security headers to response
	if (result.response && context.locals.protectedApiHeaders) {
		const headers = new Headers(result.response.headers);
		Object.entries(context.locals.protectedApiHeaders).forEach(([key, value]) => {
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

export default protectedApiMiddleware;
