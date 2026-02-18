/**
 * Integration tests for complete middleware chains with API routes
 */

import { describe, it, expect } from 'vitest';
import { MiddlewareExecutor } from '../packages/avalon/src/core/middleware/middleware-executor.ts';
import { MiddlewareContextManager } from '../packages/avalon/src/core/middleware/middleware-context.ts';
import type { MiddlewareHandler } from '../packages/avalon/src/schemas/middleware.ts';

// Import test fixtures
const globalMiddleware = (await import('./fixtures/middleware-integration/src/_middleware.ts')).default;
const apiMiddleware = (await import('./fixtures/middleware-integration/src/api/_middleware.ts')).default;
const authApiMiddleware = (await import('./fixtures/middleware-integration/src/api/auth/_middleware.ts')).default;

describe('API Middleware Chain - Global + API middleware execution', () => {
	it('should execute global and API middleware', async () => {
		const request = new Request('http://localhost:3000/api/users', {
			method: 'GET',
			headers: {
				'X-Forwarded-For': '192.168.1.1',
			},
		});

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

		const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware];

		const result = await executor.execute(middlewareChain, context);

		expect(result.response).toBeUndefined();
		expect(result.context.state.get('globalMiddlewareExecuted')).toEqual(true);
		expect(result.context.locals.requestId).toBeDefined();
		expect(result.context.locals.corsHeaders).toBeDefined();
		expect(result.context.state.get('apiMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('rate_limit_192.168.1.1')).toEqual(1);
		expect(result.context.locals.apiHeaders).toBeDefined();
	});
});

describe('API Middleware Chain - Global + API + Auth API middleware execution', () => {
	it('should execute all three middleware layers', async () => {
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

		const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware, authApiMiddleware];

		const result = await executor.execute(middlewareChain, context);

		expect(result.response).toBeUndefined();
		expect(result.context.state.get('globalMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('apiMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('authApiMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('csrfValidated')).toEqual(true);
		expect(result.context.locals.parsedBody).toBeDefined();
		expect((result.context.locals.parsedBody as any).username).toEqual('testuser');
		expect(result.context.state.get('rate_limit_192.168.1.1')).toEqual(1);
		expect(result.context.state.get('auth_rate_limit_192.168.1.1')).toEqual(1);
	});
});

describe('API Middleware Chain - Rate limiting', () => {
	it('should block excessive requests', async () => {
		const request = new Request('http://localhost:3000/api/users', {
			headers: {
				'X-Forwarded-For': '192.168.1.100',
			},
		});

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

		context.state.set('rate_limit_192.168.1.100', 100);

		const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware];

		const result = await executor.execute(middlewareChain, context);

		expect(result.response).toBeDefined();
		expect(result.response!.status).toEqual(429);

		const responseData = await result.response!.json();
		expect(responseData.error).toEqual('Rate limit exceeded');

		expect(result.response!.headers.get('X-RateLimit-Limit')).toEqual('100');
		expect(result.response!.headers.get('X-RateLimit-Remaining')).toEqual('0');
	});

	it('should enforce auth API rate limiting', async () => {
		const request = new Request('http://localhost:3000/api/auth/login', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Forwarded-For': '192.168.1.200',
			},
		});

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

		context.state.set('auth_rate_limit_192.168.1.200', 10);

		const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware, authApiMiddleware];

		const result = await executor.execute(middlewareChain, context);

		expect(result.response).toBeDefined();
		expect(result.response!.status).toEqual(429);

		const responseData = await result.response!.json();
		expect(responseData.error).toEqual('Auth rate limit exceeded');

		expect(result.response!.headers.get('X-Auth-RateLimit-Limit')).toEqual('10');
		expect(result.response!.headers.get('X-Auth-RateLimit-Remaining')).toEqual('0');
	});
});

describe('API Middleware Chain - Protected API', () => {
	it('should require API key', async () => {
		const request = new Request('http://localhost:3000/api/protected/data');

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

		const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware];

		const result = await executor.execute(middlewareChain, context);

		expect(result.response).toBeDefined();
		expect(result.response!.status).toEqual(401);

		const responseData = await result.response!.json();
		expect(responseData.error).toEqual('Invalid API key');
	});

	it('should accept valid API key', async () => {
		const request = new Request('http://localhost:3000/api/protected/data', {
			headers: {
				'X-API-Key': 'valid-api-key',
			},
		});

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

		const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware];

		const result = await executor.execute(middlewareChain, context);

		expect(result.response).toBeUndefined();
		expect(result.context.state.get('globalMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('apiMiddlewareExecuted')).toEqual(true);
	});
});

describe('API Middleware Chain - CSRF protection', () => {
	it('should enforce CSRF protection for auth endpoints', async () => {
		const request = new Request('http://localhost:3000/api/auth/logout', {
			method: 'POST',
			headers: {
				Cookie: 'session=user-session',
			},
		});

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

		const middlewareChain: MiddlewareHandler[] = [globalMiddleware, apiMiddleware, authApiMiddleware];

		const result = await executor.execute(middlewareChain, context);

		expect(result.response).toBeDefined();
		expect(result.response!.status).toEqual(403);

		const responseData = await result.response!.json();
		expect(responseData.error).toEqual('CSRF token required');
	});
});

describe('API Middleware Chain - Invalid JSON body handling', () => {
	it('should reject invalid JSON body', async () => {
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

		expect(result.response).toBeDefined();
		expect(result.response!.status).toEqual(400);

		const responseData = await result.response!.json();
		expect(responseData.error).toEqual('Invalid JSON body');
	});
});

describe('API Middleware Chain - Response headers from all middleware', () => {
	it('should include headers from all middleware layers', async () => {
		const request = new Request('http://localhost:3000/api/auth/profile', {
			method: 'GET',
			headers: {
				'X-API-Key': 'valid-api-key',
				Cookie: 'session=user-session',
			},
		});

		const context = MiddlewareContextManager.createContext(request);
		const executor = new MiddlewareExecutor();

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

		expect(result.response).toBeDefined();
		expect(result.response!.status).toEqual(200);

		expect(result.response!.headers.get('Access-Control-Allow-Origin')).toEqual('*');
		expect(result.response!.headers.get('X-Request-ID')).toBeDefined();
		expect(result.response!.headers.get('X-API-Version')).toEqual('1.0');
		expect(result.response!.headers.get('X-RateLimit-Limit')).toEqual('100');
		expect(result.response!.headers.get('X-Auth-API-Version')).toEqual('1.0');
		expect(result.response!.headers.get('X-Auth-RateLimit-Limit')).toEqual('10');

		const responseData = await result.response!.json();
		expect(responseData.user).toEqual('profile data');
	});
});

describe('API Middleware Chain - Context state and locals passing', () => {
	it('should pass state and locals through all middleware', async () => {
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

		const stateCheckingMiddleware: MiddlewareHandler = async (ctx, next) => {
			return {
				response: new Response(
					JSON.stringify({
						globalExecuted: ctx.state.get('globalMiddlewareExecuted'),
						apiExecuted: ctx.state.get('apiMiddlewareExecuted'),
						authApiExecuted: ctx.state.get('authApiMiddlewareExecuted'),
						csrfValidated: ctx.state.get('csrfValidated'),
						requestStartTime: ctx.state.get('requestStartTime'),
						requestId: ctx.locals.requestId,
						parsedBody: ctx.locals.parsedBody,
						corsHeaders: !!ctx.locals.corsHeaders,
						apiHeaders: !!ctx.locals.apiHeaders,
						authApiHeaders: !!ctx.locals.authApiHeaders,
					}),
					{ headers: { 'Content-Type': 'application/json' } }
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

		expect(result.response).toBeDefined();
		expect(result.response!.status).toEqual(200);

		const responseData = await result.response!.json();
		expect(responseData.globalExecuted).toEqual(true);
		expect(responseData.apiExecuted).toEqual(true);
		expect(responseData.authApiExecuted).toEqual(true);
		expect(responseData.csrfValidated).toEqual(true);
		expect(responseData.requestStartTime).toBeDefined();
		expect(responseData.requestId).toBeDefined();
		expect((responseData.parsedBody as any).check).toEqual('status');
		expect(responseData.corsHeaders).toEqual(true);
		expect(responseData.apiHeaders).toEqual(true);
		expect(responseData.authApiHeaders).toEqual(true);
	});
});

describe('API Middleware Chain - Performance', () => {
	it('should complete complex middleware chain quickly', async () => {
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

		expect(result.response).toBeUndefined();

		const executionTime = endTime - startTime;
		expect(executionTime < 50).toEqual(true);

		expect(result.context.state.get('globalMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('apiMiddlewareExecuted')).toEqual(true);
		expect(result.context.state.get('authApiMiddlewareExecuted')).toEqual(true);

		expect(result.context.state.get('perf1Start')).toBeDefined();
		expect(result.context.state.get('perf1End')).toBeDefined();
		expect(result.context.state.get('perf2Start')).toBeDefined();
		expect(result.context.state.get('perf2End')).toBeDefined();

		const perf1Duration =
			(result.context.state.get('perf1End') as number) - (result.context.state.get('perf1Start') as number);
		const perf2Duration =
			(result.context.state.get('perf2End') as number) - (result.context.state.get('perf2Start') as number);

		expect(perf1Duration > 0).toEqual(true);
		expect(perf2Duration > 0).toEqual(true);
		expect(perf1Duration < 100).toEqual(true);
		expect(perf2Duration < 100).toEqual(true);
	});
});
