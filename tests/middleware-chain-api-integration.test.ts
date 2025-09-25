/**
 * Integration tests for complete middleware chains with API routes
 */

import { assertEquals, assertExists } from '@std/assert';
import { MiddlewareExecutor } from '../src/core/middleware/middleware-executor.ts';
import { MiddlewareContextManager } from '../src/core/middleware/middleware-context.ts';
import type { MiddlewareHandler } from '../src/schemas/middleware.ts';

// Import test fixtures
const globalMiddleware = (await import('./fixtures/middleware-integration/src/_middleware.ts')).default;
const apiMiddleware = (await import('./fixtures/middleware-integration/src/api/_middleware.ts')).default;
const authApiMiddleware = (await import('./fixtures/middleware-integration/src/api/auth/_middleware.ts')).default;

Deno.test('API Middleware Chain - Global + API middleware execution', async () => {
	const request = new Request('http://localhost:3000/api/users', {
		method: 'GET',
		headers: {
			'X-Forwarded-For': '192.168.1.1',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Build middleware chain: global → api
	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should not return a response (continue to route handler)
	assertEquals(result.response, undefined);

	// Verify global middleware executed
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertExists(result.context.locals.requestId);
	assertExists(result.context.locals.corsHeaders);

	// Verify API middleware executed
	assertEquals(result.context.state.get('apiMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('rate_limit_192.168.1.1'), 1);
	assertExists(result.context.locals.apiHeaders);
});

Deno.test('API Middleware Chain - Global + API + Auth API middleware execution', async () => {
	const request = new Request('http://localhost:3000/api/auth/login', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Forwarded-For': '192.168.1.1',
			Cookie: 'session=user-session',
			'X-CSRF-Token': 'csrf-user-session',
		},
		body: JSON.stringify({ username: 'testuser', password: 'password123' }),
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Build middleware chain: global → api → auth-api
	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware, authApiMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should not return a response (continue to route handler)
	assertEquals(result.response, undefined);

	// Verify all middleware executed in order
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('apiMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('authApiMiddlewareExecuted'), true);

	// Verify CSRF validation
	assertEquals(result.context.state.get('csrfValidated'), true);

	// Verify JSON body parsing
	assertExists(result.context.locals.parsedBody);
	assertEquals((result.context.locals.parsedBody as any).username, 'testuser');

	// Verify rate limiting
	assertEquals(result.context.state.get('rate_limit_192.168.1.1'), 1);
	assertEquals(result.context.state.get('auth_rate_limit_192.168.1.1'), 1);
});

Deno.test('API Middleware Chain - Rate limiting blocks excessive requests', async () => {
	const request = new Request('http://localhost:3000/api/users', {
		headers: {
			'X-Forwarded-For': '192.168.1.100',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Simulate 100 previous requests
	context.state.set('rate_limit_192.168.1.100', 100);

	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should return 429 rate limit response
	assertExists(result.response);
	assertEquals(result.response.status, 429);

	const responseData = await result.response.json();
	assertEquals(responseData.error, 'Rate limit exceeded');

	// Verify headers
	assertEquals(result.response.headers.get('X-RateLimit-Limit'), '100');
	assertEquals(result.response.headers.get('X-RateLimit-Remaining'), '0');
});

Deno.test('API Middleware Chain - Auth API rate limiting', async () => {
	const request = new Request('http://localhost:3000/api/auth/login', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Forwarded-For': '192.168.1.200',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Simulate 10 previous auth requests (auth limit is 10)
	context.state.set('auth_rate_limit_192.168.1.200', 10);

	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware, authApiMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should return 429 auth rate limit response
	assertExists(result.response);
	assertEquals(result.response.status, 429);

	const responseData = await result.response.json();
	assertEquals(responseData.error, 'Auth rate limit exceeded');

	// Verify auth-specific headers
	assertEquals(result.response.headers.get('X-Auth-RateLimit-Limit'), '10');
	assertEquals(result.response.headers.get('X-Auth-RateLimit-Remaining'), '0');
});

Deno.test('API Middleware Chain - Protected API requires API key', async () => {
	const request = new Request('http://localhost:3000/api/protected/data');

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should return 401 for missing API key
	assertExists(result.response);
	assertEquals(result.response.status, 401);

	const responseData = await result.response.json();
	assertEquals(responseData.error, 'Invalid API key');
});

Deno.test('API Middleware Chain - Protected API with valid API key', async () => {
	const request = new Request('http://localhost:3000/api/protected/data', {
		headers: {
			'X-API-Key': 'valid-api-key',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should continue to route handler
	assertEquals(result.response, undefined);

	// Verify middleware executed
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('apiMiddlewareExecuted'), true);
});

Deno.test('API Middleware Chain - CSRF protection for auth endpoints', async () => {
	const request = new Request('http://localhost:3000/api/auth/logout', {
		method: 'POST',
		headers: {
			Cookie: 'session=user-session',
			// Missing X-CSRF-Token header
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware, authApiMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should return 403 for missing CSRF token
	assertExists(result.response);
	assertEquals(result.response.status, 403);

	const responseData = await result.response.json();
	assertEquals(responseData.error, 'CSRF token required');
});

Deno.test('API Middleware Chain - Invalid JSON body handling', async () => {
	const request = new Request('http://localhost:3000/api/users', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: 'invalid json{',
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should return 400 for invalid JSON
	assertExists(result.response);
	assertEquals(result.response.status, 400);

	const responseData = await result.response.json();
	assertEquals(responseData.error, 'Invalid JSON body');
});

Deno.test('API Middleware Chain - Response headers from all middleware', async () => {
	const request = new Request('http://localhost:3000/api/auth/profile', {
		method: 'GET',
		headers: {
			'X-API-Key': 'valid-api-key',
			Cookie: 'session=user-session',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create a mock API route handler
	const mockApiHandler: MiddlewareHandler = async (ctx, next) => {
		return {
			response: new Response(JSON.stringify({ user: 'profile data' }), {
				headers: { 'Content-Type': 'application/json' },
			}),
			continue: false,
		};
	};

	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware, authApiMiddleware, mockApiHandler];

	const result = await executor.execute(middlewareChain, context);

	assertExists(result.response);
	assertEquals(result.response.status, 200);

	// Verify headers from all middleware are present
	// Global middleware headers
	assertEquals(result.response.headers.get('Access-Control-Allow-Origin'), '*');
	assertExists(result.response.headers.get('X-Request-ID'));

	// API middleware headers
	assertEquals(result.response.headers.get('X-API-Version'), '1.0');
	assertEquals(result.response.headers.get('X-RateLimit-Limit'), '100');

	// Auth API middleware headers
	assertEquals(result.response.headers.get('X-Auth-API-Version'), '1.0');
	assertEquals(result.response.headers.get('X-Auth-RateLimit-Limit'), '10');

	const responseData = await result.response.json();
	assertEquals(responseData.user, 'profile data');
});

Deno.test('API Middleware Chain - Context state and locals passing', async () => {
	const request = new Request('http://localhost:3000/api/auth/status', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Cookie: 'session=test-session',
			'X-CSRF-Token': 'csrf-test-session',
		},
		body: JSON.stringify({ check: 'status' }),
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create a middleware that checks all state and locals
	const stateCheckingMiddleware: MiddlewareHandler = async (ctx, next) => {
		return {
			response: new Response(
				JSON.stringify({
					// State from middleware
					globalExecuted: ctx.state.get('globalMiddlewareExecuted'),
					apiExecuted: ctx.state.get('apiMiddlewareExecuted'),
					authApiExecuted: ctx.state.get('authApiMiddlewareExecuted'),
					csrfValidated: ctx.state.get('csrfValidated'),
					requestStartTime: ctx.state.get('requestStartTime'),

					// Locals from middleware
					requestId: ctx.locals.requestId,
					parsedBody: ctx.locals.parsedBody,
					corsHeaders: !!ctx.locals.corsHeaders,
					apiHeaders: !!ctx.locals.apiHeaders,
					authApiHeaders: !!ctx.locals.authApiHeaders,
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			),
			continue: false,
		};
	};

	const middlewareChain: MiddlewareHandler[] = [
		globalMiddleware,
		apiMiddleware,
		authApiMiddleware,
		stateCheckingMiddleware,
	];

	const result = await executor.execute(middlewareChain, context);

	assertExists(result.response);
	assertEquals(result.response.status, 200);

	const responseData = await result.response.json();
	assertEquals(responseData.globalExecuted, true);
	assertEquals(responseData.apiExecuted, true);
	assertEquals(responseData.authApiExecuted, true);
	assertEquals(responseData.csrfValidated, true);
	assertExists(responseData.requestStartTime);
	assertExists(responseData.requestId);
	assertEquals((responseData.parsedBody as any).check, 'status');
	assertEquals(responseData.corsHeaders, true);
	assertEquals(responseData.apiHeaders, true);
	assertEquals(responseData.authApiHeaders, true);
});

Deno.test('API Middleware Chain - Performance with complex middleware chain', async () => {
	const request = new Request('http://localhost:3000/api/auth/complex', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-API-Key': 'valid-api-key',
			Cookie: 'session=perf-session',
			'X-CSRF-Token': 'csrf-perf-session',
		},
		body: JSON.stringify({ data: 'performance test' }),
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Add performance tracking middleware
	const perfMiddleware1: MiddlewareHandler = async (ctx, next) => {
		ctx.state.set('perf1Start', performance.now());
		const result = await next();
		ctx.state.set('perf1End', performance.now());
		return result;
	};

	const perfMiddleware2: MiddlewareHandler = async (ctx, next) => {
		ctx.state.set('perf2Start', performance.now());
		const result = await next();
		ctx.state.set('perf2End', performance.now());
		return result;
	};

	const middlewareChain: MiddlewareHandler[] = [
		perfMiddleware1,
		globalMiddleware,
		perfMiddleware2,
		apiMiddleware,
		authApiMiddleware,
	];

	const startTime = performance.now();
	const result = await executor.execute(middlewareChain, context);
	const endTime = performance.now();

	// Should complete without response (continue to route handler)
	assertEquals(result.response, undefined);

	// Verify execution time is reasonable
	const executionTime = endTime - startTime;
	assertEquals(executionTime < 50, true, `Execution time ${executionTime}ms should be under 50ms`);

	// Verify all middleware executed
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('apiMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('authApiMiddlewareExecuted'), true);

	// Verify performance tracking
	assertExists(result.context.state.get('perf1Start'));
	assertExists(result.context.state.get('perf1End'));
	assertExists(result.context.state.get('perf2Start'));
	assertExists(result.context.state.get('perf2End'));

	// Verify performance measurements are reasonable
	const perf1Duration =
		(result.context.state.get('perf1End') as number) - (result.context.state.get('perf1Start') as number);
	const perf2Duration =
		(result.context.state.get('perf2End') as number) - (result.context.state.get('perf2Start') as number);

	assertEquals(perf1Duration > 0, true);
	assertEquals(perf2Duration > 0, true);
	assertEquals(perf1Duration < 100, true);
	assertEquals(perf2Duration < 100, true);
});
