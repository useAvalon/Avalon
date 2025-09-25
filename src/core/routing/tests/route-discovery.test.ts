/**
 * Tests for RouteDiscovery class
 */

import { assertEquals, assert } from '@std/assert';
import { join } from '@std/path';
import { RouteDiscovery } from '../route-discovery.ts';
import type { RouteType } from '../../../schemas/routing.ts';

Deno.test('RouteDiscovery - createRoutePattern', () => {
	const discovery = new RouteDiscovery();

	// Test static route
	const staticPattern = discovery.createRoutePattern('about.tsx');
	assertEquals(staticPattern.pathname, '/about');

	// Test index route
	const indexPattern = discovery.createRoutePattern('index.tsx');
	assertEquals(indexPattern.pathname, '/');

	// Test nested route
	const nestedPattern = discovery.createRoutePattern('blog/post.tsx');
	assertEquals(nestedPattern.pathname, '/blog/post');

	// Test dynamic route
	const dynamicPattern = discovery.createRoutePattern('blog/[slug].tsx');
	assertEquals(dynamicPattern.pathname, '/blog/:slug');

	// Test catch-all route
	const catchAllPattern = discovery.createRoutePattern('[...rest].tsx');
	assertEquals(catchAllPattern.pathname, '/*');
});

Deno.test('RouteDiscovery - determineRouteType', () => {
	const discovery = new RouteDiscovery();

	// Test static route
	assertEquals(discovery.determineRouteType('about.tsx'), 'static');

	// Test index route
	assertEquals(discovery.determineRouteType('index.tsx'), 'index');
	assertEquals(discovery.determineRouteType('blog/index.tsx'), 'index');

	// Test dynamic route
	assertEquals(discovery.determineRouteType('blog/[slug].tsx'), 'dynamic');
	assertEquals(discovery.determineRouteType('users/[id]/profile.tsx'), 'dynamic');

	// Test catch-all route
	assertEquals(discovery.determineRouteType('[...rest].tsx'), 'catch-all');
	assertEquals(discovery.determineRouteType('docs/[...path].tsx'), 'catch-all');

	// Test route group
	assertEquals(discovery.determineRouteType('(auth)/login.tsx'), 'group');
});

Deno.test('RouteDiscovery - extractDynamicSegments', () => {
	const discovery = new RouteDiscovery();

	// Test static route (no segments)
	assertEquals(discovery.extractDynamicSegments('about.tsx'), []);

	// Test single dynamic segment
	assertEquals(discovery.extractDynamicSegments('blog/[slug].tsx'), ['slug']);

	// Test multiple dynamic segments
	assertEquals(discovery.extractDynamicSegments('users/[id]/posts/[postId].tsx'), ['id', 'postId']);

	// Test catch-all segment
	assertEquals(discovery.extractDynamicSegments('[...rest].tsx'), ['rest']);
	assertEquals(discovery.extractDynamicSegments('docs/[...path].tsx'), ['path']);

	// Test mixed segments
	assertEquals(discovery.extractDynamicSegments('api/[version]/users/[...rest].tsx'), ['version', 'rest']);
});

Deno.test('RouteDiscovery - private file detection', async () => {
	// Create a temporary test directory structure
	const tempDir = await Deno.makeTempDir({ prefix: 'route_discovery_test_' });

	try {
		// Create test files
		const testFiles = [
			'index.tsx',
			'about.tsx',
			'_components/Button.tsx',
			'_utils/helpers.ts',
			'blog/index.tsx',
			'blog/[slug].tsx',
			'(auth)/login.tsx',
			'(auth)/_middleware.ts',
		];

		for (const file of testFiles) {
			const filePath = join(tempDir, file);
			await Deno.mkdir(join(filePath, '..'), { recursive: true });
			await Deno.writeTextFile(filePath, `export default function Component() { return null; }`);
		}

		const discovery = new RouteDiscovery({ pagesDirectory: tempDir });
		const pageFiles = await discovery.scanPagesDirectory();

		// Should find all files
		assertEquals(pageFiles.length, testFiles.length);

		// Check private file detection
		const privateFiles = pageFiles.filter(f => f.isPrivate);
		const publicFiles = pageFiles.filter(f => !f.isPrivate);

		// Files in _components and _utils should be private
		// _middleware.ts should also be private
		assertEquals(privateFiles.length, 3);
		assertEquals(publicFiles.length, 5);

		// Check route group detection
		const groupFiles = pageFiles.filter(f => f.routeGroup);
		assertEquals(groupFiles.length, 2);
		assertEquals(groupFiles[0].routeGroup, 'auth');
	} finally {
		// Clean up
		await Deno.remove(tempDir, { recursive: true });
	}
});

Deno.test('RouteDiscovery - route creation and priority', async () => {
	// Create a temporary test directory structure
	const tempDir = await Deno.makeTempDir({ prefix: 'route_priority_test_' });

	try {
		// Create test files with different priorities
		const testFiles = [
			'index.tsx', // index route - priority 10
			'about.tsx', // static route - priority 0
			'blog/index.tsx', // nested index - priority 10
			'blog/[slug].tsx', // dynamic route - priority 100
			'[...rest].tsx', // catch-all - priority 200
		];

		for (const file of testFiles) {
			const filePath = join(tempDir, file);
			await Deno.mkdir(join(filePath, '..'), { recursive: true });
			await Deno.writeTextFile(filePath, `export default function Component() { return null; }`);
		}

		const discovery = new RouteDiscovery({ pagesDirectory: tempDir });
		const pageFiles = await discovery.scanPagesDirectory();
		const routes = await discovery.createRoutes(pageFiles);

		// Should create routes for all non-private files
		assertEquals(routes.length, 5);

		// Routes should be sorted by priority (lower = higher priority)
		assert(routes[0].priority <= routes[1].priority);
		assert(routes[1].priority <= routes[2].priority);
		assert(routes[2].priority <= routes[3].priority);
		assert(routes[3].priority <= routes[4].priority);

		// Check route types
		const routeTypes = routes.map(r => r.routeType);
		assert(routeTypes.includes('static'));
		assert(routeTypes.includes('index'));
		assert(routeTypes.includes('dynamic'));
		assert(routeTypes.includes('catch-all'));
	} finally {
		// Clean up
		await Deno.remove(tempDir, { recursive: true });
	}
});

Deno.test('RouteDiscovery - empty directory handling', async () => {
	const tempDir = await Deno.makeTempDir({ prefix: 'empty_dir_test_' });

	try {
		const discovery = new RouteDiscovery({ pagesDirectory: tempDir });
		const pageFiles = await discovery.scanPagesDirectory();
		const routes = await discovery.createRoutes(pageFiles);

		assertEquals(pageFiles.length, 0);
		assertEquals(routes.length, 0);
	} finally {
		await Deno.remove(tempDir, { recursive: true });
	}
});

Deno.test('RouteDiscovery - nonexistent directory handling', async () => {
	const nonexistentDir = '/tmp/nonexistent_' + Date.now();

	const discovery = new RouteDiscovery({ pagesDirectory: nonexistentDir });
	const pageFiles = await discovery.scanPagesDirectory();

	// Should create the directory and return empty array
	assertEquals(pageFiles.length, 0);

	// Clean up created directory
	try {
		await Deno.remove(nonexistentDir, { recursive: true });
	} catch {
		// Ignore cleanup errors
	}
});

Deno.test('RouteDiscovery - route priority calculation', () => {
	const discovery = new RouteDiscovery();

	// Create test routes with different priorities
	const testCases = [
		{ path: 'about.tsx', expectedType: 'static' as RouteType },
		{ path: 'index.tsx', expectedType: 'index' as RouteType },
		{ path: 'blog/[slug].tsx', expectedType: 'dynamic' as RouteType },
		{ path: '[...rest].tsx', expectedType: 'catch-all' as RouteType },
		{ path: '(auth)/login.tsx', expectedType: 'group' as RouteType },
	];

	const routes = testCases.map(testCase => {
		const pattern = discovery.createRoutePattern(testCase.path);
		const routeType = discovery.determineRouteType(testCase.path);
		const dynamicSegments = discovery.extractDynamicSegments(testCase.path);

		assertEquals(routeType, testCase.expectedType);

		return {
			pattern,
			filePath: testCase.path,
			routeType,
			dynamicSegments,
			priority: (discovery as any).calculateRoutePriority(routeType, testCase.path),
			isPrivate: false,
			routeGroup: (discovery as any).extractRouteGroup(testCase.path),
		};
	});

	// Sort by priority
	routes.sort((a, b) => a.priority - b.priority);

	// Static routes should have highest priority (lowest number)
	assert(routes[0].routeType === 'static' || routes[0].routeType === 'index');

	// Catch-all routes should have lowest priority (highest number)
	const lastRoute = routes[routes.length - 1];
	assert(lastRoute.routeType === 'catch-all');
});

Deno.test('RouteDiscovery - route groups handling', () => {
	const discovery = new RouteDiscovery();

	// Test route group extraction
	assertEquals((discovery as any).extractRouteGroup('(auth)/login.tsx'), 'auth');
	assertEquals((discovery as any).extractRouteGroup('(dashboard)/settings.tsx'), 'dashboard');
	assertEquals((discovery as any).extractRouteGroup('about.tsx'), undefined);
	assertEquals((discovery as any).extractRouteGroup('blog/(posts)/[slug].tsx'), 'posts');

	// Test route pattern generation for groups
	const groupPattern = discovery.createRoutePattern('(auth)/login.tsx');
	assertEquals(groupPattern.pathname, '/login'); // Group should not affect URL

	const nestedGroupPattern = discovery.createRoutePattern('admin/(dashboard)/users.tsx');
	assertEquals(nestedGroupPattern.pathname, '/admin/users');
});

Deno.test('RouteDiscovery - private folder detection', () => {
	const discovery = new RouteDiscovery();

	// Test private folder detection
	assert((discovery as any).isPrivateFile('_components/Button.tsx'));
	assert((discovery as any).isPrivateFile('_utils/helpers.ts'));
	assert((discovery as any).isPrivateFile('blog/_components/Post.tsx'));
	assert((discovery as any).isPrivateFile('_middleware.ts'));
	assert((discovery as any).isPrivateFile('admin/_layout.tsx'));

	// Test non-private files
	assert(!(discovery as any).isPrivateFile('about.tsx'));
	assert(!(discovery as any).isPrivateFile('blog/index.tsx'));
	assert(!(discovery as any).isPrivateFile('(auth)/login.tsx'));
});

Deno.test('RouteDiscovery - complex route patterns', () => {
	const discovery = new RouteDiscovery();

	// Test complex dynamic routes
	const complexPattern = discovery.createRoutePattern('api/v[version]/users/[id]/posts/[...rest].tsx');
	assertEquals(complexPattern.pathname, '/api/v:version/users/:id/posts/*');

	const segments = discovery.extractDynamicSegments('api/v[version]/users/[id]/posts/[...rest].tsx');
	assertEquals(segments, ['version', 'id', 'rest']);

	// Test nested route groups
	const nestedGroupPattern = discovery.createRoutePattern('(admin)/(dashboard)/users/[id].tsx');
	assertEquals(nestedGroupPattern.pathname, '/users/:id');

	// Test mixed patterns
	const mixedPattern = discovery.createRoutePattern('(auth)/api/[version]/login.tsx');
	assertEquals(mixedPattern.pathname, '/api/:version/login');
});

Deno.test('RouteDiscovery - route conflict detection', async () => {
	const tempDir = await Deno.makeTempDir({ prefix: 'route_conflict_test_' });

	try {
		// Create conflicting routes
		const conflictingFiles = [
			'users/[id].tsx', // Dynamic route
			'users/profile.tsx', // Static route that could conflict
			'users/settings.tsx', // Another static route
		];

		for (const file of conflictingFiles) {
			const filePath = join(tempDir, file);
			await Deno.mkdir(join(filePath, '..'), { recursive: true });
			await Deno.writeTextFile(filePath, `export default function Component() { return null; }`);
		}

		const discovery = new RouteDiscovery({
			pagesDirectory: tempDir,
			developmentMode: true,
		});
		const pageFiles = await discovery.scanPagesDirectory();
		const routes = discovery.createRoutes(pageFiles);

		// Should have all routes (no actual conflicts in this case)
		assertEquals(routes.length, 3);

		// Test validation
		const errors = discovery.validateRoutePatterns(routes);
		assertEquals(errors.length, 0); // No conflicts expected
	} finally {
		await Deno.remove(tempDir, { recursive: true });
	}
});

Deno.test('RouteDiscovery - actual route conflicts', async () => {
	const tempDir = await Deno.makeTempDir({ prefix: 'actual_conflict_test_' });

	try {
		// Create files that would generate the same route pattern
		const conflictingFiles = [
			'about.tsx',
			'about/index.tsx', // This would also generate /about route
		];

		for (const file of conflictingFiles) {
			const filePath = join(tempDir, file);
			await Deno.mkdir(join(filePath, '..'), { recursive: true });
			await Deno.writeTextFile(filePath, `export default function Component() { return null; }`);
		}

		const discovery = new RouteDiscovery({
			pagesDirectory: tempDir,
			developmentMode: false, // Don't throw errors in test
		});
		const pageFiles = await discovery.scanPagesDirectory();
		const routes = discovery.createRoutes(pageFiles);

		// Should resolve conflict and keep only one route
		assertEquals(routes.length, 1);

		// The winner should be the one with higher priority (static over index)
		assertEquals(routes[0].routeType, 'static');
	} finally {
		await Deno.remove(tempDir, { recursive: true });
	}
});

Deno.test('RouteDiscovery - route specificity ordering', () => {
	const discovery = new RouteDiscovery();

	const testRoutes = [
		{ path: '[...rest].tsx', type: 'catch-all' as RouteType },
		{ path: 'blog/[slug].tsx', type: 'dynamic' as RouteType },
		{ path: 'blog/index.tsx', type: 'index' as RouteType },
		{ path: 'blog/about.tsx', type: 'static' as RouteType },
		{ path: 'index.tsx', type: 'index' as RouteType },
	];

	const routes = testRoutes.map(test => ({
		pattern: discovery.createRoutePattern(test.path),
		filePath: test.path,
		routeType: test.type,
		dynamicSegments: discovery.extractDynamicSegments(test.path),
		priority: (discovery as any).calculateRoutePriority(test.type, test.path),
		isPrivate: false,
		routeGroup: undefined,
	}));

	// Sort by priority
	routes.sort((a, b) => a.priority - b.priority);

	// More specific routes should come first
	// Static routes should have higher priority than dynamic
	// Dynamic routes should have higher priority than catch-all
	const priorities = routes.map(r => r.routeType);

	// Find positions of different route types
	const staticIndex = priorities.findIndex(p => p === 'static');
	const dynamicIndex = priorities.findIndex(p => p === 'dynamic');
	const catchAllIndex = priorities.findIndex(p => p === 'catch-all');

	// Static should come before dynamic, dynamic before catch-all
	if (staticIndex !== -1 && dynamicIndex !== -1) {
		assert(staticIndex < dynamicIndex);
	}
	if (dynamicIndex !== -1 && catchAllIndex !== -1) {
		assert(dynamicIndex < catchAllIndex);
	}
});
