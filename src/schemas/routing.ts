import { z } from 'zod';
import { ComponentType } from 'preact';

/**
 * Route Type Schema - Defines the different types of routes supported
 */
export const RouteTypeSchema = z.enum(['static', 'dynamic', 'catch-all', 'index', 'group']);

/**
 * File System Route Schema - Represents a discovered route from the file system
 */
export const FileSystemRouteSchema = z.object({
	/** URL pattern for matching requests */
	pattern: z.any(), // URLPattern object - can't validate with Zod
	/** File path to the page component */
	filePath: z.string().min(1),
	/** Type of route (static, dynamic, etc.) */
	routeType: RouteTypeSchema,
	/** Dynamic segments extracted from the file path */
	dynamicSegments: z.array(z.string()),
	/** Route priority for conflict resolution (lower = higher priority) */
	priority: z.number().int().min(0),
	/** Whether this route is in a private folder */
	isPrivate: z.boolean(),
	/** Route group name if the route is in a group */
	routeGroup: z.string().optional(),
});

/**
 * Route Page Module Schema - Represents the exports from a page file in routing context
 */
export const RoutePageModuleSchema = z.object({
	/** Default export - the page component */
	default: z.any(), // ComponentType<PageProps> - can't validate function types with Zod
	/** Optional layout configuration for this page */
	layoutConfig: z.any().optional(), // LayoutConfig from layout system
	/** Optional metadata generator function */
	generateMetadata: z.any().optional(), // (params: RouteParams) => Promise<Metadata>
	/** Optional data loader function */
	loader: z.any().optional(), // (context: LoaderContext) => Promise<any>
});

/**
 * Route Parameters Schema - Parameters extracted from dynamic routes
 */
export const RouteParamsSchema = z.record(z.string());

/**
 * Loader Context Schema - Context passed to page loaders
 */
export const LoaderContextSchema = z.object({
	/** HTTP request object */
	request: z.instanceof(Request),
	/** URL object for easy access */
	url: z.instanceof(URL),
	/** Route parameters */
	params: RouteParamsSchema,
	/** Query parameters */
	query: z.instanceof(URLSearchParams),
	/** State from middleware */
	state: z.instanceof(Map),
});

/**
 * Page Props Schema - Props passed to page components
 */
export const PagePropsSchema = z.object({
	/** Route parameters */
	params: RouteParamsSchema,
	/** Query parameters */
	query: z.instanceof(URLSearchParams),
	/** Data from loader function */
	data: z.unknown().optional(),
});

/**
 * Metadata Schema - SEO and meta information
 */
export const MetadataSchema = z.object({
	/** Page title */
	title: z.string().optional(),
	/** Page description */
	description: z.string().optional(),
	/** Keywords for SEO */
	keywords: z.array(z.string()).optional(),
	/** Open Graph data */
	openGraph: z
		.object({
			title: z.string().optional(),
			description: z.string().optional(),
			image: z.string().url().optional(),
			url: z.string().url().optional(),
			type: z.string().optional(),
			siteName: z.string().optional(),
		})
		.optional(),
	/** Twitter Card data */
	twitter: z
		.object({
			card: z.enum(['summary', 'summary_large_image', 'app', 'player']).optional(),
			title: z.string().optional(),
			description: z.string().optional(),
			image: z.string().url().optional(),
			creator: z.string().optional(),
			site: z.string().optional(),
		})
		.optional(),
	/** Schema.org structured data */
	schema: z.array(z.record(z.unknown())).optional(),
	/** Canonical URL */
	canonical: z.string().url().optional(),
	/** Robots meta tag */
	robots: z.string().optional(),
});

/**
 * Resolved Metadata Schema - Final merged metadata for a route
 */
export const ResolvedMetadataSchema = MetadataSchema.extend({
	/** Source chain for debugging */
	sources: z.array(z.string()).optional(),
	/** Resolution timestamp */
	resolvedAt: z.number().optional(),
});

/**
 * Metadata Chain Schema - Hierarchical metadata from multiple sources
 */
export const MetadataChainSchema = z.object({
	/** Global metadata */
	global: MetadataSchema.optional(),
	/** Section-specific metadata */
	sections: z.array(
		z.object({
			path: z.string(),
			metadata: MetadataSchema,
		})
	),
	/** Page-specific metadata */
	page: MetadataSchema.optional(),
});

/**
 * Route Discovery Options Schema - Configuration for route discovery
 */
export const RouteDiscoveryOptionsSchema = z.object({
	/** Base directory to scan for pages */
	pagesDirectory: z.string().min(1).default('src/pages'),
	/** Base directory to scan for API routes */
	apiDirectory: z.string().min(1).default('src/api'),
	/** File extensions to include */
	extensions: z.array(z.string()).default(['.tsx', '.ts', '.jsx', '.js']),
	/** Directories to exclude from scanning */
	excludeDirectories: z.array(z.string()).default(['node_modules', '.git']),
	/** Enable file watching for development */
	enableWatching: z.boolean().default(false),
	/** Development mode features */
	developmentMode: z.boolean().default(false),
});

/**
 * File System Router Configuration Schema
 */
export const FileSystemRouterConfigSchema = z.object({
	/** Route discovery options */
	discovery: RouteDiscoveryOptionsSchema.optional(),
	/** Enable file-system routing */
	enabled: z.boolean().default(true),
	/** Fallback to manual routes when file-system routes fail */
	fallbackToManual: z.boolean().default(true),
	/** Cache discovered routes */
	enableCaching: z.boolean().default(true),
	/** Cache TTL in milliseconds */
	cacheTTL: z.number().positive().default(300000), // 5 minutes
});

/**
 * Page File Schema - Information about a discovered page file
 */
export const PageFileSchema = z.object({
	/** Absolute file path */
	filePath: z.string().min(1),
	/** Relative path from pages directory */
	relativePath: z.string().min(1),
	/** File extension */
	extension: z.string().min(1),
	/** Whether file is in a private folder */
	isPrivate: z.boolean(),
	/** Route group if applicable */
	routeGroup: z.string().optional(),
	/** File modification time */
	mtime: z.number().optional(),
});

/**
 * Route Handler Schema - Complete route handler information
 */
export const RouteHandlerSchema = z.object({
	/** Route pattern */
	pattern: z.any(), // URLPattern
	/** Handler function */
	handler: z.any(), // (request: Request, context: any) => Promise<Response>
	/** Route metadata */
	metadata: z.object({
		filePath: z.string(),
		routeType: RouteTypeSchema,
		priority: z.number(),
		dynamicSegments: z.array(z.string()),
	}),
});

/**
 * Route Cache Entry Schema - Cached route information
 */
export const RouteCacheEntrySchema = z.object({
	/** Cached routes */
	routes: z.array(FileSystemRouteSchema),
	/** Cache timestamp */
	timestamp: z.number(),
	/** File modification times for cache invalidation */
	fileMtimes: z.record(z.number()),
});

/**
 * File System API Route Schema - Represents an API endpoint route discovered from file system
 */
export const FileSystemApiRouteSchema = z.object({
	/** URL pattern for the API endpoint */
	pattern: z.any(), // URLPattern
	/** File path to the API handler */
	filePath: z.string().min(1),
	/** HTTP methods supported */
	methods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])),
	/** Route priority */
	priority: z.number().int().min(0),
	/** Dynamic segments */
	dynamicSegments: z.array(z.string()),
});

/**
 * File System API Module Schema - Exports from an API route file
 */
export const FileSystemApiModuleSchema = z.object({
	/** GET handler */
	GET: z.any().optional(), // (request: Request, context: any) => Promise<Response>
	/** POST handler */
	POST: z.any().optional(),
	/** PUT handler */
	PUT: z.any().optional(),
	/** DELETE handler */
	DELETE: z.any().optional(),
	/** PATCH handler */
	PATCH: z.any().optional(),
	/** HEAD handler */
	HEAD: z.any().optional(),
	/** OPTIONS handler */
	OPTIONS: z.any().optional(),
});

// === TypeScript Type Definitions ===

export type RouteType = z.infer<typeof RouteTypeSchema>;
export type FileSystemRoute = z.infer<typeof FileSystemRouteSchema>;
export type RoutePageModule = z.infer<typeof RoutePageModuleSchema>;
export type RouteParams = z.infer<typeof RouteParamsSchema>;
export type LoaderContext = z.infer<typeof LoaderContextSchema>;
export type PageProps = z.infer<typeof PagePropsSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
export type ResolvedMetadata = z.infer<typeof ResolvedMetadataSchema>;
export type MetadataChain = z.infer<typeof MetadataChainSchema>;
export type RouteDiscoveryOptions = z.infer<typeof RouteDiscoveryOptionsSchema>;
export type FileSystemRouterConfig = z.infer<typeof FileSystemRouterConfigSchema>;
export type PageFile = z.infer<typeof PageFileSchema>;
export type RouteHandler = z.infer<typeof RouteHandlerSchema>;
export type RouteCacheEntry = z.infer<typeof RouteCacheEntrySchema>;
export type FileSystemApiRoute = z.infer<typeof FileSystemApiRouteSchema>;
export type FileSystemApiModule = z.infer<typeof FileSystemApiModuleSchema>;

// === Function Type Definitions ===

/**
 * Page Component Type
 */
export type PageComponent<P extends PageProps = PageProps> = ComponentType<P>;

/**
 * Metadata Generator Function Type
 */
export type MetadataGenerator = (params: RouteParams) => Promise<Metadata>;

/**
 * Page Loader Function Type
 */
export type PageLoader = (context: LoaderContext) => Promise<unknown>;

/**
 * Route Handler Function Type
 */
export type RouteHandlerFunction = (request: Request, context: LoaderContext) => Promise<Response>;

/**
 * File System API Handler Function Type
 */
export type FileSystemApiHandler = (request: Request, context: LoaderContext) => Promise<Response>;

// === Helper Functions for Type Safety ===

/**
 * Create a typed page component with parameter validation
 */
export function createTypedPageComponent<TRoute extends string>(
	component: TypedPageComponent<TRoute>,
	expectedParams: (keyof RouteParameters<TRoute>)[]
): TypedPageComponent<TRoute> {
	return (props: { params: RouteParameters<TRoute>; query: URLSearchParams; data?: unknown }) => {
		// Validate props in development
		if (typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development') {
			if (!isValidPageProps<TRoute>(props, expectedParams)) {
				console.warn('Invalid props passed to typed page component:', props);
			}
		}

		return component(props);
	};
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
		if (typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development') {
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
		if (typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development') {
			if (!isValidRouteParams<TRoute>(context.params, expectedParams)) {
				console.warn('Invalid params passed to typed page loader:', context.params);
			}
		}

		return await loader(context);
	};
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
		if (typeof Deno !== 'undefined' && Deno.env.get('NODE_ENV') === 'development') {
			if (!isValidRouteParams<TRoute>(context.params, expectedParams)) {
				console.warn('Invalid params passed to typed API handler:', context.params);
			}
		}

		return await handler(request, context);
	};
}

// === Type Guards ===

/**
 * Type guard for FileSystemRoute
 */
export function isFileSystemRoute(data: unknown): data is FileSystemRoute {
	return FileSystemRouteSchema.safeParse(data).success;
}

/**
 * Type guard for RoutePageModule
 */
export function isRoutePageModule(data: unknown): data is RoutePageModule {
	return RoutePageModuleSchema.safeParse(data).success;
}

/**
 * Type guard for Metadata
 */
export function isMetadata(data: unknown): data is Metadata {
	return MetadataSchema.safeParse(data).success;
}

/**
 * Type guard for RouteParams
 */
export function isRouteParams(data: unknown): data is RouteParams {
	return RouteParamsSchema.safeParse(data).success;
}

/**
 * Type guard for FileSystemApiModule
 */
export function isFileSystemApiModule(data: unknown): data is FileSystemApiModule {
	return FileSystemApiModuleSchema.safeParse(data).success;
}

/**
 * Type guard for route parameters with expected parameter validation
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
	// Check for empty brackets first
	if (pattern.includes('[]')) {
		return false;
	}

	// Check for valid bracket syntax
	const bracketRegex = /\[([^\]]+)\]/g;
	const matches = pattern.match(bracketRegex);

	if (matches) {
		for (const match of matches) {
			const param = match.slice(1, -1); // Remove brackets

			// Check for empty parameter
			if (param.length === 0) {
				return false;
			}

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

			// Check for empty group
			if (group.length === 0) {
				return false;
			}

			// Check for valid group names
			if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(group)) {
				return false;
			}
		}
	}

	return true;
}

/**
 * Validate component accepts correct props for a route
 */
export function validatePageComponent<TRoute extends string>(
	component: ComponentType<any>,
	expectedParams: (keyof RouteParameters<TRoute>)[]
): component is TypedPageComponent<TRoute> {
	// In TypeScript, we can't really validate function signatures at runtime
	// This is more of a development-time helper
	if (typeof component !== 'function') {
		return false;
	}

	// Could add more sophisticated validation in development mode
	return true;
}

// === Enhanced Utility Types ===

/**
 * Extract route parameters from a route pattern
 */
export type ExtractRouteParams<T extends string> = T extends `${string}[${infer Param}]${infer Rest}`
	? Param extends `...${infer RestParam}`
		? { [K in RestParam]: string[] } & ExtractRouteParams<Rest>
		: Param extends `${infer OptionalParam}?`
		? { [K in OptionalParam]?: string } & ExtractRouteParams<Rest>
		: { [K in Param]: string } & ExtractRouteParams<Rest>
	: {};

/**
 * Extract optional route parameters from a route pattern
 */
export type ExtractOptionalParams<T extends string> = T extends `${string}[[${infer Param}]]${infer Rest}`
	? Param extends `...${infer RestParam}`
		? { [K in RestParam]?: string[] } & ExtractOptionalParams<Rest>
		: { [K in Param]?: string } & ExtractOptionalParams<Rest>
	: {};

/**
 * Combine required and optional route parameters
 */
export type RouteParameters<T extends string> = ExtractRouteParams<T> & ExtractOptionalParams<T>;

/**
 * Page component with typed params
 */
export type TypedPageComponent<T extends string> = (props: {
	params: RouteParameters<T>;
	query: URLSearchParams;
	data?: unknown;
}) => any;

/**
 * Page component with custom data type
 */
export type TypedPageComponentWithData<T extends string, TData> = (props: {
	params: RouteParameters<T>;
	query: URLSearchParams;
	data?: TData;
}) => any;

/**
 * Typed metadata generator
 */
export type TypedMetadataGenerator<T extends string> = (params: RouteParameters<T>) => Promise<Metadata>;

/**
 * Typed page loader
 */
export type TypedPageLoader<T extends string, TData = unknown> = (
	context: LoaderContext & { params: RouteParameters<T> }
) => Promise<TData>;

/**
 * Typed API handler
 */
export type TypedApiHandler<T extends string> = (
	request: Request,
	context: LoaderContext & { params: RouteParameters<T> }
) => Promise<Response>;

/**
 * Typed API module with all HTTP methods
 */
export type TypedApiModule<T extends string> = {
	GET?: TypedApiHandler<T>;
	POST?: TypedApiHandler<T>;
	PUT?: TypedApiHandler<T>;
	DELETE?: TypedApiHandler<T>;
	PATCH?: TypedApiHandler<T>;
	HEAD?: TypedApiHandler<T>;
	OPTIONS?: TypedApiHandler<T>;
};

// === Route Analysis Types ===

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
 * Count dynamic segments in a route
 */
export type CountDynamicSegments<
	T extends string,
	Count extends readonly unknown[] = []
> = T extends `${string}[${string}]${infer Rest}` ? CountDynamicSegments<Rest, [...Count, unknown]> : Count['length'];

// === Validation Types ===

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
 * Component prop validation
 */
export interface PageComponentProps<TRoute extends string = string, TData = unknown> {
	params: RouteParameters<TRoute>;
	query: URLSearchParams;
	data?: TData;
}
