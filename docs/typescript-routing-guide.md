# TypeScript Guide for File-System Routing

This guide covers the TypeScript features and type safety enhancements available in the Avalon file-system routing system.

## Table of Contents

1. [Overview](#overview)
2. [Route Parameter Types](#route-parameter-types)
3. [Typed Page Components](#typed-page-components)
4. [Typed Metadata Generators](#typed-metadata-generators)
5. [Typed Page Loaders](#typed-page-loaders)
6. [API Route Types](#api-route-types)
7. [Type Validation](#type-validation)
8. [Error Handling](#error-handling)
9. [Development Tools](#development-tools)
10. [Best Practices](#best-practices)

## Overview

The Avalon file-system routing system provides comprehensive TypeScript support to ensure type safety throughout your routing pipeline. This includes:

- **Route parameter extraction** from file paths
- **Strongly typed page components** with validated props
- **Type-safe metadata generators** with parameter validation
- **Typed page loaders** with context validation
- **API route type safety** for all HTTP methods
- **Runtime validation** in development mode
- **Comprehensive error types** for debugging

## Route Parameter Types

### Basic Parameter Extraction

The `ExtractRouteParams` utility type automatically extracts route parameters from file paths:

```typescript
import type { ExtractRouteParams } from '../types/routing.ts';

// Static route - no parameters
type HomeParams = ExtractRouteParams<'/'>; // {}

// Single parameter
type BlogParams = ExtractRouteParams<'/blog/[slug]'>; // { slug: string }

// Multiple parameters
type UserParams = ExtractRouteParams<'/users/[id]/posts/[postId]'>;
// { id: string; postId: string }

// Catch-all parameter
type DocsParams = ExtractRouteParams<'/docs/[...path]'>; // { path: string[] }

// Optional catch-all parameter
type OptionalParams = ExtractRouteParams<'/blog/[[...slug]]'>; // { slug?: string[] }
```

### Complex Route Patterns

```typescript
// Mixed parameters
type ComplexParams = ExtractRouteParams<'/api/v[version]/users/[id]/posts/[...path]'>;
// { version: string; id: string; path: string[] }

// Route groups (don't affect parameters)
type GroupParams = ExtractRouteParams<'/(auth)/login/[provider]'>; // { provider: string }
```

## Typed Page Components

### Basic Typed Components

```typescript
import type { TypedPageComponent } from '../types/routing.ts';

// Static page component
const HomePage: TypedPageComponent<'/'> = ({ params, query, data }) => {
	// params is {} (empty object)
	return <div>Welcome to the home page!</div>;
};

// Dynamic page component
const BlogPost: TypedPageComponent<'/blog/[slug]'> = ({ params, query, data }) => {
	// params.slug is typed as string
	return (
		<article>
			<h1>Blog Post: {params.slug}</h1>
			<p>Query params: {query.get('preview')}</p>
		</article>
	);
};

// Complex dynamic component
const UserPost: TypedPageComponent<'/users/[id]/posts/[postId]'> = ({ params, query, data }) => {
	// params.id and params.postId are both typed as string
	return (
		<div>
			<h1>
				User {params.id} - Post {params.postId}
			</h1>
		</div>
	);
};
```

### Components with Custom Data Types

```typescript
import type { TypedPageComponentWithData } from '../types/routing.ts';

interface BlogPostData {
	title: string;
	content: string;
	author: string;
	publishedAt: Date;
}

const BlogPost: TypedPageComponentWithData<'/blog/[slug]', BlogPostData> = ({ params, query, data }) => {
	// data is typed as BlogPostData | undefined
	if (!data) {
		return <div>Loading...</div>;
	}

	return (
		<article>
			<h1>{data.title}</h1>
			<p>
				By {data.author} on {data.publishedAt.toLocaleDateString()}
			</p>
			<div>{data.content}</div>
		</article>
	);
};
```

### Catch-All Route Components

```typescript
const DocsPage: TypedPageComponent<'/docs/[...path]'> = ({ params, query, data }) => {
  // params.path is typed as string[]
  const breadcrumbs = params.path.join(' > ');

  return (
    <div>
      <nav>Docs > {breadcrumbs}</nav>
      <main>Documentation content for: {params.path.join('/')}</main>
    </div>
  );
};
```

## Typed Metadata Generators

### Basic Metadata Generators

```typescript
import type { TypedMetadataGenerator } from '../types/routing.ts';

// Static page metadata
const generateHomeMetadata: TypedMetadataGenerator<'/'> = async params => {
	// params is {} (empty object)
	return {
		title: 'Welcome to Our Site',
		description: 'The best site on the web',
	};
};

// Dynamic page metadata
const generateBlogMetadata: TypedMetadataGenerator<'/blog/[slug]'> = async ({ slug }) => {
	// slug is typed as string
	const post = await fetchBlogPost(slug);

	return {
		title: `${post.title} | Our Blog`,
		description: post.excerpt,
		openGraph: {
			title: post.title,
			description: post.excerpt,
			image: post.featuredImage,
			type: 'article',
		},
		keywords: post.tags,
	};
};

// Complex metadata with multiple parameters
const generateUserPostMetadata: TypedMetadataGenerator<'/users/[id]/posts/[postId]'> = async ({ id, postId }) => {
	// id and postId are both typed as string
	const [user, post] = await Promise.all([fetchUser(id), fetchPost(postId)]);

	return {
		title: `${post.title} by ${user.name}`,
		description: post.excerpt,
		canonical: `https://example.com/users/${id}/posts/${postId}`,
	};
};
```

### Metadata with Custom Context

```typescript
import type { TypedMetadataGeneratorWithContext } from '../types/routing.ts';

interface MetadataContext {
	locale: string;
	theme: 'light' | 'dark';
}

const generateLocalizedMetadata: TypedMetadataGeneratorWithContext<'/blog/[slug]', MetadataContext> = async (
	{ slug },
	{ locale, theme }
) => {
	const post = await fetchBlogPost(slug, locale);

	return {
		title: post.title,
		description: post.excerpt,
		openGraph: {
			locale,
		},
	};
};
```

## Typed Page Loaders

### Basic Page Loaders

```typescript
import type { TypedPageLoader } from '../types/routing.ts';

// Static page loader
const homeLoader: TypedPageLoader<'/', HomePageData> = async ({ request, query }) => {
	// No route parameters for static routes
	const featuredPosts = await fetchFeaturedPosts();

	return {
		featuredPosts,
		timestamp: new Date(),
	};
};

// Dynamic page loader
const blogPostLoader: TypedPageLoader<'/blog/[slug]', BlogPostData> = async ({ params, request, query }) => {
	// params.slug is typed as string
	const post = await fetchBlogPost(params.slug);

	if (!post) {
		throw new Response('Post not found', { status: 404 });
	}

	return post;
};

// Complex loader with multiple parameters
const userPostLoader: TypedPageLoader<'/users/[id]/posts/[postId]', UserPostData> = async ({
	params,
	request,
	query,
	state,
}) => {
	// params.id and params.postId are both typed as string
	const [user, post] = await Promise.all([fetchUser(params.id), fetchUserPost(params.id, params.postId)]);

	// Check permissions from middleware state
	const currentUser = state.get('user');
	const canEdit = currentUser?.id === user.id;

	return {
		user,
		post,
		canEdit,
	};
};
```

### Loaders with Error Handling

```typescript
const safeLoader: TypedPageLoader<'/blog/[slug]', BlogPostData | null> = async ({ params }) => {
	try {
		const post = await fetchBlogPost(params.slug);
		return post;
	} catch (error) {
		console.error('Failed to load blog post:', error);
		return null; // Component can handle null data
	}
};
```

## API Route Types

### Basic API Routes

```typescript
import type { TypedApiHandler, TypedApiModule } from '../types/routing.ts';

// Single API handler
export const GET: TypedApiHandler<'/api/users/[id]'> = async (request, { params }) => {
	// params.id is typed as string
	const user = await getUser(params.id);

	if (!user) {
		return new Response('User not found', { status: 404 });
	}

	return Response.json(user);
};

// Complete API module
const userApiModule: TypedApiModule<'/api/users/[id]'> = {
	GET: async (request, { params }) => {
		const user = await getUser(params.id);
		return Response.json(user);
	},

	PUT: async (request, { params }) => {
		const updates = await request.json();
		const user = await updateUser(params.id, updates);
		return Response.json(user);
	},

	DELETE: async (request, { params }) => {
		await deleteUser(params.id);
		return new Response(null, { status: 204 });
	},
};

export const { GET, PUT, DELETE } = userApiModule;
```

### API Routes with Complex Parameters

```typescript
// Catch-all API route
export const GET: TypedApiHandler<'/api/files/[...path]'> = async (request, { params }) => {
	// params.path is typed as string[]
	const filePath = params.path.join('/');
	const file = await getFile(filePath);

	return new Response(file.content, {
		headers: {
			'Content-Type': file.mimeType,
			'Content-Length': file.size.toString(),
		},
	});
};

// Multiple parameters
export const POST: TypedApiHandler<'/api/users/[userId]/posts/[postId]/comments'> = async (request, { params }) => {
	// params.userId and params.postId are both typed as string
	const comment = await request.json();
	const newComment = await createComment(params.userId, params.postId, comment);

	return Response.json(newComment, { status: 201 });
};
```

## Type Validation

### Runtime Validation Helpers

```typescript
import {
	createTypedPageComponent,
	createTypedMetadataGenerator,
	createTypedPageLoader,
	isValidRouteParams,
	isValidPageProps,
} from '../types/routing.ts';

// Create validated page component
const BlogPost = createTypedPageComponent<'/blog/[slug]'>(
	({ params, query, data }) => {
		return <div>Blog post: {params.slug}</div>;
	},
	['slug'] // Expected parameters for validation
);

// Create validated metadata generator
const generateMetadata = createTypedMetadataGenerator<'/blog/[slug]'>(
	async ({ slug }) => ({
		title: `Blog: ${slug}`,
	}),
	['slug']
);

// Create validated page loader
const loader = createTypedPageLoader<'/blog/[slug]', BlogPostData>(
	async ({ params }) => {
		return await fetchBlogPost(params.slug);
	},
	['slug']
);
```

### Manual Validation

```typescript
import { isValidRouteParams, isValidPageProps } from '../types/routing.ts';

// Validate route parameters
function validateBlogParams(params: unknown): params is { slug: string } {
	return isValidRouteParams<'/blog/[slug]'>(params, ['slug']);
}

// Validate page props
function validateBlogProps(props: unknown): props is PageComponentProps<'/blog/[slug]'> {
	return isValidPageProps<'/blog/[slug]'>(props, ['slug']);
}

// Usage in component
const BlogPost: TypedPageComponent<'/blog/[slug]'> = props => {
	if (!validateBlogProps(props)) {
		console.error('Invalid props:', props);
		return <div>Error: Invalid props</div>;
	}

	return <div>Blog post: {props.params.slug}</div>;
};
```

## Error Handling

### Route Error Types

```typescript
import type { RouteError, RouteErrorBoundaryProps } from '../types/routing.ts';

// Handle specific route errors
const BlogErrorBoundary: React.ComponentType<RouteErrorBoundaryProps<'/blog/[slug]'>> = ({ error, retry }) => {
	switch (error.type) {
		case 'ROUTE_NOT_FOUND':
			return <div>Blog post not found: {error.params?.slug}</div>;

		case 'LOADER_ERROR':
			return (
				<div>
					<p>Failed to load blog post</p>
					<button onClick={retry}>Try Again</button>
				</div>
			);

		case 'INVALID_PARAMS':
			return <div>Invalid blog post slug: {error.params?.slug}</div>;

		default:
			return <div>An error occurred: {error.message}</div>;
	}
};
```

### Custom Error Types

```typescript
interface BlogPostError extends RouteError<'/blog/[slug]'> {
	postId?: string;
	authorId?: string;
}

const handleBlogError = (error: BlogPostError) => {
	console.error('Blog error:', {
		type: error.type,
		route: error.route,
		slug: error.params?.slug,
		postId: error.postId,
		suggestions: error.suggestions,
	});
};
```

## Development Tools

### Route Debugging

```typescript
import type { RouteDebugInfo, RoutePerformanceMetrics } from '../types/routing.ts';

// Debug route information
const debugRoute = (route: string, params: unknown): RouteDebugInfo => {
	return {
		route: route as any,
		params: params as any,
		staticParts: route.split(/\[.*?\]/).filter(Boolean),
		dynamicSegments: (route.match(/\[([^\]]+)\]/g) || []).map(s => s.slice(1, -1)),
		hasOptionalSegments: route.includes('[['),
		hasCatchAllSegments: route.includes('[...'),
		priority: calculateRoutePriority(route),
		filePath: routeToFilePath(route),
	};
};

// Performance monitoring
const trackRoutePerformance = (): RoutePerformanceMetrics => {
	return {
		discoveryTime: performance.now(),
		loadTime: 0,
		renderTime: 0,
		metadataResolutionTime: 0,
		cacheHits: 0,
		cacheMisses: 0,
	};
};
```

### Type Utilities for Development

```typescript
import type {
	HasDynamicSegments,
	HasCatchAllSegments,
	CountDynamicSegments,
	GetStaticParts,
} from '../types/routing.ts';

// Compile-time route analysis
type BlogHasDynamic = HasDynamicSegments<'/blog/[slug]'>; // true
type HomeHasDynamic = HasDynamicSegments<'/'>; // false

type DocsHasCatchAll = HasCatchAllSegments<'/docs/[...path]'>; // true
type BlogHasCatchAll = HasCatchAllSegments<'/blog/[slug]'>; // false

type UserParamCount = CountDynamicSegments<'/users/[id]/posts/[postId]'>; // 2
type HomeParamCount = CountDynamicSegments<'/'>; // 0

type BlogStatic = GetStaticParts<'/blog/[slug]/comments'>; // '/blog/' | '/comments'
```

## Best Practices

### 1. Use Typed Components Consistently

```typescript
// ✅ Good: Use typed components
const BlogPost: TypedPageComponent<'/blog/[slug]'> = ({ params }) => {
	return <div>{params.slug}</div>; // TypeScript knows slug is a string
};

// ❌ Bad: Untyped component
const BlogPost = ({ params }: any) => {
	return <div>{params.slug}</div>; // No type safety
};
```

### 2. Validate Parameters in Development

```typescript
// ✅ Good: Use validation helpers
const BlogPost = createTypedPageComponent<'/blog/[slug]'>(({ params }) => <div>{params.slug}</div>, ['slug']);

// ✅ Also good: Manual validation
const BlogPost: TypedPageComponent<'/blog/[slug]'> = props => {
	if (process.env.NODE_ENV === 'development') {
		if (!isValidPageProps<'/blog/[slug]'>(props, ['slug'])) {
			console.warn('Invalid props:', props);
		}
	}

	return <div>{props.params.slug}</div>;
};
```

### 3. Use Custom Data Types

```typescript
// ✅ Good: Define specific data types
interface BlogPostData {
	title: string;
	content: string;
	author: { name: string; email: string };
}

const BlogPost: TypedPageComponentWithData<'/blog/[slug]', BlogPostData> = ({ data }) => {
	// TypeScript knows the exact shape of data
	return <div>{data?.title}</div>;
};

// ❌ Bad: Use unknown or any
const BlogPost: TypedPageComponent<'/blog/[slug]'> = ({ data }) => {
	return <div>{(data as any)?.title}</div>; // No type safety
};
```

### 4. Handle Errors Gracefully

```typescript
// ✅ Good: Proper error handling
const loader: TypedPageLoader<'/blog/[slug]', BlogPostData | null> = async ({ params }) => {
	try {
		return await fetchBlogPost(params.slug);
	} catch (error) {
		console.error('Failed to load blog post:', error);
		return null; // Let component handle null state
	}
};

const BlogPost: TypedPageComponentWithData<'/blog/[slug]', BlogPostData | null> = ({ params, data }) => {
	if (data === null) {
		return <div>Failed to load blog post: {params.slug}</div>;
	}

	return <div>{data.title}</div>;
};
```

### 5. Use Route Groups for Organization

```typescript
// File: src/pages/(auth)/login/[provider].tsx
// Route: /login/[provider] (group doesn't affect URL)

const LoginProvider: TypedPageComponent<'/login/[provider]'> = ({ params }) => {
	// params.provider is typed as string
	return <div>Login with {params.provider}</div>;
};
```

### 6. Leverage Catch-All Routes

```typescript
// File: src/pages/docs/[...path].tsx
// Matches: /docs/getting-started, /docs/api/users, etc.

const DocsPage: TypedPageComponent<'/docs/[...path]'> = ({ params }) => {
	// params.path is typed as string[]
	const [section, ...subsections] = params.path;

	return (
		<div>
			<h1>{section}</h1>
			{subsections.length > 0 && (
				<nav>
					{subsections.map((sub, i) => (
						<span key={i}>{sub}</span>
					))}
				</nav>
			)}
		</div>
	);
};
```

This comprehensive TypeScript support ensures type safety throughout your file-system routing implementation while providing excellent developer experience with IntelliSense, compile-time error checking, and runtime validation in development mode.
