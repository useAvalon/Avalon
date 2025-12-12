import { assertEquals, assertInstanceOf } from 'jsr:@std/assert';
import {
	DefaultMiddlewareErrorHandler,
	MiddlewareError,
	MiddlewareErrorType,
	createDefaultErrorHandler,
} from '../middleware/middleware-error-handler.ts';
import type { MiddlewareContext } from '../src/schemas/middleware.ts';

Deno.test('MiddlewareError creates error with correct properties', () => {
	const error = new MiddlewareError('Test error', MiddlewareErrorType.EXECUTION_ERROR, '/path/to/middleware.ts');

	assertEquals(error.message, 'Test error');
	assertEquals(error.type, MiddlewareErrorType.EXECUTION_ERROR);
	assertEquals(error.middlewarePath, '/path/to/middleware.ts');
	assertEquals(error.name, 'MiddlewareError');
	assertInstanceOf(error.timestamp, Date);
});

Deno.test('DefaultMiddlewareErrorHandler handles discovery errors in development mode', () => {
	const logMessages: Array<{ level: string; message: string; data?: unknown }> = [];
	const mockLogger = (level: string, message: string, data?: unknown) => {
		logMessages.push({ level, message, data });
	};

	const errorHandler = new DefaultMiddlewareErrorHandler({
		developmentMode: true,
		enableLogging: true,
		logger: mockLogger,
	});

	const error = new Error('File not found');
	const filePath = '/path/to/middleware.ts';

	let thrownError: Error | undefined;
	try {
		errorHandler.handleDiscoveryError(error, filePath);
	} catch (e) {
		thrownError = e as Error;
	}

	assertInstanceOf(thrownError, MiddlewareError);
	assertEquals(logMessages.length, 1);
	assertEquals(logMessages[0].level, 'error');
	assertEquals(logMessages[0].message, 'Middleware discovery failed');
});

Deno.test('DefaultMiddlewareErrorHandler handles execution errors in development mode', () => {
	const logMessages: Array<{ level: string; message: string; data?: unknown }> = [];
	const mockLogger = (level: string, message: string, data?: unknown) => {
		logMessages.push({ level, message, data });
	};

	const errorHandler = new DefaultMiddlewareErrorHandler({
		developmentMode: true,
		enableLogging: true,
		logger: mockLogger,
	});

	const error = new Error('Runtime error');
	const middleware = 'test-middleware';
	const context: MiddlewareContext = {
		request: new Request('http://localhost/test'),
		url: new URL('http://localhost/test'),
		params: {},
		query: {},
		state: new Map(),
		locals: {},
	};

	const response = errorHandler.handleExecutionError(error, middleware, context);

	assertEquals(response.status, 500);
	assertEquals(response.headers.get('Content-Type'), 'application/json');
	assertEquals(response.headers.get('X-Middleware-Error'), MiddlewareErrorType.EXECUTION_ERROR);
	assertEquals(logMessages.length, 1);
	assertEquals(logMessages[0].level, 'error');
	assertEquals(logMessages[0].message, 'Middleware execution error');
});

Deno.test('DefaultMiddlewareErrorHandler handles discovery errors in production mode', () => {
	const logMessages: Array<{ level: string; message: string; data?: unknown }> = [];
	const mockLogger = (level: string, message: string, data?: unknown) => {
		logMessages.push({ level, message, data });
	};

	const errorHandler = new DefaultMiddlewareErrorHandler({
		developmentMode: false,
		enableLogging: true,
		logger: mockLogger,
	});

	const error = new Error('File not found');
	const filePath = '/path/to/middleware.ts';

	// Should not throw in production mode
	let thrownError: Error | undefined;
	try {
		errorHandler.handleDiscoveryError(error, filePath);
	} catch (e) {
		thrownError = e as Error;
	}

	assertEquals(thrownError, undefined);
	assertEquals(logMessages.length, 2); // Error log + warning log
	assertEquals(logMessages[0].level, 'error');
	assertEquals(logMessages[0].message, 'Middleware discovery failed');
	assertEquals(logMessages[1].level, 'warn');
	assertEquals(logMessages[1].message, 'Skipping middleware due to discovery error');
});

Deno.test('DefaultMiddlewareErrorHandler returns simple response in production mode', async () => {
	const errorHandler = new DefaultMiddlewareErrorHandler({
		developmentMode: false,
		enableLogging: false,
	});

	const error = new Error('Test error');
	const middleware = 'test-middleware';
	const context: MiddlewareContext = {
		request: new Request('http://localhost/test'),
		url: new URL('http://localhost/test'),
		params: {},
		query: {},
		state: new Map(),
		locals: {},
	};

	const response = errorHandler.handleExecutionError(error, middleware, context);
	const responseText = await response.text();

	assertEquals(responseText, 'Internal Server Error');
	assertEquals(response.status, 500);
});

Deno.test('createDefaultErrorHandler creates handler instance', () => {
	const handler = createDefaultErrorHandler(true);
	assertInstanceOf(handler, DefaultMiddlewareErrorHandler);
});
