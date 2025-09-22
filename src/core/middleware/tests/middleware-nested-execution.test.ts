/**
 * Tests for nested middleware execution (global → scoped → nested)
 *  1.1, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3
 */

import { assertEquals, assertExists } from 'jsr:@std/assert';
import { MiddlewareExecutor } from '../middleware-executor.ts';
import { MiddlewareContextManager } from '../middleware-context.ts';
import type { MiddlewareHandler } from '../../../schemas/middleware.ts';

// Import test fixtures
const globalMiddleware = (await import('./fixtures/middleware-integration/src/_middleware.ts')).default;
const pageMiddleware = (await import('./fixtures/middleware-integration/src/pages/_middleware.ts')).default;
const adminMiddleware = (await import('./fixtures/middleware-integration/src/pages/admin/_middleware.ts')).default;
const apiMiddleware = (await import('./fixtures/middleware-integration/src/api/_middleware.ts')).default;
const authApiMiddleware = (await import('./fixtures/middleware-integration/src/api/auth/_middleware.ts')).default;

Deno.test('Nested Middleware - Page route execution order (global → pages → admin)', async () => {
	const request = new Request('http://localhost:3000/admin/users', {
		headers: {
			Authorization: 'Bearer admin-token',
			Cookie: 'session=admin-session',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Track execution order
	const executionOrder: string[] = [];

	// Wrap middleware to track execution order
	const trackingGlobal: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('global-start');
		const result = await globalMiddleware(ctx, next);
		executionOrder.push('global-end');
		return result;
	};

	const trackingPage: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('page-start');
		const result = await pageMiddleware(ctx, next);
		executionOrder.push('page-end');
		return result;
	};

	const trackingAdmin: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('admin-start');
		const result = await adminMiddleware(ctx, next);
		executionOrder.push('admin-end');
		return result;
	};

	const middlewareChain: MiddlewareHandler[] = [trackingGlobal, trackingPage, trackingAdmin];

	const result = await executor.execute(middlewareChain, context);

	// Verify execution order: global → page → admin → admin-end → page-end → global-end
	assertEquals(executionOrder, ['global-start', 'page-start', 'admin-start', 'admin-end', 'page-end', 'global-end']);

	// Verify all middleware executed
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('pageMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('adminMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('authenticated'), true);
});

Deno.test('Nested Middleware - API route execution order (global → api → auth)', async () => {
	const request = new Request('http://localhost:3000/api/auth/login', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Cookie: 'session=user-session',
			'X-CSRF-Token': 'csrf-user-session',
		},
		body: JSON.stringify({ username: 'test', password: 'pass' }),
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Track execution order
	const executionOrder: string[] = [];

	const trackingGlobal: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('global-start');
		const result = await globalMiddleware(ctx, next);
		executionOrder.push('global-end');
		return result;
	};

	const trackingApi: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('api-start');
		const result = await apiMiddleware(ctx, next);
		executionOrder.push('api-end');
		return result;
	};

	const trackingAuthApi: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('auth-api-start');
		const result = await authApiMiddleware(ctx, next);
		executionOrder.push('auth-api-end');
		return result;
	};

	const middlewareChain: MiddlewareHandler[] = [trackingGlobal, trackingApi, trackingAuthApi];

	const result = await executor.execute(middlewareChain, context);

	// Verify execution order
	assertEquals(executionOrder, [
		'global-start',
		'api-start',
		'auth-api-start',
		'auth-api-end',
		'api-end',
		'global-end',
	]);

	// Verify all middleware executed
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('apiMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('authApiMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('csrfValidated'), true);
});

Deno.test('Nested Middleware - Early termination stops chain execution', async () => {
	const request = new Request('http://localhost:3000/admin/secret', {
		// No authorization header - should be blocked by admin middleware
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	const executionOrder: string[] = [];

	const trackingGlobal: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('global-start');
		const result = await globalMiddleware(ctx, next);
		executionOrder.push('global-end');
		return result;
	};

	const trackingPage: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('page-start');
		const result = await pageMiddleware(ctx, next);
		executionOrder.push('page-end');
		return result;
	};

	const trackingAdmin: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('admin-start');
		const result = await adminMiddleware(ctx, next);
		executionOrder.push('admin-end');
		return result;
	};

	const neverExecuted: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('never-executed');
		return await next();
	};

	const middlewareChain: MiddlewareHandler[] = [trackingGlobal, trackingPage, trackingAdmin, neverExecuted];

	const result = await executor.execute(middlewareChain, context);

	// Should return 401 response from admin middleware
	assertExists(result.response);
	assertEquals(result.response.status, 401);

	// Verify execution stopped at admin middleware
	// Note: The tracking middleware will still call their "end" parts even when inner middleware returns early
	assertEquals(executionOrder, [
		'global-start',
		'page-start',
		'admin-start',
		'admin-end', // Called because tracking middleware completes
		'page-end', // Called because tracking middleware completes
		'global-end', // Called because tracking middleware completes
		// never-executed not called - this is the important part
	]);

	// Verify middleware state
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('pageMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('adminMiddlewareExecuted'), true);
});

Deno.test('Nested Middleware - State accumulation through chain', async () => {
	const request = new Request('http://localhost:3000/admin/dashboard', {
		headers: {
			Authorization: 'Bearer admin-token',
			Cookie: 'session=admin-session',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create middleware that adds to state at each level
	const stateAccumulator: MiddlewareHandler = async (ctx, next) => {
		// Check state accumulated from previous middleware
		const states = {
			global: ctx.state.get('globalMiddlewareExecuted'),
			page: ctx.state.get('pageMiddlewareExecuted'),
			admin: ctx.state.get('adminMiddlewareExecuted'),
			authenticated: ctx.state.get('authenticated'),
			userRole: ctx.state.get('userRole'),
			hasSession: ctx.state.get('hasSession'),
		};

		const locals = {
			requestId: ctx.locals.requestId,
			sessionId: ctx.locals.sessionId,
			user: ctx.locals.user,
			corsHeaders: !!ctx.locals.corsHeaders,
			pageSecurityHeaders: !!ctx.locals.pageSecurityHeaders,
		};

		return {
			response: new Response(JSON.stringify({ states, locals }), {
				headers: { 'Content-Type': 'application/json' },
			}),
			continue: false,
		};
	};

	const middlewareChain: MiddlewareHandler[] = [globalMiddleware, pageMiddleware, adminMiddleware, stateAccumulator];

	const result = await executor.execute(middlewareChain, context);

	assertExists(result.response);
	assertEquals(result.response.status, 200);

	const responseData = await result.response.json();

	// Verify state accumulation
	assertEquals(responseData.states.global, true);
	assertEquals(responseData.states.page, true);
	assertEquals(responseData.states.admin, true);
	assertEquals(responseData.states.authenticated, true);
	assertEquals(responseData.states.userRole, 'admin');
	assertEquals(responseData.states.hasSession, true);

	// Verify locals accumulation
	assertExists(responseData.locals.requestId);
	assertEquals(responseData.locals.sessionId, 'admin-session');
	assertEquals((responseData.locals.user as any).role, 'admin');
	assertEquals(responseData.locals.corsHeaders, true);
	assertEquals(responseData.locals.pageSecurityHeaders, true);
});

Deno.test('Nested Middleware - Complex API chain with multiple validations', async () => {
	const request = new Request('http://localhost:3000/api/auth/admin/users', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-API-Key': 'valid-api-key',
			Authorization: 'Bearer admin-token',
			Cookie: 'session=admin-session',
			'X-CSRF-Token': 'csrf-admin-session',
		},
		body: JSON.stringify({ name: 'New User', role: 'user' }),
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create an admin API middleware for nested auth endpoints
	const adminApiMiddleware: MiddlewareHandler = async (ctx, next) => {
		ctx.state.set('adminApiMiddlewareExecuted', true);

		// Check for authentication (similar to admin page middleware but for API)
		const authHeader = ctx.request.headers.get('Authorization');
		let user = null;

		if (authHeader?.startsWith('Bearer ')) {
			const token = authHeader.slice(7);
			// Mock token validation
			if (token === 'admin-token') {
				user = { id: 'admin', role: 'admin', name: 'Admin User' };
			} else if (token === 'user-token') {
				user = { id: 'user', role: 'user', name: 'Regular User' };
			}
		}

		if (!user || (user as any).role !== 'admin') {
			return {
				response: new Response(JSON.stringify({ error: 'Admin API access required' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' },
				}),
				continue: false,
			};
		}

		// Set authenticated user in context
		ctx.locals.user = user;
		ctx.state.set('authenticated', true);
		ctx.state.set('userRole', user.role);

		// Add admin API specific headers
		ctx.locals.adminApiHeaders = {
			'X-Admin-API-Version': '1.0',
			'X-Admin-Access': 'granted',
		};

		return await next();
	};

	const middlewareChain: MiddlewareHandler[] = [
		globalMiddleware, // CORS, request ID, logging
		apiMiddleware, // Rate limiting, API key, JSON parsing
		authApiMiddleware, // CSRF, auth rate limiting
		adminApiMiddleware, // Admin-specific validation
	];

	const result = await executor.execute(middlewareChain, context);

	// Should continue to route handler (no response returned)
	assertEquals(result.response, undefined);

	// Verify all middleware executed
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('apiMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('authApiMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('adminApiMiddlewareExecuted'), true);

	// Verify validations passed
	assertEquals(result.context.state.get('csrfValidated'), true);
	assertExists(result.context.locals.parsedBody);
	assertEquals((result.context.locals.parsedBody as any).name, 'New User');

	// Verify headers accumulated
	assertExists(result.context.locals.corsHeaders);
	assertExists(result.context.locals.apiHeaders);
	assertExists(result.context.locals.authApiHeaders);
	assertExists(result.context.locals.adminApiHeaders);
});

Deno.test('Nested Middleware - Error propagation through chain', async () => {
	const request = new Request('http://localhost:3000/admin/error-test', {
		headers: {
			Authorization: 'Bearer admin-token',
			Cookie: 'session=admin-session',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	const executionOrder: string[] = [];

	// Create middleware that throws an error
	const errorMiddleware: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('error-middleware');
		ctx.state.set('errorMiddlewareExecuted', true);
		throw new Error('Nested middleware error');
	};

	const trackingGlobal: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('global-start');
		try {
			const result = await globalMiddleware(ctx, next);
			executionOrder.push('global-end');
			return result;
		} catch (error) {
			executionOrder.push('global-error');
			throw error;
		}
	};

	const trackingPage: MiddlewareHandler = async (ctx, next) => {
		executionOrder.push('page-start');
		try {
			const result = await pageMiddleware(ctx, next);
			executionOrder.push('page-end');
			return result;
		} catch (error) {
			executionOrder.push('page-error');
			throw error;
		}
	};

	const middlewareChain: MiddlewareHandler[] = [trackingGlobal, trackingPage, adminMiddleware, errorMiddleware];

	const result = await executor.execute(middlewareChain, context);

	// Should return error response
	assertExists(result.response);
	assertEquals(result.response.status, 500);

	// Verify error propagated correctly
	// The middleware executor handles errors, but the tracking middleware still complete their execution
	assertEquals(executionOrder, ['global-start', 'page-start', 'error-middleware', 'page-end', 'global-end']);

	// Verify middleware executed up to error
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('pageMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('adminMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('errorMiddlewareExecuted'), true);
});

Deno.test('Nested Middleware - Performance with deep nesting', async () => {
	const request = new Request('http://localhost:3000/api/auth/admin/deep/nested/endpoint', {
		method: 'GET',
		headers: {
			'X-API-Key': 'valid-api-key',
			Authorization: 'Bearer admin-token',
			Cookie: 'session=admin-session',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create multiple levels of nested middleware
	const createNestedMiddleware = (level: number): MiddlewareHandler => {
		return async (ctx, next) => {
			ctx.state.set(`level${level}Start`, performance.now());
			const result = await next();
			ctx.state.set(`level${level}End`, performance.now());
			return result;
		};
	};

	const middlewareChain: MiddlewareHandler[] = [
		globalMiddleware,
		createNestedMiddleware(1),
		apiMiddleware,
		createNestedMiddleware(2),
		authApiMiddleware,
		createNestedMiddleware(3),
		createNestedMiddleware(4),
		createNestedMiddleware(5),
	];

	const startTime = performance.now();
	const result = await executor.execute(middlewareChain, context);
	const endTime = performance.now();

	// Should complete without response
	assertEquals(result.response, undefined);

	// Verify execution time is reasonable even with deep nesting
	const totalTime = endTime - startTime;
	assertEquals(totalTime < 100, true, `Total execution time ${totalTime}ms should be under 100ms`);

	// Verify all middleware executed
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('apiMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('authApiMiddlewareExecuted'), true);

	// Verify nested timing middleware executed
	for (let i = 1; i <= 5; i++) {
		assertExists(result.context.state.get(`level${i}Start`));
		assertExists(result.context.state.get(`level${i}End`));

		const levelStart = result.context.state.get(`level${i}Start`) as number;
		const levelEnd = result.context.state.get(`level${i}End`) as number;
		assertEquals(levelEnd > levelStart, true);
	}
});
