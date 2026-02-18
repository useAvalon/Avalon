import { describe, it, expect } from 'vitest';
import {
	DefaultMiddlewareErrorHandler,
	MiddlewareError,
	MiddlewareErrorType,
	createDefaultErrorHandler,
} from '../middleware/middleware-error-handler.ts';
import type { MiddlewareContext } from '../src/schemas/middleware.ts';

describe('MiddlewareError', () => {
	it('creates error with correct properties', () => {
		const error = new MiddlewareError('Test error', MiddlewareErrorType.EXECUTION_ERROR, '/path/to/middleware.ts');
		expect(error.message).toEqual('Test error');
		expect(error.type).toEqual(MiddlewareErrorType.EXECUTION_ERROR);
		expect(error.middlewarePath).toEqual('/path/to/middleware.ts');
		expect(error.name).toEqual('MiddlewareError');
		expect(error.timestamp).toBeInstanceOf(Date);
	});
});

describe('DefaultMiddlewareErrorHandler - development mode', () => {
	it('handles discovery errors', () => {
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

		expect(thrownError).toBeInstanceOf(MiddlewareError);
		expect(logMessages.length).toEqual(1);
		expect(logMessages[0].level).toEqual('error');
		expect(logMessages[0].message).toEqual('Middleware discovery failed');
	});

	it('handles execution errors', () => {
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

		expect(response.status).toEqual(500);
		expect(response.headers.get('Content-Type')).toEqual('application/json');
		expect(response.headers.get('X-Middleware-Error')).toEqual(MiddlewareErrorType.EXECUTION_ERROR);
		expect(logMessages.length).toEqual(1);
		expect(logMessages[0].level).toEqual('error');
		expect(logMessages[0].message).toEqual('Middleware execution error');
	});
});

describe('DefaultMiddlewareErrorHandler - production mode', () => {
	it('handles discovery errors without throwing', () => {
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

		let thrownError: Error | undefined;
		try {
			errorHandler.handleDiscoveryError(error, filePath);
		} catch (e) {
			thrownError = e as Error;
		}

		expect(thrownError).toEqual(undefined);
		expect(logMessages.length).toEqual(2);
		expect(logMessages[0].level).toEqual('error');
		expect(logMessages[0].message).toEqual('Middleware discovery failed');
		expect(logMessages[1].level).toEqual('warn');
		expect(logMessages[1].message).toEqual('Skipping middleware due to discovery error');
	});

	it('returns simple response', async () => {
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

		expect(responseText).toEqual('Internal Server Error');
		expect(response.status).toEqual(500);
	});
});

describe('createDefaultErrorHandler', () => {
	it('creates handler instance', () => {
		const handler = createDefaultErrorHandler(true);
		expect(handler).toBeInstanceOf(DefaultMiddlewareErrorHandler);
	});
});
