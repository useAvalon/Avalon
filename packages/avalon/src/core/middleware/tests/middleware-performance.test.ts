/**
 * Performance tests for middleware execution overhead
 *  1.1, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3
 */

import { assertEquals, assertExists } from '@std/assert';
import { MiddlewareExecutor } from '../middleware-executor.ts';
import { MiddlewareContextManager } from '../middleware-context.ts';
import type { MiddlewareHandler } from '../../../schemas/middleware.ts';

// Import test fixtures
const globalMiddleware = (await import('./fixtures/middleware-integration/src/_middleware.ts')).default;
const pageMiddleware = (await import('./fixtures/middleware-integration/src/pages/_middleware.ts')).default;
const adminMiddleware = (await import('./fixtures/middleware-integration/src/pages/admin/_middleware.ts')).default;
const apiMiddleware = (await import('./fixtures/middleware-integration/src/api/_middleware.ts')).default;
const authApiMiddleware = (await import('./fixtures/middleware-integration/src/api/auth/_middleware.ts')).default;

// Helper function to create simple middleware for performance testing
const createSimpleMiddleware = (id: string): MiddlewareHandler => {
	return async (context, next) => {
		context.state.set(`${id}_start`, performance.now());
		const result = await next();
		context.state.set(`${id}_end`, performance.now());
		return result;
	};
};

// Helper function to create async middleware with delay
const createAsyncMiddleware = (id: string, delayMs: number): MiddlewareHandler => {
	return async (context, next) => {
		context.state.set(`${id}_start`, performance.now());
		await new Promise(resolve => setTimeout(resolve, delayMs));
		const result = await next();
		context.state.set(`${id}_end`, performance.now());
		return result;
	};
};

Deno.test('Middleware Performance - Single middleware execution time', async () => {
	const request = new Request('http://localhost:3000/test');
	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	const startTime = performance.now();
	const result = await executor.execute([globalMiddleware], context);
	const endTime = performance.now();

	const executionTime = endTime - startTime;

	// Single middleware should execute very quickly (under 10ms)
	assertEquals(executionTime < 10, true, `Single middleware execution time ${executionTime}ms should be under 10ms`);
	assertEquals(result.response, undefined); // Should continue to route handler
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
});

Deno.test('Middleware Performance - Multiple middleware chain execution', async () => {
	const request = new Request('http://localhost:3000/admin/test', {
		headers: {
			Authorization: 'Bearer admin-token',
			Cookie: 'session=admin-session',
		},
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	const middlewareChain = [globalMiddleware, pageMiddleware, adminMiddleware];

	const startTime = performance.now();
	const result = await executor.execute(middlewareChain, context);
	const endTime = performance.now();

	const executionTime = endTime - startTime;

	// Three middleware should execute quickly (under 20ms)
	assertEquals(executionTime < 20, true, `Three middleware execution time ${executionTime}ms should be under 20ms`);
	assertEquals(result.response, undefined);
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('pageMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('adminMiddlewareExecuted'), true);
});

Deno.test('Middleware Performance - Large middleware chain (10 middleware)', async () => {
	const request = new Request('http://localhost:3000/performance-test');
	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create a chain of 10 simple middleware
	const middlewareChain: MiddlewareHandler[] = [];
	for (let i = 1; i <= 10; i++) {
		middlewareChain.push(createSimpleMiddleware(`middleware_${i}`));
	}

	const startTime = performance.now();
	const result = await executor.execute(middlewareChain, context);
	const endTime = performance.now();

	const executionTime = endTime - startTime;

	// 10 simple middleware should execute reasonably quickly (under 50ms)
	assertEquals(executionTime < 50, true, `10 middleware execution time ${executionTime}ms should be under 50ms`);
	assertEquals(result.response, undefined);

	// Verify all middleware executed
	for (let i = 1; i <= 10; i++) {
		assertExists(result.context.state.get(`middleware_${i}_start`));
		assertExists(result.context.state.get(`middleware_${i}_end`));
	}
});

Deno.test('Middleware Performance - Async middleware with minimal delay', async () => {
	const request = new Request('http://localhost:3000/async-test');
	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create middleware with 1ms delay each
	const middlewareChain = [
		createAsyncMiddleware('async1', 1),
		createAsyncMiddleware('async2', 1),
		createAsyncMiddleware('async3', 1),
	];

	const startTime = performance.now();
	const result = await executor.execute(middlewareChain, context);
	const endTime = performance.now();

	const executionTime = endTime - startTime;

	// Should take at least 3ms (3 x 1ms delays) but not much more
	assertEquals(executionTime >= 3, true, `Async execution time ${executionTime}ms should be at least 3ms`);
	assertEquals(executionTime < 20, true, `Async execution time ${executionTime}ms should be under 20ms`);
	assertEquals(result.response, undefined);
});

Deno.test('Middleware Performance - Memory usage with large context', async () => {
	const request = new Request('http://localhost:3000/memory-test', {
		method: 'POST',
		body: JSON.stringify({ data: 'x'.repeat(10000) }), // 10KB body
		headers: { 'Content-Type': 'application/json' },
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create middleware that adds data to context
	const memoryMiddleware: MiddlewareHandler = async (ctx, next) => {
		// Add some data to state and locals
		ctx.state.set('largeData', 'x'.repeat(5000)); // 5KB
		ctx.locals.largeObject = { data: 'y'.repeat(5000) }; // 5KB
		return await next();
	};

	const middlewareChain = [globalMiddleware, memoryMiddleware, apiMiddleware];

	const startTime = performance.now();
	const result = await executor.execute(middlewareChain, context);
	const endTime = performance.now();

	const executionTime = endTime - startTime;

	// Should handle large context efficiently
	assertEquals(executionTime < 30, true, `Large context execution time ${executionTime}ms should be under 30ms`);
	assertEquals(result.response, undefined);

	// Verify data was stored
	assertEquals(result.context.state.get('largeData'), 'x'.repeat(5000));
	assertEquals((result.context.locals.largeObject as any).data, 'y'.repeat(5000));
});

Deno.test('Middleware Performance - Concurrent middleware execution simulation', async () => {
	const executor = new MiddlewareExecutor();

	// Simulate multiple concurrent requests
	const requests = Array.from({ length: 10 }, (_, i) => new Request(`http://localhost:3000/concurrent-test-${i}`));

	const middlewareChain = [globalMiddleware, pageMiddleware];

	const startTime = performance.now();

	// Execute all requests concurrently
	const results = await Promise.all(
		requests.map(async request => {
			const context = MiddlewareContextManager.createContext(request);
			return await executor.execute(middlewareChain, context);
		})
	);

	const endTime = performance.now();
	const totalTime = endTime - startTime;

	// All 10 requests should complete quickly when run concurrently
	assertEquals(totalTime < 100, true, `10 concurrent requests took ${totalTime}ms, should be under 100ms`);

	// All requests should complete successfully
	results.forEach(result => {
		assertEquals(result.response, undefined); // Should continue to route handler
	});
});

Deno.test('Middleware Performance - Early termination performance', async () => {
	const request = new Request('http://localhost:3000/early-termination');
	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create middleware that terminates early
	const earlyTerminationMiddleware: MiddlewareHandler = async (ctx, next) => {
		ctx.state.set('earlyTermination', performance.now());
		return {
			response: new Response('Early termination', { status: 200 }),
			continue: false,
		};
	};

	// Create expensive middleware that should not execute
	const expensiveMiddleware: MiddlewareHandler = async (ctx, next) => {
		// Simulate expensive operation
		await new Promise(resolve => setTimeout(resolve, 100));
		ctx.state.set('expensiveExecuted', true);
		return await next();
	};

	const middlewareChain = [
		globalMiddleware,
		earlyTerminationMiddleware,
		expensiveMiddleware, // Should not execute
	];

	const startTime = performance.now();
	const result = await executor.execute(middlewareChain, context);
	const endTime = performance.now();

	const executionTime = endTime - startTime;

	// Should terminate quickly without executing expensive middleware
	assertEquals(executionTime < 20, true, `Early termination took ${executionTime}ms, should be under 20ms`);

	assertExists(result.response);
	assertEquals(result.response.status, 200);

	// Verify expensive middleware did not execute
	assertEquals(result.context.state.get('expensiveExecuted'), undefined);
	assertExists(result.context.state.get('earlyTermination'));
});

Deno.test('Middleware Performance - Error handling performance', async () => {
	const request = new Request('http://localhost:3000/error-performance');
	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Create middleware that throws an error
	const errorMiddleware: MiddlewareHandler = async (ctx, next) => {
		ctx.state.set('errorTime', performance.now());
		throw new Error('Performance test error');
	};

	const middlewareChain = [globalMiddleware, errorMiddleware];

	const startTime = performance.now();
	const result = await executor.execute(middlewareChain, context);
	const endTime = performance.now();

	const executionTime = endTime - startTime;

	// Error handling should be fast
	assertEquals(executionTime < 15, true, `Error handling took ${executionTime}ms, should be under 15ms`);

	assertExists(result.response);
	assertEquals(result.response.status, 500);
	assertExists(result.context.state.get('errorTime'));
});

Deno.test('Middleware Performance - Complex real-world scenario', async () => {
	const request = new Request('http://localhost:3000/api/auth/admin/complex', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Bearer admin-token',
			Cookie: 'session=admin-session',
			'X-CSRF-Token': 'csrf-admin-session',
			'X-API-Key': 'valid-api-key',
		},
		body: JSON.stringify({
			operation: 'create_user',
			data: { name: 'Test User', email: 'test@example.com' },
		}),
	});

	const context = MiddlewareContextManager.createContext(request);
	const executor = new MiddlewareExecutor();

	// Simulate a complex real-world middleware chain
	const loggingMiddleware: MiddlewareHandler = async (ctx, next) => {
		ctx.state.set('requestStart', performance.now());
		const result = await next();
		ctx.state.set('requestEnd', performance.now());
		return result;
	};

	const validationMiddleware: MiddlewareHandler = async (ctx, next) => {
		// Simulate request validation
		const body = ctx.locals.parsedBody;
		if (body && typeof body === 'object' && 'operation' in body) {
			ctx.locals.validatedOperation = body.operation;
		}
		return await next();
	};

	const middlewareChain = [loggingMiddleware, globalMiddleware, apiMiddleware, authApiMiddleware, validationMiddleware];

	const startTime = performance.now();
	const result = await executor.execute(middlewareChain, context);
	const endTime = performance.now();

	const executionTime = endTime - startTime;

	// Complex real-world scenario should still be performant
	assertEquals(executionTime < 40, true, `Complex scenario took ${executionTime}ms, should be under 40ms`);
	assertEquals(result.response, undefined); // Should continue to route handler

	// Verify all processing completed
	assertEquals(result.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('apiMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('authApiMiddlewareExecuted'), true);
	assertEquals(result.context.state.get('csrfValidated'), true);
	assertEquals((result.context.locals as any).validatedOperation, 'create_user');
	assertExists(result.context.state.get('requestStart'));
	assertExists(result.context.state.get('requestEnd'));

	// Verify request timing
	const requestStart = result.context.state.get('requestStart') as number;
	const requestEnd = result.context.state.get('requestEnd') as number;
	assertEquals(requestEnd > requestStart, true);
});

Deno.test('Middleware Performance - Benchmark comparison with and without middleware', async () => {
	const request = new Request('http://localhost:3000/benchmark');

	// Test without middleware
	const startTimeNoMiddleware = performance.now();
	const contextNoMiddleware = MiddlewareContextManager.createContext(request);
	const endTimeNoMiddleware = performance.now();
	const noMiddlewareTime = endTimeNoMiddleware - startTimeNoMiddleware;

	// Test with middleware
	const executor = new MiddlewareExecutor();
	const middlewareChain = [globalMiddleware, pageMiddleware];

	const startTimeWithMiddleware = performance.now();
	const contextWithMiddleware = MiddlewareContextManager.createContext(request);
	const resultWithMiddleware = await executor.execute(middlewareChain, contextWithMiddleware);
	const endTimeWithMiddleware = performance.now();
	const withMiddlewareTime = endTimeWithMiddleware - startTimeWithMiddleware;

	// Middleware overhead should be minimal
	const overhead = withMiddlewareTime - noMiddlewareTime;
	assertEquals(overhead < 20, true, `Middleware overhead ${overhead}ms should be under 20ms`);
	assertEquals(
		withMiddlewareTime < 30,
		true,
		`Total time with middleware ${withMiddlewareTime}ms should be under 30ms`
	);

	// Verify middleware executed
	assertEquals(resultWithMiddleware.context.state.get('globalMiddlewareExecuted'), true);
	assertEquals(resultWithMiddleware.context.state.get('pageMiddlewareExecuted'), true);
});
