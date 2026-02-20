/**
 * Enhanced TypeScript support for file-system routing
 *
 * This module provides strongly typed interfaces, utility types, and type guards
 * for the file-system routing system, ensuring type safety throughout the routing pipeline.
 */

import type { ComponentType } from 'preact';
import { h } from 'preact';
import type {
	LoaderContext,
	Metadata
} from '../schemas/routing.ts';
import type { LayoutConfig } from '../schemas/layout.ts';
import process from "node:process";

// === Route Parameter Type Extraction ===

/**
 * Extract route parameters from a route pattern string
 *
 * @example
 * ```typescript
 * type BlogParams = ExtractRouteParams<'/blog/[slug]'>; // { slug: string }
 * type UserParams = ExtractRouteParams<'/users/[id]/posts/[postId]'>; // { id: string; postId: string }
 * type CatchAllParams = ExtractRouteParams<'/docs/[...path]'>; // { path: string[] }
 * ```
 */
export type ExtractRouteParams<T extends string> = T extends `${string}[${infer Param}]${infer Rest}`
	? Param extends `...${infer RestParam}`
		? { [K in RestParam]: string[] } & ExtractRouteParams<Rest>
		: Param extends `${infer OptionalParam}?`
		? { [K in OptionalParam]?: string } & ExtractRouteParams<Rest>
		: { [K in Param]: string } & ExtractRouteParams<Rest>
	: Record<PropertyKey, never>;

/**
 * Extract optional route parameters from a route pattern string
 *
 * @example
 * ```typescript
 * type OptionalParams = ExtractOptionalParams<'/blog/[[...slug]]'>; // { slug?: string[] }
 * ```
 */
export type ExtractOptionalParams<T extends string> = T extends `${string}[[${infer Param}]]${infer Rest}`
	? Param extends `...${infer RestParam}`
		? { [K in RestParam]?: string[] } & ExtractOptionalParams<Rest>
		: { [K in Param]?: string } & ExtractOptionalParams<Rest>
	: Record<PropertyKey, never>;

/**
 * Combine required and optional route parameters
 */
export type RouteParameters<T extends string> = ExtractRouteParams<T> & ExtractOptionalParams<T>;

// === Strongly Typed Page Components ===

/**
 * Strongly typed page component with route parameters
 *
 * @example
 * ```typescript
 * const BlogPost: TypedPageComponent<'/blog/[slug]'> = ({ params, query, data }) => {
 *   // params.slug is typed as string
 *   return <div>Blog post: {params.slug}</div>;
 * };
 * ```
 */
export type TypedPageComponent<TRoute extends string = string> = ComponentType<{
	params: RouteParameters<TRoute>;
	query: URLSearchParams;
	data?: unknown;
}>;

/**
 * Page component with custom data type
 *
 * @example
 * ```typescript
 * interface BlogPostData {
 *   title: string;
 *   content: string;
 * }
 *
 * const BlogPost: TypedPageComponentWithData<'/blog/[slug]', BlogPostData> = ({ params, data }) => {
 *   // data is typed as BlogPostData | undefined
 *   return <div>{data?.title}</div>;
 * };
 * ```
 */
export type TypedPageComponentWithData<TRoute extends string, TData> = ComponentType<{
	params: RouteParameters<TRoute>;
	query: URLSearchParams;
	data?: TData;
}>;

// === Strongly Typed Metadata Generators ===

/**
 * Strongly typed metadata generator function
 *
 * @example
 * ```typescript
 * const generateMetadata: TypedMetadataGenerator<'/blog/[slug]'> = async ({ slug }) => {
 *   // slug is typed as string
 *   return {
 *     title: `Blog Post: ${slug}`,
 *     description: `Read about ${slug}`,
 *   };
 * };
 * ```
 */
export type TypedMetadataGenerator<TRoute extends string> = (params: RouteParameters<TRoute>) => Promise<Metadata>;

/**
 * Metadata generator with custom context
 */
export type TypedMetadataGeneratorWithContext<TRoute extends string, TContext = unknown> = (
	params: RouteParameters<TRoute>,
	context: TContext
) => Promise<Metadata>;

// === Strongly Typed Page Loaders ===

/**
 * Strongly typed page loader function
 *
 * @example
 * ```typescript
 * const loader: TypedPageLoader<'/blog/[slug]', BlogPostData> = async ({ params, request }) => {
 *   // params.slug is typed as string
 *   const post = await fetchBlogPost(params.slug);
 *   return post;
 * };
 * ```
 */
export type TypedPageLoader<TRoute extends string, TData = unknown> = (
	context: LoaderContext & { params: RouteParameters<TRoute> }
) => Promise<TData>;

/**
 * Page loader with custom context
 */
export type TypedPageLoaderWithContext<TRoute extends string, TData = unknown, TContext = unknown> = (
	context: LoaderContext & { params: RouteParameters<TRoute> },
	customContext: TContext
) => Promise<TData>;

// === Strongly Typed Route Modules ===

/**
 * Strongly typed route page module
 *
 * @example
 * ```typescript
 * const pageModule: TypedRoutePageModule<'/blog/[slug]', BlogPostData> = {
 *   default: BlogPostComponent,
 *   generateMetadata: async ({ slug }) => ({ title: slug }),
 *   loader: async ({ params }) => fetchBlogPost(params.slug),
 * };
 * ```
 */
export type TypedRoutePageModule<TRoute extends string, TData = unknown> = {
	default: TypedPageComponent<TRoute>;
	layoutConfig?: LayoutConfig;
	generateMetadata?: TypedMetadataGenerator<TRoute>;
	loader?: TypedPageLoader<TRoute, TData>;
};

// === API Route Types ===

/**
 * Strongly typed API handler function
 *
 * @example
 * ```typescript
 * export const GET: TypedApiHandler<'/api/users/[id]'> = async (request, { params }) => {
 *   // params.id is typed as string
 *   const user = await getUser(params.id);
 *   return Response.json(user);
 * };
 * ```
 */
export type TypedApiHandler<TRoute extends string> = (
	request: Request,
	context: LoaderContext & { params: RouteParameters<TRoute> }
) => Promise<Response>;

/**
 * Strongly typed API module with all HTTP methods
 */
export type TypedApiModule<TRoute extends string> = {
	GET?: TypedApiHandler<TRoute>;
	POST?: TypedApiHandler<TRoute>;
	PUT?: TypedApiHandler<TRoute>;
	DELETE?: TypedApiHandler<TRoute>;
	PATCH?: TypedApiHandler<TRoute>;
	HEAD?: TypedApiHandler<TRoute>;
	OPTIONS?: TypedApiHandler<TRoute>;
};

// === Route Validation Types ===

/**
 * Route pattern validation
 */
export type ValidRoutePattern<T extends string> = T extends `${string}[${string}]${string}`
	? T
	: T extends `${string}(${string})${string}`
	? T
	: T extends `${string}_${string}`
	? never // Private files/folders
	: T;

/**
 * Valid file extensions for routes
 */
export type ValidRouteExtension = '.tsx' | '.ts' | '.jsx' | '.js';

/**
 * Route file path validation
 */
export type ValidRouteFile<T extends string> = T extends `${string}${ValidRouteExtension}`
	? T extends `${string}_${string}`
		? never // Private files
		: T
	: never;

// === Component Prop Validation ===

/**
 * Validate that a component accepts the correct props for a route
 */
export type ValidatePageComponent<TRoute extends string, TComponent> = TComponent extends ComponentType<infer TProps>
	? TProps extends { params: RouteParameters<TRoute> }
		? TComponent
		: never
	: never;

/**
 * Props validation for page components
 */
export interface PageComponentProps<TRoute extends string = string, TData = unknown> {
	params: RouteParameters<TRoute>;
	query: URLSearchParams;
	data?: TData;
}

/**
 * Validate page component props
 */
export type ValidatePageProps<TRoute extends string, TProps> = TProps extends PageComponentProps<TRoute>
	? TProps
	: never;

// === Utility Types for Route Analysis ===

/**
 * Check if a route has dynamic segments
 */
export type HasDynamicSegments<T extends string> = T extends `${string}[${string}]${string}` ? true : false;

/**
 * Check if a route has catch-all segments
 */
export type HasCatchAllSegments<T extends string> = T extends `${string}[...${string}]${string}` ? true : false;

/**
 * Check if a route has optional segments
 */
export type HasOptionalSegments<T extends string> = T extends `${string}[[${string}]]${string}` ? true : false;

/**
 * Get the static parts of a route
 */
export type GetStaticParts<T extends string> = T extends `${infer Static}[${string}]${infer Rest}`
	? Static | GetStaticParts<Rest>
	: T;

/**
 * Count dynamic segments in a route
 */
export type CountDynamicSegments<
	T extends string,
	Count extends readonly unknown[] = []
> = T extends `${string}[${string}]${infer Rest}` ? CountDynamicSegments<Rest, [...Count, unknown]> : Count['length'];

// === Error Handling Types ===

/**
 * Route error types
 */
export type RouteErrorType =
	| 'ROUTE_NOT_FOUND'
	| 'INVALID_PARAMS'
	| 'LOADER_ERROR'
	| 'METADATA_ERROR'
	| 'COMPONENT_ERROR'
	| 'VALIDATION_ERROR';

/**
 * Route error with context
 */
export interface RouteError<TRoute extends string = string> {
	type: RouteErrorType;
	route: TRoute;
	params?: Partial<RouteParameters<TRoute>>;
	message: string;
	originalError?: Error;
	suggestions?: string[];
}

/**
 * Error boundary props for routes
 */
export interface RouteErrorBoundaryProps<TRoute extends string = string> {
	error: RouteError<TRoute>;
	retry: () => void;
	fallback?: ComponentType<{ error: RouteError<TRoute> }>;
}

// === Development and Debugging Types ===

/**
 * Route debugging information
 */
export interface RouteDebugInfo<TRoute extends string = string> {
	route: TRoute;
	params: RouteParameters<TRoute>;
	staticParts: string[];
	dynamicSegments: string[];
	hasOptionalSegments: HasOptionalSegments<TRoute>;
	hasCatchAllSegments: HasCatchAllSegments<TRoute>;
	priority: number;
	filePath: string;
}

/**
 * Route performance metrics
 */
export interface RoutePerformanceMetrics {
	discoveryTime: number;
	loadTime: number;
	renderTime: number;
	metadataResolutionTime: number;
	cacheHits: number;
	cacheMisses: number;
}

// === Type Guards and Validation Functions ===

/**
 * Type guard for route parameters
 */
export function isValidRouteParams<TRoute extends string>(
	params: unknown,
	expectedParams: (keyof RouteParameters<TRoute>)[]
): params is RouteParameters<TRoute> {
	if (!params || typeof params !== 'object') {
		return false;
	}

	const paramObj = params as Record<string, unknown>;

	// Check that all expected parameters are present and are strings or string arrays
	for (const param of expectedParams) {
		const value = paramObj[param as string];
		if (value === undefined) {
			return false;
		}
		if (typeof value !== 'string' && !Array.isArray(value)) {
			return false;
		}
		if (Array.isArray(value) && !value.every(item => typeof item === 'string')) {
			return false;
		}
	}

	return true;
}

/**
 * Type guard for page component props
 */
export function isValidPageProps<TRoute extends string>(
	props: unknown,
	expectedParams: (keyof RouteParameters<TRoute>)[]
): props is PageComponentProps<TRoute> {
	if (!props || typeof props !== 'object') {
		return false;
	}

	const propsObj = props as Record<string, unknown>;

	// Check required properties
	if (!propsObj.params || !propsObj.query) {
		return false;
	}

	// Validate params
	if (!isValidRouteParams<TRoute>(propsObj.params, expectedParams)) {
		return false;
	}

	// Validate query
	if (!(propsObj.query instanceof URLSearchParams)) {
		return false;
	}

	return true;
}

/**
 * Validate route pattern syntax
 */
export function isValidRoutePattern(pattern: string): boolean {
	// Check for valid bracket syntax
	const bracketRegex = /\[([^\]]+)\]/g;
	const matches = pattern.match(bracketRegex);

	if (matches) {
		for (const match of matches) {
			const param = match.slice(1, -1); // Remove brackets

			// Check for valid parameter names
			if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\?)?$/.test(param) && !/^\.\.\.([a-zA-Z_][a-zA-Z0-9_]*)$/.test(param)) {
				return false;
			}
		}
	}

	// Check for valid route group syntax
	const groupRegex = /\(([^)]+)\)/g;
	const groupMatches = pattern.match(groupRegex);

	if (groupMatches) {
		for (const match of groupMatches) {
			const group = match.slice(1, -1); // Remove parentheses

			// Check for valid group names
			if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(group)) {
				return false;
			}
		}
	}

	return true;
}

// === Helper Functions for Type Safety ===

/**
 * Create a typed page component with parameter validation
 */
export function createTypedPageComponent<TRoute extends string>(
	component: TypedPageComponent<TRoute>,
	expectedParams: (keyof RouteParameters<TRoute>)[]
): TypedPageComponent<TRoute> {
	// Return a wrapper component that validates props
	const WrappedComponent: TypedPageComponent<TRoute> = (props: unknown) => {
		// Validate props in development
		if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
			if (!isValidPageProps<TRoute>(props, expectedParams)) {
				console.warn('Invalid props passed to typed page component:', props);
			}
		}

		// Use h() to render the component (works for both function and class components)
		return h(component, props);
	};
	
	return WrappedComponent;
}

/**
 * Create a typed metadata generator with parameter validation
 */
export function createTypedMetadataGenerator<TRoute extends string>(
	generator: TypedMetadataGenerator<TRoute>,
	expectedParams: (keyof RouteParameters<TRoute>)[]
): TypedMetadataGenerator<TRoute> {
	return async params => {
		// Validate params in development
		if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
			if (!isValidRouteParams<TRoute>(params, expectedParams)) {
				console.warn('Invalid params passed to typed metadata generator:', params);
			}
		}

		return await generator(params);
	};
}

/**
 * Create a typed page loader with parameter validation
 */
export function createTypedPageLoader<TRoute extends string, TData = unknown>(
	loader: TypedPageLoader<TRoute, TData>,
	expectedParams: (keyof RouteParameters<TRoute>)[]
): TypedPageLoader<TRoute, TData> {
	return async context => {
		// Validate params in development
		if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
			if (!isValidRouteParams<TRoute>(context.params, expectedParams)) {
				console.warn('Invalid params passed to typed page loader:', context.params);
			}
		}

		return await loader(context);
	};
}

/**
 * Validate component accepts correct props for a route
 */
export function validatePageComponent<TRoute extends string>(
	component: unknown,
	_expectedParams: (keyof RouteParameters<TRoute>)[]
): component is TypedPageComponent<TRoute> {
	// In TypeScript, we can't really validate function signatures at runtime
	// This is more of a development-time helper
	if (typeof component !== 'function') {
		return false;
	}

	// Could add more sophisticated validation in development mode
	return true;
}

/**
 * Create a typed API handler with parameter validation
 */
export function createTypedApiHandler<TRoute extends string>(
	handler: TypedApiHandler<TRoute>,
	expectedParams: (keyof RouteParameters<TRoute>)[]
): TypedApiHandler<TRoute> {
	return async (request, context) => {
		// Validate params in development
		if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
			if (!isValidRouteParams<TRoute>(context.params, expectedParams)) {
				console.warn('Invalid params passed to typed API handler:', context.params);
			}
		}

		return await handler(request, context);
	};
}

// === Re-export commonly used types ===
export type {
	RouteParams,
	LoaderContext,
	Metadata,
	PageProps,
	RoutePageModule,
	FileSystemRoute,
	ResolvedMetadata,
} from '../schemas/routing.ts';
