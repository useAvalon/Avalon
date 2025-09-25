/**
 * Tests for the RoutingErrorHandler
 */

import { assertEquals, assertExists, assertStringIncludes } from '@std/assert';
import {
	RoutingErrorHandler,
	RoutingErrorCode,
	ErrorSeverity,
	createRoutingErrorHandler,
	type RoutingError,
} from '../error-handler.ts';
import type { FileSystemRoute, FileSystemApiRoute } from '../../../schemas/routing.ts';

Deno.test('RoutingErrorHandler - Route Conflict Error', () => {
	const errorHandler = createRoutingErrorHandler({
		developmentMode: false, // Don't throw in tests
		enableDebugLogging: false,
	});

	const conflictingRoutes: FileSystemRoute[] = [
		{
			pattern: new URLPattern({ pathname: '/test' }),
			filePath: 'src/pages/test.tsx',
			routeType: 'static',
			dynamicSegments: [],
			priority: 0,
			isPrivate: false,
		},
		{
			pattern: new URLPattern({ pathname: '/test' }),
			filePath: 'src/pages/test/index.tsx',
			routeType: 'index',
			dynamicSegments: [],
			priority: 10,
			isPrivate: false,
		},
	];

	const error = errorHandler.createRouteConflictError(conflictingRoutes, '/test');

	assertEquals(error.code, RoutingErrorCode.ROUTE_CONFLICT);
	assertEquals(error.severity, ErrorSeverity.ERROR);
	assertStringIncludes(error.message, 'Route conflict detected');
	assertStringIncludes(error.message, '/test');
	assertExists(error.details);
	assertExists(error.suggestions);
	assertEquals(error.relatedFiles?.length, 2);
});

Deno.test('RoutingErrorHandler - API Route Conflict Error', () => {
	const errorHandler = createRoutingErrorHandler({
		developmentMode: false,
		enableDebugLogging: false,
	});

	const conflictingRoutes: FileSystemApiRoute[] = [
		{
			pattern: new URLPattern({ pathname: '/api/users' }),
			filePath: 'src/api/users.ts',
			methods: ['GET', 'POST'],
			priority: 1000,
			dynamicSegments: [],
		},
		{
			pattern: new URLPattern({ pathname: '/api/users' }),
			filePath: 'src/api/users/index.ts',
			methods: ['GET', 'DELETE'],
			priority: 1010,
			dynamicSegments: [],
		},
	];

	const error = errorHandler.createApiRouteConflictError(conflictingRoutes, '/api/users', ['GET']);

	assertEquals(error.code, RoutingErrorCode.API_ROUTE_CONFLICT);
	assertEquals(error.severity, ErrorSeverity.ERROR);
	assertStringIncludes(error.message, 'API route conflict');
	assertStringIncludes(error.message, '/api/users');
	assertStringIncludes(error.message, 'GET');
	assertExists(error.details);
	assertExists(error.suggestions);
});

Deno.test('RoutingErrorHandler - Invalid File Structure Error', () => {
	const errorHandler = createRoutingErrorHandler({
		developmentMode: false,
		enableDebugLogging: false,
	});

	const originalError = new Error('Syntax error: Unexpected token');
	const error = errorHandler.createInvalidFileStructureError(
		'src/pages/broken.tsx',
		'File contains syntax errors',
		originalError
	);

	assertEquals(error.code, RoutingErrorCode.INVALID_FILE_STRUCTURE);
	assertEquals(error.severity, ErrorSeverity.ERROR);
	assertStringIncludes(error.message, 'Invalid file structure');
	assertEquals(error.filePath, 'src/pages/broken.tsx');
	assertEquals(error.originalError, originalError);
	assertExists(error.details);
	assertExists(error.suggestions);
});

Deno.test('RoutingErrorHandler - Missing Route Parameter Error', () => {
	const errorHandler = createRoutingErrorHandler({
		developmentMode: false,
		enableDebugLogging: false,
	});

	const error = errorHandler.createMissingRouteParamError('/users/123/posts', 'userId', ['postId']);

	assertEquals(error.code, RoutingErrorCode.MISSING_ROUTE_PARAM);
	assertEquals(error.severity, ErrorSeverity.ERROR);
	assertStringIncludes(error.message, 'Missing required route parameter');
	assertStringIncludes(error.message, 'userId');
	assertExists(error.details);
	assertExists(error.suggestions);
	assertEquals(error.context?.paramName, 'userId');
	assertEquals(error.context?.availableParams, ['postId']);
});

Deno.test('RoutingErrorHandler - Syntax Error', () => {
	const errorHandler = createRoutingErrorHandler({
		developmentMode: false,
		enableDebugLogging: false,
	});

	const originalError = new SyntaxError('Unexpected token }');
	const error = errorHandler.createSyntaxError('src/pages/_layout.tsx', 'layout', originalError);

	assertEquals(error.code, RoutingErrorCode.SYNTAX_ERROR);
	assertEquals(error.severity, ErrorSeverity.ERROR);
	assertStringIncludes(error.message, 'Syntax error in layout file');
	assertEquals(error.filePath, 'src/pages/_layout.tsx');
	assertEquals(error.originalError, originalError);
	assertExists(error.details);
	assertExists(error.suggestions);
});

Deno.test('RoutingErrorHandler - Development Warning', () => {
	const errorHandler = createRoutingErrorHandler({
		developmentMode: true,
		enableDebugLogging: false,
	});

	const warning = errorHandler.createDevelopmentWarning('This is a development warning', 'src/pages/test.tsx', [
		'Consider doing this instead',
	]);

	assertEquals(warning.severity, ErrorSeverity.WARNING);
	assertStringIncludes(warning.message, 'development warning');
	assertEquals(warning.filePath, 'src/pages/test.tsx');
	assertEquals(warning.suggestions?.[0], 'Consider doing this instead');
});

Deno.test('RoutingErrorHandler - Error Collection and Summary', () => {
	const errorHandler = createRoutingErrorHandler({
		developmentMode: false, // Don't throw
		enableDebugLogging: false,
	});

	// Add some errors and warnings
	const error1 = errorHandler.createInvalidFileStructureError('src/pages/broken1.tsx', 'Syntax error');
	const error2 = errorHandler.createInvalidFileStructureError('src/pages/broken2.tsx', 'Missing export');
	const warning1 = errorHandler.createDevelopmentWarning('This is a warning', 'src/pages/test.tsx');

	errorHandler.handleError(error1);
	errorHandler.handleError(error2);
	errorHandler.handleError(warning1);

	// Check error collection
	const errors = errorHandler.getErrors();
	const warnings = errorHandler.getWarnings();

	assertEquals(errors.length, 2);
	assertEquals(warnings.length, 1);
	assertEquals(errorHandler.hasErrors(), true);
	assertEquals(errorHandler.hasWarnings(), true);

	// Check summary
	const summary = errorHandler.createSummary();
	assertStringIncludes(summary, '2 error(s)');
	assertStringIncludes(summary, '1 warning(s)');
	assertStringIncludes(summary, 'broken1.tsx');
	assertStringIncludes(summary, 'broken2.tsx');
	assertStringIncludes(summary, 'test.tsx');

	// Clear and check
	errorHandler.clear();
	assertEquals(errorHandler.getErrors().length, 0);
	assertEquals(errorHandler.getWarnings().length, 0);
	assertEquals(errorHandler.hasErrors(), false);
	assertEquals(errorHandler.hasWarnings(), false);
});

Deno.test('RoutingErrorHandler - Debug Logging', () => {
	let loggedMessages: string[] = [];
	const mockLogger = (level: string, message: string) => {
		loggedMessages.push(`[${level}] ${message}`);
	};

	const errorHandler = createRoutingErrorHandler({
		developmentMode: true,
		enableDebugLogging: true,
		logger: mockLogger,
	});

	const debugInfo = {
		totalRoutes: 5,
		routesByType: { static: 3, dynamic: 2 },
		conflicts: [],
		warnings: [],
		discoveryTime: 123.45,
		filesScanTime: 67.89,
		validationTime: 55.56,
	};

	errorHandler.logRouteDiscoveryDebug(debugInfo);

	// Check that debug messages were logged
	assertEquals(loggedMessages.length > 0, true);
	const allMessages = loggedMessages.join(' ');
	assertStringIncludes(allMessages, 'Route Discovery Debug');
	assertStringIncludes(allMessages, '5');
	assertStringIncludes(allMessages, '123.45ms');
});

Deno.test('RoutingErrorHandler - Route Details Logging', () => {
	let loggedMessages: string[] = [];
	const mockLogger = (level: string, message: string) => {
		loggedMessages.push(`[${level}] ${message}`);
	};

	const errorHandler = createRoutingErrorHandler({
		developmentMode: true,
		enableDebugLogging: true,
		logger: mockLogger,
	});

	const routes: FileSystemRoute[] = [
		{
			pattern: new URLPattern({ pathname: '/test' }),
			filePath: 'src/pages/test.tsx',
			routeType: 'static',
			dynamicSegments: [],
			priority: 0,
			isPrivate: false,
		},
		{
			pattern: new URLPattern({ pathname: '/users/:id' }),
			filePath: 'src/pages/users/[id].tsx',
			routeType: 'dynamic',
			dynamicSegments: ['id'],
			priority: 100,
			isPrivate: false,
		},
	];

	errorHandler.logRouteDetails(routes);

	// Check that route details were logged
	assertEquals(loggedMessages.length > 0, true);
	const allMessages = loggedMessages.join(' ');
	assertStringIncludes(allMessages, 'Discovered Routes');
	assertStringIncludes(allMessages, '/test');
	assertStringIncludes(allMessages, '/users/:id');
	assertStringIncludes(allMessages, 'STATIC routes');
	assertStringIncludes(allMessages, 'DYNAMIC routes');
});

Deno.test('RoutingErrorHandler - API Route Details Logging', () => {
	let loggedMessages: string[] = [];
	const mockLogger = (level: string, message: string) => {
		loggedMessages.push(`[${level}] ${message}`);
	};

	const errorHandler = createRoutingErrorHandler({
		developmentMode: true,
		enableDebugLogging: true,
		logger: mockLogger,
	});

	const apiRoutes: FileSystemApiRoute[] = [
		{
			pattern: new URLPattern({ pathname: '/api/users' }),
			filePath: 'src/api/users.ts',
			methods: ['GET', 'POST'],
			priority: 1000,
			dynamicSegments: [],
		},
		{
			pattern: new URLPattern({ pathname: '/api/users/:id' }),
			filePath: 'src/api/users/[id].ts',
			methods: ['GET', 'PUT', 'DELETE'],
			priority: 1100,
			dynamicSegments: ['id'],
		},
	];

	errorHandler.logApiRouteDetails(apiRoutes);

	// Check that API route details were logged
	assertEquals(loggedMessages.length > 0, true);
	const allMessages = loggedMessages.join(' ');
	assertStringIncludes(allMessages, 'Discovered API Routes');
	assertStringIncludes(allMessages, '[GET, POST]');
	assertStringIncludes(allMessages, '[GET, PUT, DELETE]');
	assertStringIncludes(allMessages, '/api/users');
});

Deno.test('RoutingErrorHandler - Error Suggestions Generation', () => {
	const errorHandler = createRoutingErrorHandler({
		developmentMode: false,
		enableSuggestions: true,
	});

	// Test route conflict suggestions
	const conflictingRoutes: FileSystemRoute[] = [
		{
			pattern: new URLPattern({ pathname: '/test' }),
			filePath: 'src/pages/test.tsx',
			routeType: 'static',
			dynamicSegments: [],
			priority: 0,
			isPrivate: false,
		},
		{
			pattern: new URLPattern({ pathname: '/test' }),
			filePath: 'src/pages/blog/test.tsx',
			routeType: 'static',
			dynamicSegments: [],
			priority: 0,
			isPrivate: false,
		},
	];

	const conflictError = errorHandler.createRouteConflictError(conflictingRoutes, '/test');
	assertExists(conflictError.suggestions);
	assertEquals(conflictError.suggestions!.length > 0, true);

	// Test missing parameter suggestions
	const paramError = errorHandler.createMissingRouteParamError('/users/123', 'id', ['userId']);
	assertExists(paramError.suggestions);
	assertEquals(paramError.suggestions!.length > 0, true);
	assertStringIncludes(paramError.suggestions![0], 'id');

	// Test syntax error suggestions
	const syntaxError = errorHandler.createSyntaxError('src/pages/_layout.tsx', 'layout', new Error('Unexpected token'));
	assertExists(syntaxError.suggestions);
	assertEquals(syntaxError.suggestions!.length > 0, true);
});
