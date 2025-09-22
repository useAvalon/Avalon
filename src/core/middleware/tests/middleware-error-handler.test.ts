import { assertEquals, assertExists, assertRejects, assertInstanceOf } from 'jsr:@std/assert';
import {
	DefaultMiddlewareErrorHandler,
	MiddlewareError,
	MiddlewareErrorType,
	createDefaultErrorHandler,
	withErrorHandling,
} from '../middleware-error-handler.ts';
import type { MiddlewareContext, MiddlewareChain } from '../../../schemas/middleware.ts';

// Test MiddlewareError class
Deno.test('MiddlewareError - should create error with correct properties', () => {
	const error = new MiddlewareError('Test error', MiddlewareErrorType.EXECUTION_ERROR, '/path/to/middleware.ts');

	assertEquals(error.message, 'Test error');
	assertEquals(error.type, MiddlewareErrorType.EXECUTION_ERROR);
	assertEquals(error.middlewarePath, '/path/to/middleware.ts');
	assertEquals(error.name, 'MiddlewareError');
	assertInstanceOf(error.timestamp, Date);
});

Deno.test('MiddlewareError - should include context when provided', () => {
	const context: MiddlewareContext = {
		request: new Request('http://localhost/test'),
		url: new URL('http://localhost/test'),
		params: { id: '123' },
		query: { filter: 'active' },
		state: new Map(),
		locals: {},
	};

	const error = new MiddlewareError(
		'Test error',
		MiddlewareErrorType.EXECUTION_ERROR,
		'/path/to/middleware.ts',
		context
	);

	assertEquals(error.context, context);
});

// Test DefaultMiddlewareErrorHandler in development mode
Deno.test('DefaultMiddlewareErrorHandler - should handle discovery errors by throwing in development mode', () => {
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

Deno.test(
	'DefaultMiddlewareErrorHandler - should handle execution errors with detailed response in development mode',
	() => {
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
	}
);

// Test DefaultMiddlewareErrorHandler in production mode
Deno.test(
	'DefaultMiddlewareErrorHandler - should handle discovery errors by logging warning in production mode',
	() => {
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
	}
);

Deno.test('DefaultMiddlewareErrorHandler - should return generic error response in production mode', async () => {
	const logMessages: Array<{ level: string; message: string; data?: unknown }> = [];
	const mockLogger = (level: string, message: string, data?: unknown) => {
		logMessages.push({ level, message, data });
	};

	const errorHandler = new DefaultMiddlewareErrorHandler({
		developmentMode: false,
		enableLogging: true,
		logger: mockLogger,
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
});

// Test createDefaultErrorHandler
Deno.test('createDefaultErrorHandler - should create handler with development mode enabled', () => {
	const handler = createDefaultErrorHandler(true);
	assertInstanceOf(handler, DefaultMiddlewareErrorHandler);
});

// Test withErrorHandling
Deno.test('withErrorHandling - should return result when operation succeeds', async () => {
	const mockErrorHandler = {
		handleDiscoveryError: () => {},
		handleExecutionError: () => new Response('Error', { status: 500 }),
		handleChainError: () => new Response('Error', { status: 500 }),
	};

	const operation = () => Promise.resolve('success');
	const result = await withErrorHandling(operation, mockErrorHandler, 'test-middleware');

	assertEquals(result, 'success');
});

Deno.test('withErrorHandling - should handle execution errors with context', async () => {
	const mockErrorHandler = {
		handleDiscoveryError: () => {},
		handleExecutionError: () => new Response('Error', { status: 500 }),
		handleChainError: () => new Response('Error', { status: 500 }),
	};

	const error = new Error('Test error');
	const operation = () => Promise.reject(error);
	const context: MiddlewareContext = {
		request: new Request('http://localhost/test'),
		url: new URL('http://localhost/test'),
		params: {},
		query: {},
		state: new Map(),
		locals: {},
	};

	const result = await withErrorHandling(operation, mockErrorHandler, 'test-middleware', context);

	assertInstanceOf(result, Response);
});

// Simple test to verify the file is being read
Deno.test('Error handler file test', () => {
	assertEquals(1 + 1, 2);
});
