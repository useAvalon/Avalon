import type { ComponentType } from "preact/compat";
import { z } from "zod";

/**
 * Route Type Schema - Defines the different types of routes supported
 */
export const RouteTypeSchema = z.enum(["static", "dynamic", "catch-all", "index", "group"]);

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
	/** Optional frontmatter data from MDX files */
	frontmatter: z.record(z.string(), z.any()).optional(), // Frontmatter metadata from MDX files
});

/**
 * Route Parameters Schema - Parameters extracted from dynamic routes
 */
export const RouteParamsSchema = z.record(z.string(), z.string());

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
			image: z.url().optional(),
			url: z.url().optional(),
			type: z.string().optional(),
			siteName: z.string().optional(),
		})
		.optional(),
	/** Twitter Card data */
	twitter: z
		.object({
			card: z.enum(["summary", "summary_large_image", "app", "player"]).optional(),
			title: z.string().optional(),
			description: z.string().optional(),
			image: z.url().optional(),
			site: z.string().optional(),
		})
		.optional(),
	/** Schema.org structured data */
	schema: z.array(z.record(z.string(), z.unknown())).optional(),
	/** Canonical URL */
	canonical: z.url().optional(),
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
		}),
	),
	/** Page-specific metadata */
	page: MetadataSchema.optional(),
});

/**
 * Route Discovery Options Schema - Configuration for route discovery
 */
export const RouteDiscoveryOptionsSchema = z.object({
	/** Base directory to scan for pages */
	pagesDirectory: z.string().min(1).default("src/pages"),
	/** Base directory to scan for API routes */
	apiDirectory: z.string().min(1).default("src/api"),
	/** File extensions to include */
	extensions: z.array(z.string()).default([".tsx", ".ts", ".jsx", ".js"]),
	/** Directories to exclude from scanning */
	excludeDirectories: z.array(z.string()).default(["node_modules", ".git"]),
	/** Enable file watching for development */
	enableWatching: z.boolean().default(false),
	/** Development mode features */
	developmentMode: z.boolean().default(false),
	/** Quiet mode - suppress verbose logging */
	quietMode: z.boolean().default(false),
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
	handler: z.any(), // (request: Request, context: LoaderContext) => Promise<Response>
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
	fileMtimes: z.record(z.string(), z.number()),
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
	methods: z.array(z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])),
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

// === Re-exports from types/routing.ts (single source of truth) ===

export type {
	CountDynamicSegments,
	ExtractOptionalParams,
	ExtractRouteParams,
	HasCatchAllSegments,
	HasDynamicSegments,
	HasOptionalSegments,
	PageComponentProps,
	RouteParameters,
	TypedApiHandler,
	TypedApiModule,
	TypedMetadataGenerator,
	TypedPageComponent,
	TypedPageComponentWithData,
	TypedPageLoader,
	ValidRouteExtension,
	ValidRoutePattern,
} from "../types/routing.ts";

export {
	createTypedApiHandler,
	createTypedMetadataGenerator,
	createTypedPageComponent,
	createTypedPageLoader,
	isValidPageProps,
	isValidRouteParams,
	isValidRoutePattern,
	validatePageComponent,
} from "../types/routing.ts";
