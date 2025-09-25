/**
 * Integration tests for comprehensive error handling and debugging features
 */

import { assertEquals, assertExists, assertStringIncludes, assertThrows } from '@std/assert';
import { RouteDiscovery } from '../route-discovery.ts';
import { PageLoader } from '../page-loader.ts';
import { FileSystemRouter } from '../file-system-router.ts';
import { RoutingErrorCode, ErrorSeverity } from '../error-handler.ts';

// Test fixtures directory
const TEST_FIXTURES_DIR = 'src/core/routing/tests/fixtures/error-handling';

Deno.test('Error Handling Integration - Route Discovery with Conflicts', async () => {
	// Create test files that will cause conflicts
	await Deno.mkdir(`${TEST_FIXTURES_DIR}/pages`, { recursive: true });

	// Create conflicting routes
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/pages/test.tsx`,
		`export default function TestPage() { return <div>Test</div>; }`
	);
	await Deno.mkdir(`${TEST_FIXTURES_DIR}/pages/test`, { recursive: true });
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/pages/test/index.tsx`,
		`export default function TestIndexPage() { return <div>Test Index</div>; }`
	);

	try {
		const routeDiscovery = new RouteDiscovery({
			pagesDirectory: `${TEST_FIXTURES_DIR}/pages`,
			developmentMode: true,
		});

		const pageFiles = await routeDiscovery.scanPagesDirectory();
		const routes = routeDiscovery.createRoutes(pageFiles);

		// Should have resolved the conflict but logged warnings
		const errorHandler = routeDiscovery.getErrorHandler();
		const warnings = errorHandler.getWarnings();

		assertEquals(routes.length, 1); // One route should win
		assertEquals(warnings.length > 0, true); // Should have warnings about conflict

		const conflictWarning = warnings.find(w => w.code === RoutingErrorCode.ROUTE_CONFLICT);
		assertExists(conflictWarning);
		assertStringIncludes(conflictWarning.message, 'Route conflict');
	} finally {
		// Clean up test files
		await Deno.remove(TEST_FIXTURES_DIR, { recursive: true }).catch(() => {});
	}
});

Deno.test('Error Handling Integration - Invalid Page Module', async () => {
	await Deno.mkdir(`${TEST_FIXTURES_DIR}/pages`, { recursive: true });

	// Create a page with invalid exports
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/pages/invalid.tsx`,
		`// Missing default export
		export const notDefault = () => <div>Invalid</div>;`
	);

	try {
		const pageLoader = new PageLoader({
			baseDirectory: `${TEST_FIXTURES_DIR}/pages`,
			developmentMode: false, // Don't throw in tests
		});

		// Should throw validation error
		await assertThrows(
			async () => {
				await pageLoader.loadPageModule(`${TEST_FIXTURES_DIR}/pages/invalid.tsx`);
			},
			Error,
			'Missing required default export'
		);

		// Check that error was logged
		const errorHandler = pageLoader.getErrorHandler();
		const errors = errorHandler.getErrors();
		assertEquals(errors.length > 0, true);

		const validationError = errors.find(e => e.code === RoutingErrorCode.INVALID_FILE_STRUCTURE);
		assertExists(validationError);
		assertExists(validationError.suggestions);
	} finally {
		await Deno.remove(TEST_FIXTURES_DIR, { recursive: true }).catch(() => {});
	}
});

Deno.test('Error Handling Integration - Syntax Error in Page', async () => {
	await Deno.mkdir(`${TEST_FIXTURES_DIR}/pages`, { recursive: true });

	// Create a page with syntax errors
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/pages/broken.tsx`,
		`export default function BrokenPage() {
			return <div>Broken { // Unclosed JSX
		}`
	);

	try {
		const pageLoader = new PageLoader({
			baseDirectory: `${TEST_FIXTURES_DIR}/pages`,
			developmentMode: false, // Don't throw in tests
		});

		// Should throw syntax error
		await assertThrows(async () => {
			await pageLoader.loadPageModule(`${TEST_FIXTURES_DIR}/pages/broken.tsx`);
		}, Error);

		// Check that syntax error was logged
		const errorHandler = pageLoader.getErrorHandler();
		const errors = errorHandler.getErrors();
		assertEquals(errors.length > 0, true);

		const syntaxError = errors.find(e => e.code === RoutingErrorCode.SYNTAX_ERROR);
		assertExists(syntaxError);
		assertExists(syntaxError.originalError);
		assertExists(syntaxError.suggestions);
	} finally {
		await Deno.remove(TEST_FIXTURES_DIR, { recursive: true }).catch(() => {});
	}
});

Deno.test('Error Handling Integration - API Route Conflicts', async () => {
	await Deno.mkdir(`${TEST_FIXTURES_DIR}/api`, { recursive: true });

	// Create conflicting API routes
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/api/users.ts`,
		`export function GET() { return new Response('Users GET'); }
		 export function POST() { return new Response('Users POST'); }`
	);
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/api/users/index.ts`,
		`export function GET() { return new Response('Users Index GET'); }
		 export function DELETE() { return new Response('Users DELETE'); }`
	);

	try {
		const routeDiscovery = new RouteDiscovery({
			pagesDirectory: `${TEST_FIXTURES_DIR}/pages`,
			apiDirectory: `${TEST_FIXTURES_DIR}/api`,
			developmentMode: true,
		});

		const apiFiles = await routeDiscovery.scanApiDirectory();
		const apiRoutes = await routeDiscovery.createApiRoutes(apiFiles);

		// Should have resolved the conflict but logged warnings
		const errorHandler = routeDiscovery.getErrorHandler();
		const warnings = errorHandler.getWarnings();

		assertEquals(apiRoutes.length, 1); // One route should win
		assertEquals(warnings.length > 0, true); // Should have warnings about conflict

		const conflictWarning = warnings.find(w => w.code === RoutingErrorCode.API_ROUTE_CONFLICT);
		assertExists(conflictWarning);
		assertStringIncludes(conflictWarning.message, 'API route conflict');
	} finally {
		await Deno.remove(TEST_FIXTURES_DIR, { recursive: true }).catch(() => {});
	}
});

Deno.test('Error Handling Integration - Invalid Dynamic Route Syntax', async () => {
	await Deno.mkdir(`${TEST_FIXTURES_DIR}/pages`, { recursive: true });

	// Create a page with invalid dynamic route syntax
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/pages/[unclosed.tsx`,
		`export default function UnclosedPage() { return <div>Unclosed</div>; }`
	);

	try {
		const routeDiscovery = new RouteDiscovery({
			pagesDirectory: `${TEST_FIXTURES_DIR}/pages`,
			developmentMode: true,
		});

		const pageFiles = await routeDiscovery.scanPagesDirectory();

		// Should throw error for invalid route pattern
		assertThrows(() => {
			routeDiscovery.createRoutes(pageFiles);
		}, Error);

		// Check that error was logged
		const errorHandler = routeDiscovery.getErrorHandler();
		const errors = errorHandler.getErrors();
		assertEquals(errors.length > 0, true);

		const structureError = errors.find(e => e.code === RoutingErrorCode.INVALID_FILE_STRUCTURE);
		assertExists(structureError);
		assertStringIncludes(structureError.message, 'Malformed dynamic segments');
	} finally {
		await Deno.remove(TEST_FIXTURES_DIR, { recursive: true }).catch(() => {});
	}
});

Deno.test('Error Handling Integration - FileSystemRouter Error Summary', async () => {
	await Deno.mkdir(`${TEST_FIXTURES_DIR}/pages`, { recursive: true });

	// Create various problematic files
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/pages/conflict1.tsx`,
		`export default function Conflict1() { return <div>Conflict 1</div>; }`
	);
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/pages/conflict2.tsx`,
		`export default function Conflict2() { return <div>Conflict 2</div>; }`
	);
	await Deno.writeTextFile(`${TEST_FIXTURES_DIR}/pages/invalid.tsx`, `// Missing default export`);

	try {
		const fileSystemRouter = new FileSystemRouter({
			discovery: {
				pagesDirectory: `${TEST_FIXTURES_DIR}/pages`,
				developmentMode: false, // Don't throw errors
			},
		});

		// This should collect various errors and warnings
		await fileSystemRouter.discoverRoutes();

		// Get comprehensive error summary
		const summary = fileSystemRouter.getErrorSummary();

		assertExists(summary);
		assertStringIncludes(summary, 'File-System Routing Summary');

		// Should contain information about errors found
		if (summary.includes('error(s)')) {
			assertStringIncludes(summary, '❌ Errors:');
		}

		if (summary.includes('warning(s)')) {
			assertStringIncludes(summary, '⚠️  Warnings:');
		}
	} finally {
		await Deno.remove(TEST_FIXTURES_DIR, { recursive: true }).catch(() => {});
	}
});

Deno.test('Error Handling Integration - Debug Logging in Development Mode', async () => {
	await Deno.mkdir(`${TEST_FIXTURES_DIR}/pages`, { recursive: true });

	// Create some valid routes
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/pages/index.tsx`,
		`export default function HomePage() { return <div>Home</div>; }`
	);
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/pages/about.tsx`,
		`export default function AboutPage() { return <div>About</div>; }`
	);
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/pages/users/[id].tsx`,
		`export default function UserPage() { return <div>User</div>; }`
	);

	// Capture console output
	let loggedMessages: string[] = [];
	const originalLog = console.log;
	console.log = (...args) => {
		loggedMessages.push(args.join(' '));
	};

	try {
		const routeDiscovery = new RouteDiscovery({
			pagesDirectory: `${TEST_FIXTURES_DIR}/pages`,
			developmentMode: true, // Enable debug logging
		});

		const pageFiles = await routeDiscovery.scanPagesDirectory();
		const routes = routeDiscovery.createRoutes(pageFiles);

		// Should have logged debug information
		assertEquals(routes.length, 3);
		assertEquals(loggedMessages.length > 0, true);

		const allMessages = loggedMessages.join(' ');
		assertStringIncludes(allMessages, 'Scanned pages directory');
		assertStringIncludes(allMessages, 'Creating routes');
		assertStringIncludes(allMessages, 'Created');
		assertStringIncludes(allMessages, 'Route Discovery Debug');
	} finally {
		console.log = originalLog;
		await Deno.remove(TEST_FIXTURES_DIR, { recursive: true }).catch(() => {});
	}
});

Deno.test('Error Handling Integration - Missing Route Parameters', async () => {
	await Deno.mkdir(`${TEST_FIXTURES_DIR}/pages`, { recursive: true });

	// Create a dynamic route
	await Deno.writeTextFile(
		`${TEST_FIXTURES_DIR}/pages/users/[id]/posts/[postId].tsx`,
		`export default function UserPostPage() { return <div>User Post</div>; }`
	);

	try {
		const fileSystemRouter = new FileSystemRouter({
			discovery: {
				pagesDirectory: `${TEST_FIXTURES_DIR}/pages`,
				developmentMode: false, // Don't throw
			},
		});

		const routes = await fileSystemRouter.discoverRoutes();
		assertEquals(routes.length, 1);

		const route = routes[0];
		assertEquals(route.dynamicSegments.length, 2);
		assertEquals(route.dynamicSegments.includes('id'), true);
		assertEquals(route.dynamicSegments.includes('postId'), true);

		// Test parameter extraction with missing parameters
		// This would normally be called during request handling
		const mockRequest = new Request('http://localhost/users/123/posts');
		const url = new URL(mockRequest.url);

		// The extractRouteParams method is private, but we can test the error handling
		// by checking that the error handler collected missing parameter errors
		const errorHandler = fileSystemRouter.getErrorHandler();

		// In a real scenario, missing parameters would be detected during route matching
		// For this test, we'll simulate the error
		const paramError = errorHandler.createMissingRouteParamError(url.pathname, 'postId', ['id']);

		assertEquals(paramError.code, RoutingErrorCode.MISSING_ROUTE_PARAM);
		assertStringIncludes(paramError.message, 'postId');
		assertExists(paramError.suggestions);
	} finally {
		await Deno.remove(TEST_FIXTURES_DIR, { recursive: true }).catch(() => {});
	}
});
