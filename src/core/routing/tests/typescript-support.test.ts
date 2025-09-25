/**
 * Tests for TypeScript support and type safety features in file-system routing
 */

import { assertEquals, assertExists, assertThrows } from '@std/assert';
import type {
	ExtractRouteParams,
	RouteParameters,
	TypedPageComponent,
	TypedPageComponentWithData,
	TypedMetadataGenerator,
	TypedPageLoader,
	TypedApiHandler,
	HasDynamicSegments,
	HasCatchAllSegments,
	CountDynamicSegments,
	PageComponentProps,
} from '../../../schemas/routing.ts';
import {
	isValidRouteParams,
	isValidPageProps,
	isValidRoutePattern,
	createTypedPageComponent,
	createTypedMetadataGenerator,
	createTypedPageLoader,
	createTypedApiHandler,
} from '../../../schemas/routing.ts';

// === Type Extraction Tests ===

Deno.test('ExtractRouteParams - static route', () => {
	// Test that static routes have empty params
	type StaticParams = ExtractRouteParams<'/'>;
	const params: StaticParams = {};
	assertEquals(Object.keys(params).length, 0);
});

Deno.test('ExtractRouteParams - single dynamic segment', () => {
	// Test single parameter extraction
	type BlogParams = ExtractRouteParams<'/blog/[slug]'>;
	const params: BlogParams = { slug: 'test-post' };
	assertEquals(params.slug, 'test-post');
});

Deno.test('ExtractRouteParams - multiple dynamic segments', () => {
	// Test multiple parameter extraction
	type UserPostParams = ExtractRouteParams<'/users/[id]/posts/[postId]'>;
	const params: UserPostParams = { id: '123', postId: '456' };
	assertEquals(params.id, '123');
	assertEquals(params.postId, '456');
});

Deno.test('ExtractRouteParams - catch-all segment', () => {
	// Test catch-all parameter extraction
	type DocsParams = ExtractRouteParams<'/docs/[...path]'>;
	const params: DocsParams = { path: ['getting-started', 'installation'] };
	assertEquals(params.path.length, 2);
	assertEquals(params.path[0], 'getting-started');
	assertEquals(params.path[1], 'installation');
});

// === Route Analysis Type Tests ===

Deno.test('HasDynamicSegments type analysis', () => {
	// These are compile-time tests, but we can verify the logic
	type StaticHasDynamic = HasDynamicSegments<'/'>; // false
	type BlogHasDynamic = HasDynamicSegments<'/blog/[slug]'>; // true
	type DocsHasDynamic = HasDynamicSegments<'/docs/[...path]'>; // true

	// We can't directly test types at runtime, but we can test the underlying logic
	const staticRoute = '/';
	const blogRoute = '/blog/[slug]';
	const docsRoute = '/docs/[...path]';

	assertEquals(staticRoute.includes('['), false);
	assertEquals(blogRoute.includes('['), true);
	assertEquals(docsRoute.includes('['), true);
});

Deno.test('HasCatchAllSegments type analysis', () => {
	// Test catch-all detection logic
	const staticRoute = '/';
	const blogRoute = '/blog/[slug]';
	const docsRoute = '/docs/[...path]';

	assertEquals(staticRoute.includes('[...'), false);
	assertEquals(blogRoute.includes('[...'), false);
	assertEquals(docsRoute.includes('[...'), true);
});

// === Validation Function Tests ===

Deno.test('isValidRouteParams - valid parameters', () => {
	const validParams = { slug: 'test-post' };
	const result = isValidRouteParams<'/blog/[slug]'>(validParams, ['slug']);
	assertEquals(result, true);
});

Deno.test('isValidRouteParams - missing parameters', () => {
	const invalidParams = {};
	const result = isValidRouteParams<'/blog/[slug]'>(invalidParams, ['slug']);
	assertEquals(result, false);
});

Deno.test('isValidRouteParams - wrong parameter type', () => {
	const invalidParams = { slug: 123 };
	const result = isValidRouteParams<'/blog/[slug]'>(invalidParams, ['slug']);
	assertEquals(result, false);
});

Deno.test('isValidRouteParams - catch-all parameters', () => {
	const validParams = { path: ['docs', 'getting-started'] };
	const result = isValidRouteParams<'/docs/[...path]'>(validParams, ['path']);
	assertEquals(result, true);
});

Deno.test('isValidRouteParams - invalid catch-all parameters', () => {
	const invalidParams = { path: ['docs', 123] };
	const result = isValidRouteParams<'/docs/[...path]'>(invalidParams, ['path']);
	assertEquals(result, false);
});

Deno.test('isValidPageProps - valid props', () => {
	const validProps = {
		params: { slug: 'test-post' },
		query: new URLSearchParams('?preview=true'),
		data: { title: 'Test Post' },
	};
	const result = isValidPageProps<'/blog/[slug]'>(validProps, ['slug']);
	assertEquals(result, true);
});

Deno.test('isValidPageProps - missing query', () => {
	const invalidProps = {
		params: { slug: 'test-post' },
		data: { title: 'Test Post' },
	};
	const result = isValidPageProps<'/blog/[slug]'>(invalidProps, ['slug']);
	assertEquals(result, false);
});

Deno.test('isValidPageProps - invalid query type', () => {
	const invalidProps = {
		params: { slug: 'test-post' },
		query: '?preview=true', // Should be URLSearchParams
		data: { title: 'Test Post' },
	};
	const result = isValidPageProps<'/blog/[slug]'>(invalidProps, ['slug']);
	assertEquals(result, false);
});

Deno.test('isValidRoutePattern - valid patterns', () => {
	assertEquals(isValidRoutePattern('/'), true);
	assertEquals(isValidRoutePattern('/blog/[slug]'), true);
	assertEquals(isValidRoutePattern('/users/[id]/posts/[postId]'), true);
	assertEquals(isValidRoutePattern('/docs/[...path]'), true);
	assertEquals(isValidRoutePattern('/(auth)/login'), true);
});

Deno.test('isValidRoutePattern - invalid patterns', () => {
	assertEquals(isValidRoutePattern('/blog/[123invalid]'), false);
	assertEquals(isValidRoutePattern('/blog/[slug-invalid]'), false);
	assertEquals(isValidRoutePattern('/blog/[]'), false);
	assertEquals(isValidRoutePattern('/(invalid-group!)'), false);
});

// === Component Creation Tests ===

Deno.test('createTypedPageComponent - creates component with validation', () => {
	const originalComponent: TypedPageComponent<'/blog/[slug]'> = ({ params }) => {
		return `Blog post: ${params.slug}`;
	};

	const typedComponent = createTypedPageComponent(originalComponent, ['slug']);

	// Test with valid props
	const validProps = {
		params: { slug: 'test-post' },
		query: new URLSearchParams(),
	};

	const result = typedComponent(validProps);
	assertEquals(result, 'Blog post: test-post');
});

Deno.test('createTypedMetadataGenerator - creates generator with validation', async () => {
	const originalGenerator: TypedMetadataGenerator<'/blog/[slug]'> = async ({ slug }) => {
		return {
			title: `Blog: ${slug}`,
			description: `Read about ${slug}`,
		};
	};

	const typedGenerator = createTypedMetadataGenerator(originalGenerator, ['slug']);

	const result = await typedGenerator({ slug: 'test-post' });
	assertEquals(result.title, 'Blog: test-post');
	assertEquals(result.description, 'Read about test-post');
});

Deno.test('createTypedPageLoader - creates loader with validation', async () => {
	const originalLoader: TypedPageLoader<'/blog/[slug]', { title: string }> = async ({ params }) => {
		return { title: `Post: ${params.slug}` };
	};

	const typedLoader = createTypedPageLoader(originalLoader, ['slug']);

	const context = {
		request: new Request('https://example.com/blog/test-post'),
		url: new URL('https://example.com/blog/test-post'),
		params: { slug: 'test-post' },
		query: new URLSearchParams(),
		state: new Map(),
	};

	const result = await typedLoader(context);
	assertEquals(result.title, 'Post: test-post');
});

Deno.test('createTypedApiHandler - creates handler with validation', async () => {
	const originalHandler: TypedApiHandler<'/api/users/[id]'> = async (request, { params }) => {
		return Response.json({ userId: params.id });
	};

	const typedHandler = createTypedApiHandler(originalHandler, ['id']);

	const request = new Request('https://example.com/api/users/123');
	const context = {
		request,
		url: new URL('https://example.com/api/users/123'),
		params: { id: '123' },
		query: new URLSearchParams(),
		state: new Map(),
	};

	const response = await typedHandler(request, context);
	const data = await response.json();
	assertEquals(data.userId, '123');
});

// === Complex Type Tests ===

Deno.test('Complex route parameter extraction', () => {
	// Test complex route with multiple parameter types
	type ComplexParams = ExtractRouteParams<'/api/v[version]/users/[id]/posts/[...path]'>;

	const params: ComplexParams = {
		version: '1',
		id: '123',
		path: ['recent', 'published'],
	};

	assertEquals(params.version, '1');
	assertEquals(params.id, '123');
	assertEquals(params.path.length, 2);
	assertEquals(params.path[0], 'recent');
	assertEquals(params.path[1], 'published');
});

Deno.test('Page component with custom data type', () => {
	interface BlogPostData {
		title: string;
		content: string;
		author: string;
	}

	const component: TypedPageComponentWithData<'/blog/[slug]', BlogPostData> = ({ params, data }) => {
		if (!data) {
			return `Loading blog post: ${params.slug}`;
		}

		return `${data.title} by ${data.author}`;
	};

	// Test with data
	const propsWithData = {
		params: { slug: 'test-post' },
		query: new URLSearchParams(),
		data: {
			title: 'Test Post',
			content: 'Content here',
			author: 'John Doe',
		},
	};

	const resultWithData = component(propsWithData);
	assertEquals(resultWithData, 'Test Post by John Doe');

	// Test without data
	const propsWithoutData = {
		params: { slug: 'test-post' },
		query: new URLSearchParams(),
	};

	const resultWithoutData = component(propsWithoutData);
	assertEquals(resultWithoutData, 'Loading blog post: test-post');
});

// === Edge Case Tests ===

Deno.test('Route parameters with special characters', () => {
	const params = { slug: 'hello-world_123' };
	const result = isValidRouteParams<'/blog/[slug]'>(params, ['slug']);
	assertEquals(result, true);
});

Deno.test('Empty catch-all parameters', () => {
	const params = { path: [] };
	const result = isValidRouteParams<'/docs/[...path]'>(params, ['path']);
	assertEquals(result, true);
});

Deno.test('Null and undefined parameter validation', () => {
	assertEquals(isValidRouteParams<'/blog/[slug]'>(null, ['slug']), false);
	assertEquals(isValidRouteParams<'/blog/[slug]'>(undefined, ['slug']), false);
	assertEquals(isValidRouteParams<'/blog/[slug]'>('string', ['slug']), false);
	assertEquals(isValidRouteParams<'/blog/[slug]'>(123, ['slug']), false);
});

Deno.test('Route pattern validation edge cases', () => {
	// Valid edge cases
	assertEquals(isValidRoutePattern('/blog/[slug_with_underscore]'), true);
	assertEquals(isValidRoutePattern('/api/[...rest]'), true);
	assertEquals(isValidRoutePattern('/(group1)/(group2)/page'), true);

	// Invalid edge cases
	assertEquals(isValidRoutePattern('/blog/[slug-with-dash]'), false);
	assertEquals(isValidRoutePattern('/blog/[slug with space]'), false);
	assertEquals(isValidRoutePattern('/blog/[...rest-invalid]'), false);
});

// === Performance Tests ===

Deno.test('Parameter validation performance', () => {
	const params = { slug: 'test-post' };
	const iterations = 10000;

	const start = performance.now();
	for (let i = 0; i < iterations; i++) {
		isValidRouteParams<'/blog/[slug]'>(params, ['slug']);
	}
	const end = performance.now();

	const timePerIteration = (end - start) / iterations;

	// Should be very fast (less than 0.01ms per validation)
	assertEquals(timePerIteration < 0.01, true);
});

// === Integration Tests ===

Deno.test('Full typed component integration', async () => {
	interface BlogPostData {
		title: string;
		content: string;
	}

	// Create typed loader
	const loader: TypedPageLoader<'/blog/[slug]', BlogPostData> = async ({ params }) => {
		return {
			title: `Blog Post: ${params.slug}`,
			content: `Content for ${params.slug}`,
		};
	};

	// Create typed metadata generator
	const generateMetadata: TypedMetadataGenerator<'/blog/[slug]'> = async ({ slug }) => {
		return {
			title: `Blog: ${slug}`,
			description: `Read about ${slug}`,
		};
	};

	// Create typed component
	const component: TypedPageComponentWithData<'/blog/[slug]', BlogPostData> = ({ params, data }) => {
		if (!data) return `Loading ${params.slug}`;
		return `${data.title}: ${data.content}`;
	};

	// Test the integration
	const context = {
		request: new Request('https://example.com/blog/test-post'),
		url: new URL('https://example.com/blog/test-post'),
		params: { slug: 'test-post' },
		query: new URLSearchParams(),
		state: new Map(),
	};

	// Load data
	const data = await loader(context);
	assertEquals(data.title, 'Blog Post: test-post');

	// Generate metadata
	const metadata = await generateMetadata({ slug: 'test-post' });
	assertEquals(metadata.title, 'Blog: test-post');

	// Render component
	const props = {
		params: { slug: 'test-post' },
		query: new URLSearchParams(),
		data,
	};
	const result = component(props);
	assertEquals(result, 'Blog Post: test-post: Content for test-post');
});

// === Type Safety Demonstration Tests ===

Deno.test('Type safety prevents runtime errors', () => {
	// This test demonstrates that our type system catches common errors

	// Valid usage
	const validComponent: TypedPageComponent<'/blog/[slug]'> = ({ params }) => {
		// TypeScript knows params.slug is a string
		return params.slug.toUpperCase(); // This is safe
	};

	const validProps = {
		params: { slug: 'test-post' },
		query: new URLSearchParams(),
	};

	assertEquals(validComponent(validProps), 'TEST-POST');

	// The following would cause TypeScript compilation errors:
	// const invalidComponent: TypedPageComponent<'/blog/[slug]'> = ({ params }) => {
	//   return params.nonExistentParam; // TS Error: Property doesn't exist
	// };

	// const invalidProps = {
	//   params: { wrongParam: 'value' }, // TS Error: Missing 'slug' property
	//   query: new URLSearchParams(),
	// };
});

// === Documentation Tests ===

Deno.test('Type extraction examples from documentation', () => {
	// Test examples from the TypeScript guide

	type HomeParams = ExtractRouteParams<'/'>; // {}
	type BlogParams = ExtractRouteParams<'/blog/[slug]'>; // { slug: string }
	type UserParams = ExtractRouteParams<'/users/[id]/posts/[postId]'>; // { id: string; postId: string }
	type DocsParams = ExtractRouteParams<'/docs/[...path]'>; // { path: string[] }

	const homeParams: HomeParams = {};
	const blogParams: BlogParams = { slug: 'test' };
	const userParams: UserParams = { id: '1', postId: '2' };
	const docsParams: DocsParams = { path: ['guide', 'setup'] };

	assertEquals(Object.keys(homeParams).length, 0);
	assertEquals(blogParams.slug, 'test');
	assertEquals(userParams.id, '1');
	assertEquals(userParams.postId, '2');
	assertEquals(docsParams.path.length, 2);
});
