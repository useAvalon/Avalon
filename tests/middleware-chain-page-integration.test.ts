/**
 * Integration tests for complete middleware chains with page routes
 */

import { describe, it, expect } from 'vitest';
import { MiddlewareExecutor } from '../packages/avalon/src/core/middleware/middleware-executor.ts';
import { MiddlewareContextManager } from '../packages/avalon/src/core/middleware/middleware-context.ts';
import type { MiddlewareHandler } from '../packages/avalon/src/schemas/middleware.ts';

// Import test fixtures
const globalMiddleware = (await import('./fixtures/middleware-integration/src/_middleware.ts')).default;
const pageMiddleware = (await import('./fixtures/middleware-integration/src/pages/_middleware.ts')).default;
const adminMiddleware = (await import('./fixtures/middleware-integration/src/pages/admin/_middleware.ts')).default;

describe('Page Middleware Chain - Global + Pages middleware execution', () => {
	it('should execute global and page middleware', async () => {
		const request = new Request('http://localhost:3000/dashboard', {
			headers: {
				Cookie: 'session=user-session',
			},
		});

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

		const middlewareChain: MiddlewareHandler[] = [globalMiddleware, pageMiddleware];

		const result = await executor.execute(middlewareChain, context);

		expect(result.response).toBeUndefined();
		expect(result.context.state.get('globalMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('requestStartTime') !== undefined).toEqual(true);
		expect(result.context.locals.requestId).toBeDefined();
		expect(result.context.locals.corsHeaders).toBeDefined();
		expect(result.context.state.get('pageMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('hasSession')).toEqual(true);
		expect(result.context.locals.sessionId).toEqual('user-session');
		expect(result.context.locals.pageSecurityHeaders).toBeDefined();
	});
});

describe('Page Middleware Chain - Global + Pages + Admin middleware execution', () => {
	it('should execute all three middleware layers', async () => {
		const request = new Request('http://localhost:3000/admin/dashboard', {
			headers: {
				Authorization: 'Bearer admin-token',
				Cookie: 'session=admin-session',
			},
		});

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

		const middlewareChain: MiddlewareHandler[] = [globalMiddleware, pageMiddleware, adminMiddleware];

		const result = await executor.execute(middlewareChain, context);

		expect(result.response).toBeUndefined();
		expect(result.context.state.get('globalMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('pageMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('adminMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('authenticated')).toEqual(true);
		expect(result.context.state.get('userRole')).toEqual('admin');
		expect(result.context.locals.user).toBeDefined();
		expect((result.context.locals.user as any).role).toEqual('admin');
	});
});

describe('Page Middleware Chain - Authorization', () => {
	it('should block unauthorized access to admin', async () => {
		const request = new Request('http://localhost:3000/admin/dashboard');

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

		const middlewareChain: MiddlewareHandler[] = [globalMiddleware, pageMiddleware, adminMiddleware];

		const result = await executor.execute(middlewareChain, context);

		expect(result.response).toBeDefined();
		expect(result.response!.status).toEqual(401);

		const responseData = await result.response!.json();
		expect(responseData.error).toEqual('Authentication required');

		expect(result.context.state.get('globalMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('pageMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('adminMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('authenticated')).toBeUndefined();
	});

	it('should block non-admin users from admin routes', async () => {
		const request = new Request('http://localhost:3000/admin/dashboard', {
			headers: {
				Authorization: 'Bearer user-token',
			},
		});

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

		const middlewareChain: MiddlewareHandler[] = [globalMiddleware, pageMiddleware, adminMiddleware];

		const result = await executor.execute(middlewareChain, context);

		expect(result.response).toBeDefined();
		expect(result.response!.status).toEqual(403);

		const responseData = await result.response!.json();
		expect(responseData.error).toEqual('Admin access required');
	});
});

describe('Page Middleware Chain - Response headers from all middleware', () => {
	it('should include headers from all middleware layers', async () => {
		const request = new Request('http://localhost:3000/admin/users', {
			headers: {
				Authorization: 'Bearer admin-token',
				Cookie: 'session=admin-session',
			},
		});

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

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

		expect(result.response).toBeDefined();
		expect(result.response!.status).toEqual(200);

		expect(result.response!.headers.get('Access-Control-Allow-Origin')).toEqual('*');
		expect(result.response!.headers.get('X-Request-ID')).toBeDefined();
		expect(result.response!.headers.get('X-Frame-Options')).toEqual('DENY');
		expect(result.response!.headers.get('X-Content-Type-Options')).toEqual('nosniff');
		expect(result.response!.headers.get('X-XSS-Protection')).toEqual('1; mode=block');

		const responseData = await result.response!.json();
		expect(responseData.message).toEqual('Admin page content');
	});
});

describe('Page Middleware Chain - Context state passing', () => {
	it('should pass state between all middleware layers', async () => {
		const request = new Request('http://localhost:3000/admin/settings', {
			headers: {
				Authorization: 'Bearer admin-token',
				Cookie: 'session=admin-session',
			},
		});

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

		const stateCheckingMiddleware: MiddlewareHandler = async (ctx, next) => {
			return {
				response: new Response(
					JSON.stringify({
						globalExecuted: ctx.state.get('globalMiddlewareExecuted'),
						pageExecuted: ctx.state.get('pageMiddlewareExecuted'),
						adminExecuted: ctx.state.get('adminMiddlewareExecuted'),
						authenticated: ctx.state.get('authenticated'),
						userRole: ctx.state.get('userRole'),
						hasSession: ctx.state.get('hasSession'),
						sessionId: ctx.locals.sessionId,
						userId: (ctx.locals.user as any)?.id,
						requestId: ctx.locals.requestId,
					}),
					{ headers: { 'Content-Type': 'application/json' } }
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

		expect(result.response).toBeDefined();
		expect(result.response!.status).toEqual(200);

		const responseData = await result.response!.json();
		expect(responseData.globalExecuted).toEqual(true);
		expect(responseData.pageExecuted).toEqual(true);
		expect(responseData.adminExecuted).toEqual(true);
		expect(responseData.authenticated).toEqual(true);
		expect(responseData.userRole).toEqual('admin');
		expect(responseData.hasSession).toEqual(true);
		expect(responseData.sessionId).toEqual('admin-session');
		expect(responseData.userId).toEqual('admin');
		expect(responseData.requestId).toBeDefined();
	});
});

describe('Page Middleware Chain - Error handling', () => {
	it('should handle middleware errors gracefully', async () => {
		const request = new Request('http://localhost:3000/error-page');

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

		const errorMiddleware: MiddlewareHandler = async (ctx, next) => {
			ctx.state.set('errorMiddlewareExecuted', true);
			throw new Error('Test middleware error');
		};

		const middlewareChain: MiddlewareHandler[] = [globalMiddleware, pageMiddleware, errorMiddleware];

		const result = await executor.execute(middlewareChain, context);

		expect(result.response).toBeDefined();
		expect(result.response!.status).toEqual(500);

		const responseText = await result.response!.text();
		expect(responseText).toEqual('Internal Server Error');

		expect(result.context.state.get('globalMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('pageMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('errorMiddlewareExecuted')).toEqual(true);
	});
});

describe('Page Middleware Chain - Performance', () => {
	it('should complete middleware chain quickly', async () => {
		const request = new Request('http://localhost:3000/performance-test', {
			headers: {
				Authorization: 'Bearer admin-token',
				Cookie: 'session=admin-session',
			},
		});

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

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

		expect(result.response).toBeUndefined();

		const executionTime = endTime - startTime;
		expect(executionTime < 100).toEqual(true);

		expect(result.context.state.get('globalMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('pageMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('adminMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('authenticated')).toEqual(true);

		expect(result.context.state.get('perf1Start')).toBeDefined();
		expect(result.context.state.get('perf1End')).toBeDefined();
		expect(result.context.state.get('perf2Start')).toBeDefined();
		expect(result.context.state.get('perf2End')).toBeDefined();
	});
});
