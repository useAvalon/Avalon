import { assertEquals, assertExists, assertRejects } from 'jsr:@std/assert';
import { describe, it, beforeEach } from 'https://deno.land/std@0.208.0/testing/bdd.ts';
import { MiddlewareExecutor } from '../middleware-executor.ts';
import {
	MiddlewareContext,
	MiddlewareResponse,
	MiddlewareHandler,
	MiddlewareConfig,
} from '../../../schemas/middleware.ts';

describe('MiddlewareExecutor', () => {
	let executor: MiddlewareExecutor;
	let mockContext: MiddlewareContext;

	beforeEach(() => {
		executor = new MiddlewareExecutor();
		mockContext = {
			request: new Request('https://example.com/test'),
			url: new URL('https://example.com/test'),
			params: {},
			query: {},
			state: new Map(),
			locals: {},
		};
	});

	describe('constructor', () => {
		it('should create executor with default config', () => {
			const executor = new MiddlewareExecutor();
			const config = executor.getConfig();

			assertEquals(config.developmentMode, false);
			assertEquals(config.enableLogging, false);
			assertEquals(config.maxExecutionTime, 30000);
		});

		it('should create executor with custom config', () => {
			const customConfig: MiddlewareConfig = {
				developmentMode: true,
				enableLogging: true,
				maxExecutionTime: 5000,
			};

			const executor = new MiddlewareExecutor(customConfig);
			const config = executor.getConfig();

			assertEquals(config.developmentMode, true);
			assertEquals(config.enableLogging, true);
			assertEquals(config.maxExecutionTime, 5000);
		});
	});

	describe('execute', () => {
		it('should execute empty middleware chain', async () => {
			const result = await executor.execute([], mockContext);

			assertEquals(result.response, undefined);
			assertEquals(result.metadata.middlewareExecuted, 0);
			assertEquals(result.metadata.earlyTermination, false);
			assertEquals(result.metadata.error, undefined);
		});

		it('should execute single middleware that continues', async () => {
			const middleware: MiddlewareHandler = async (context, next) => {
				context.locals.executed = true;
				return await next();
			};

			const result = await executor.execute([middleware], mockContext);

			assertEquals(result.response, undefined);
			assertEquals(result.context.locals.executed, true);
			assertEquals(result.metadata.middlewareExecuted, 1);
			assertEquals(result.metadata.earlyTermination, false);
		});

		it('should execute multiple middleware in order', async () => {
			const executionOrder: number[] = [];

			const middleware1: MiddlewareHandler = async (context, next) => {
				executionOrder.push(1);
				context.locals.first = true;
				return await next();
			};

			const middleware2: MiddlewareHandler = async (context, next) => {
				executionOrder.push(2);
				context.locals.second = true;
				return await next();
			};

			const middleware3: MiddlewareHandler = async (context, next) => {
				executionOrder.push(3);
				context.locals.third = true;
				return await next();
			};

			const result = await executor.execute([middleware1, middleware2, middleware3], mockContext);

			assertEquals(executionOrder, [1, 2, 3]);
			assertEquals(result.context.locals.first, true);
			assertEquals(result.context.locals.second, true);
			assertEquals(result.context.locals.third, true);
			assertEquals(result.metadata.middlewareExecuted, 3);
		});

		it('should support early termination when middleware returns response', async () => {
			const executionOrder: number[] = [];

			const middleware1: MiddlewareHandler = async (context, next) => {
				executionOrder.push(1);
				return await next();
			};

			const middleware2: MiddlewareHandler = async (context, next) => {
				executionOrder.push(2);
				return {
					response: new Response('Early termination', { status: 200 }),
					continue: false,
				};
			};

			const middleware3: MiddlewareHandler = async (context, next) => {
				executionOrder.push(3);
				return await next();
			};

			const result = await executor.execute([middleware1, middleware2, middleware3], mockContext);

			assertEquals(executionOrder, [1, 2]);
			assertExists(result.response);
			assertEquals(await result.response!.text(), 'Early termination');
			assertEquals(result.metadata.middlewareExecuted, 2);
			assertEquals(result.metadata.earlyTermination, true);
		});

		it('should handle synchronous middleware', async () => {
			const syncMiddleware: MiddlewareHandler = (context, next) => {
				context.locals.sync = true;
				return next();
			};

			const result = await executor.execute([syncMiddleware], mockContext);

			assertEquals(result.context.locals.sync, true);
			assertEquals(result.metadata.middlewareExecuted, 1);
		});

		it('should handle asynchronous middleware', async () => {
			const asyncMiddleware: MiddlewareHandler = async (context, next) => {
				await new Promise(resolve => setTimeout(resolve, 10));
				context.locals.async = true;
				return await next();
			};

			const result = await executor.execute([asyncMiddleware], mockContext);

			assertEquals(result.context.locals.async, true);
			assertEquals(result.metadata.middlewareExecuted, 1);
		});

		it('should handle mixed sync and async middleware', async () => {
			const executionOrder: string[] = [];

			const syncMiddleware: MiddlewareHandler = (context, next) => {
				executionOrder.push('sync');
				return next();
			};

			const asyncMiddleware: MiddlewareHandler = async (context, next) => {
				await new Promise(resolve => setTimeout(resolve, 10));
				executionOrder.push('async');
				return await next();
			};

			const result = await executor.execute([syncMiddleware, asyncMiddleware], mockContext);

			assertEquals(executionOrder, ['sync', 'async']);
			assertEquals(result.metadata.middlewareExecuted, 2);
		});

		it('should handle middleware errors gracefully', async () => {
			const errorMiddleware: MiddlewareHandler = async (context, next) => {
				throw new Error('Middleware error');
			};

			const result = await executor.execute([errorMiddleware], mockContext);

			assertExists(result.response);
			assertEquals(result.response!.status, 500);
			assertEquals(await result.response!.text(), 'Internal Server Error');
			assertEquals(result.metadata.middlewareExecuted, 1);
			assertEquals(result.metadata.earlyTermination, true);
		});

		it('should continue execution after error in one middleware', async () => {
			const executionOrder: number[] = [];

			const middleware1: MiddlewareHandler = async (context, next) => {
				executionOrder.push(1);
				return await next();
			};

			const errorMiddleware: MiddlewareHandler = async (context, next) => {
				executionOrder.push(2);
				throw new Error('Middleware error');
			};

			const result = await executor.execute([middleware1, errorMiddleware], mockContext);

			assertEquals(executionOrder, [1, 2]);
			assertExists(result.response);
			assertEquals(result.response!.status, 500);
			assertEquals(result.metadata.middlewareExecuted, 2);
		});

		it('should pass state between middleware', async () => {
			const middleware1: MiddlewareHandler = async (context, next) => {
				context.state.set('key1', 'value1');
				context.locals.prop1 = 'local1';
				return await next();
			};

			const middleware2: MiddlewareHandler = async (context, next) => {
				const value1 = context.state.get('key1');
				context.state.set('key2', `${value1}-modified`);
				context.locals.prop2 = context.locals.prop1 + '-extended';
				return await next();
			};

			const result = await executor.execute([middleware1, middleware2], mockContext);

			assertEquals(result.context.state.get('key1'), 'value1');
			assertEquals(result.context.state.get('key2'), 'value1-modified');
			assertEquals(result.context.locals.prop1, 'local1');
			assertEquals(result.context.locals.prop2, 'local1-extended');
		});

		it('should validate middleware return values', async () => {
			const invalidMiddleware = async (context: any, next: any) => {
				// @ts-ignore - intentionally return invalid response
				return { invalid: true };
			};

			const result = await executor.execute([invalidMiddleware as any], mockContext);

			assertExists(result.response);
			assertEquals(result.response!.status, 500);
			assertEquals(result.metadata.earlyTermination, true);
		});

		it('should handle timeout if configured', async () => {
			const executor = new MiddlewareExecutor({ maxExecutionTime: 100 });

			let timeoutId: number | undefined;
			const slowMiddleware: MiddlewareHandler = async (context, next) => {
				await new Promise(resolve => {
					timeoutId = setTimeout(resolve, 200);
				});
				return await next();
			};

			const result = await executor.execute([slowMiddleware], mockContext);

			// Clean up the timer if it's still running
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}

			assertExists(result.metadata.error);
			assertEquals(result.metadata.error!.message, 'Middleware execution timeout');
		});
	});

	describe('createContext', () => {
		it('should create context from request', () => {
			const request = new Request('https://example.com/test?param=value');
			const context = MiddlewareExecutor.createContext(request);

			assertEquals(context.request, request);
			assertEquals(context.url.href, 'https://example.com/test?param=value');
			assertEquals(context.params, {});
			assertEquals(context.query.param, 'value');
			assertExists(context.state);
			assertEquals(context.locals, {});
		});

		it('should handle requests without query parameters', () => {
			const request = new Request('https://example.com/test');
			const context = MiddlewareExecutor.createContext(request);

			assertEquals(context.query, {});
		});

		it('should handle multiple query parameters', () => {
			const request = new Request('https://example.com/test?param1=value1&param2=value2&param1=value3');
			const context = MiddlewareExecutor.createContext(request);

			assertEquals(context.query.param1, 'value3'); // Last value wins
			assertEquals(context.query.param2, 'value2');
		});
	});

	describe('updateConfig', () => {
		it('should update configuration', () => {
			executor.updateConfig({
				developmentMode: true,
				enableLogging: true,
			});

			const config = executor.getConfig();
			assertEquals(config.developmentMode, true);
			assertEquals(config.enableLogging, true);
			assertEquals(config.maxExecutionTime, 30000); // Should keep existing value
		});
	});

	describe('edge cases', () => {
		it('should handle middleware that does not call next', async () => {
			const middleware: MiddlewareHandler = async (context, next) => {
				return { continue: false };
			};

			const result = await executor.execute([middleware], mockContext);

			assertEquals(result.response, undefined);
			assertEquals(result.metadata.middlewareExecuted, 1);
			assertEquals(result.metadata.earlyTermination, true);
		});

		it('should handle middleware that returns response without calling next', async () => {
			const middleware: MiddlewareHandler = async (context, next) => {
				return {
					response: new Response('Direct response'),
					continue: false,
				};
			};

			const result = await executor.execute([middleware], mockContext);

			assertExists(result.response);
			assertEquals(await result.response!.text(), 'Direct response');
			assertEquals(result.metadata.middlewareExecuted, 1);
			assertEquals(result.metadata.earlyTermination, true);
		});

		it('should handle non-function middleware', async () => {
			// @ts-ignore - intentionally pass invalid middleware
			const invalidMiddleware = 'not a function';

			const result = await executor.execute([invalidMiddleware as any], mockContext);

			assertExists(result.response);
			assertEquals(result.response!.status, 500);
			assertEquals(result.metadata.earlyTermination, true);
		});
	});
});
