/**
 * Integration tests for complete middleware chains with page routes
 */

import { assertEquals, assertExists } from '@std/assert';
import { MiddlewareExecutor } from '../src/core/middleware/middleware-executor.ts';
import { MiddlewareContextManager } from '../src/core/middleware/middleware-context.ts';
import type { MiddlewareHandler } from '../src/schemas/middleware.ts';

// Import test fixtures
const globalMiddleware = (await import('./fixtures/middleware-integration/src/_middleware.ts')).default;
const pageMiddleware = (await import('./fixtures/middleware-integration/src/pages/_middleware.ts')).default;
const adminMiddleware = (await import('./fixtures/middleware-integration/src/pages/admin/_middleware.ts')).default;

Deno.test('Page Middleware Chain - Global + Pages middleware execution', async () => {
	const request = new Request('http://localhost:3000/dashboard', {
		headers: {
			Cookie: 'session=user-session',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Build middleware chain: global → pages
	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, pageMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should not return a response (continue to route handler)
	assertEquals(result.response, undefined);

	// Verify global middleware executed
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('requestStartTime') !== undefined, true);
	assertExists(result.context.locals.requestId);
	assertExists(result.context.locals.corsHeaders);

	// Verify page middleware executed
	assertEquals(result.context.state.get('pageMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('hasSession'), true);
	assertEquals(result.context.locals.sessionId, 'user-session');
	assertExists(result.context.locals.pageSecurityHeaders);
});

Deno.test('Page Middleware Chain - Global + Pages + Admin middleware execution', async () => {
	const request = new Request('http://localhost:3000/admin/dashboard', {
		headers: {
			Authorization: 'Bearer admin-token',
			Cookie: 'session=admin-session',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Build middleware chain: global → pages → admin
	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, pageMiddleware, adminMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should not return a response (continue to route handler)
	assertEquals(result.response, undefined);

	// Verify all middleware executed in order
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('pageMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('adminMiddlewareExecuted'), true);

	// Verify authentication was processed
	assertEquals(result.context.state.get('authenticated'), true);
	assertEquals(result.context.state.get('userRole'), 'admin');
	assertExists(result.context.locals.user);
	assertEquals((result.context.locals.user as any).role, 'admin');
});

Deno.test('Page Middleware Chain - Admin middleware blocks unauthorized access', async () => {
	const request = new Request('http://localhost:3000/admin/dashboard');

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Build middleware chain: global → pages → admin
	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, pageMiddleware, adminMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should return 401 response from admin middleware
	assertExists(result.response);
	assertEquals(result.response.status, 401);

	const responseData = await result.response.json();
	assertEquals(responseData.error, 'Authentication required');

	// Verify middleware execution stopped at admin middleware
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('pageMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('adminMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('authenticated'), undefined); // Should not be set
});

Deno.test('Page Middleware Chain - Admin middleware blocks non-admin users', async () => {
	const request = new Request('http://localhost:3000/admin/dashboard', {
		headers: {
			Authorization: 'Bearer user-token', // Regular user token
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, pageMiddleware, adminMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should return 403 response from admin middleware
	assertExists(result.response);
	assertEquals(result.response.status, 403);

	const responseData = await result.response.json();
	assertEquals(responseData.error, 'Admin access required');
});

Deno.test('Page Middleware Chain - Response headers from all middleware', async () => {
	const request = new Request('http://localhost:3000/admin/users', {
		headers: {
			Authorization: 'Bearer admin-token',
			Cookie: 'session=admin-session',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create a mock route handler that returns a response
	const mockRouteHandler: MiddlewareHandler = async (ctx, next) => {
		return {
			response: new Response(JSON.stringify({ message: 'Admin page content' }), {
				headers: { 'Content-Type': 'application/json' },
			}),
			continue: false,
		};
	};

	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, pageMiddleware, adminMiddleware, mockRouteHandler];

	const result = await executor.execute(middlewareChain, context);

	assertExists(result.response);
	assertEquals(result.response.status, 200);

	// Verify headers from all middleware are present
	// Global middleware headers
	assertEquals(result.response.headers.get('Access-Control-Allow-Origin'), '*');
	assertExists(result.response.headers.get('X-Request-ID'));

	// Page middleware headers
	assertEquals(result.response.headers.get('X-Frame-Options'), 'DENY');
	assertEquals(result.response.headers.get('X-Content-Type-Options'), 'nosniff');
	assertEquals(result.response.headers.get('X-XSS-Protection'), '1; mode=block');

	const responseData = await result.response.json();
	assertEquals(responseData.message, 'Admin page content');
});

Deno.test('Page Middleware Chain - Context state passing between middleware', async () => {
	const request = new Request('http://localhost:3000/admin/settings', {
		headers: {
			Authorization: 'Bearer admin-token',
			Cookie: 'session=admin-session',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create a middleware that checks state from previous middleware
	const stateCheckingMiddleware: MiddlewareHandler = async (ctx, next) => {
		// Verify state from previous middleware
		const globalExecuted = ctx.state.get('globalMiddlewareExecuted');
		const pageExecuted = ctx.state.get('pageMiddlewareExecuted');
		const adminExecuted = ctx.state.get('adminMiddlewareExecuted');
		const authenticated = ctx.state.get('authenticated');
		const userRole = ctx.state.get('userRole');

		return {
			response: new Response(
				JSON.stringify({
					globalExecuted,
					pageExecuted,
					adminExecuted,
					authenticated,
					userRole,
					hasSession: ctx.state.get('hasSession'),
					sessionId: ctx.locals.sessionId,
					userId: (ctx.locals.user as any)?.id,
					requestId: ctx.locals.requestId,
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
		pageMiddleware,
		adminMiddleware,
		stateCheckingMiddleware,
	];

	const result = await executor.execute(middlewareChain, context);

	assertExists(result.response);
	assertEquals(result.response.status, 200);

	const responseData = await result.response.json();
	assertEquals(responseData.globalExecuted, true);
	assertEquals(responseData.pageExecuted, true);
	assertEquals(responseData.adminExecuted, true);
	assertEquals(responseData.authenticated, true);
	assertEquals(responseData.userRole, 'admin');
	assertEquals(responseData.hasSession, true);
	assertEquals(responseData.sessionId, 'admin-session');
	assertEquals(responseData.userId, 'admin');
	assertExists(responseData.requestId);
});

Deno.test('Page Middleware Chain - Error handling in middleware chain', async () => {
	const request = new Request('http://localhost:3000/error-page');

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create a middleware that throws an error
	const errorMiddleware: MiddlewareHandler = async (ctx, next) => {
		ctx.state.set('errorMiddlewareExecuted', true);
		throw new Error('Test middleware error');
	};

	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, pageMiddleware, errorMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should return error response
	assertExists(result.response);
	assertEquals(result.response.status, 500);

	const responseText = await result.response.text();
	assertEquals(responseText, 'Internal Server Error');

	// Verify middleware executed up to the error
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('pageMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('errorMiddlewareExecuted'), true);
});

Deno.test('Page Middleware Chain - Performance with multiple middleware', async () => {
	const request = new Request('http://localhost:3000/performance-test', {
		headers: {
			Authorization: 'Bearer admin-token',
			Cookie: 'session=admin-session',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create additional middleware for performance testing
	const performanceMiddleware1: MiddlewareHandler = async (ctx, next) => {
		ctx.state.set('perf1Start', Date.now());
		const result = await next();
		ctx.state.set('perf1End', Date.now());
		return result;
	};

	const performanceMiddleware2: MiddlewareHandler = async (ctx, next) => {
		ctx.state.set('perf2Start', Date.now());
		const result = await next();
		ctx.state.set('perf2End', Date.now());
		return result;
	};

	const middlewareChain: MiddlewareHandler[] = [
		globalMiddleware,
		performanceMiddleware1,
		pageMiddleware,
		performanceMiddleware2,
		adminMiddleware,
	];

	const startTime = Date.now();
	const result = await executor.execute(middlewareChain, context);
	const endTime = Date.now();

	// Should complete without response (continue to route handler)
	assertEquals(result.response, undefined);

	// Verify execution time is reasonable (should be under 100ms for simple middleware)
	const executionTime = endTime - startTime;
	assertEquals(executionTime < 100, true, `Execution time ${executionTime}ms should be under 100ms`);

	// Verify all middleware executed
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('pageMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('adminMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('authenticated'), true);

	// Verify performance tracking
	assertExists(result.context.state.get('perf1Start'));
	assertExists(result.context.state.get('perf1End'));
	assertExists(result.context.state.get('perf2Start'));
	assertExists(result.context.state.get('perf2End'));
});
