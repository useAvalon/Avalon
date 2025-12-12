import { z } from 'zod';

/**
 * Middleware context interface - provides request/response context and state passing
 * Requirements: 4.1, 4.2
 */
export interface MiddlewareContext {
	/** HTTP request object */
	request: Request;
	/** URL object for easy access to pathname, search params, etc */
	url: URL;
	/** Route parameters extracted from dynamic routes */
	params: Record<string, string>;
	/** Query parameters from URL search params */
	query: Record<string, string | string[]>;
	/** State map for passing data between middleware */
	state: Map<string, unknown>;
	/** Locals object for middleware-specific data storage */
	locals: Record<string, unknown>;
}

/**
 * Middleware response interface - controls middleware chain execution
 * Requirements: 4.4, 4.5
 */
export interface MiddlewareResponse {
	/** Optional response to return (stops chain if provided) */
	response?: Response;
	/** Whether to continue to next middleware */
	continue: boolean;
}

/**
 * Middleware handler function signature
 * Requirements: 7.1, 7.2 (supports both sync and async operations)
 */
export type MiddlewareHandler = (
	context: MiddlewareContext,
	next: () => Promise<MiddlewareResponse>
) => Promise<MiddlewareResponse>;

/**
 * Middleware route configuration for discovery system
 */
export interface MiddlewareRoute {
	/** URL pattern for matching requests */
	pattern: URLPattern;
	/** File path to the middleware file */
	middlewarePath: string;
	/** Execution priority (lower numbers execute first) */
	priority: number;
	/** Middleware type for categorization */
	type: 'global' | 'pages' | 'api';
}

/**
 * Middleware chain data structure
 */
export interface MiddlewareChain {
	/** Global middleware handlers */
	global: MiddlewareHandler[];
	/** Scoped middleware handlers (pages or api specific) */
	scoped: MiddlewareHandler[];
	/** Route pattern this chain applies to */
	route: string;
	/** Total number of middleware in the chain */
	totalMiddleware: number;
}

/**
 * Middleware configuration options
 */
export interface MiddlewareConfig {
	/** Enable development mode features like hot reloading */
	developmentMode?: boolean;
	/** Enable detailed logging */
	enableLogging?: boolean;
	/** Maximum execution time for middleware chain (ms) */
	maxExecutionTime?: number;
	/** Custom error handler */
	errorHandler?: MiddlewareErrorHandler;
}

/**
 * Middleware error handler interface
 */
export interface MiddlewareErrorHandler {
	/** Handle discovery errors (file system issues, invalid middleware files) */
	handleDiscoveryError(error: Error, filePath: string): void;
	/** Handle execution errors (runtime errors in middleware functions) */
	handleExecutionError(error: Error, middleware: string, context: MiddlewareContext): Response;
	/** Handle chain errors (broken middleware chains, infinite loops) */
	handleChainError(error: Error, chain: MiddlewareChain): Response;
}

/**
 * Middleware execution result
 */
export interface MiddlewareExecutionResult {
	/** Final response from middleware chain */
	response?: Response;
	/** Modified context after middleware execution */
	context: MiddlewareContext;
	/** Execution metadata */
	metadata: {
		/** Number of middleware executed */
		middlewareExecuted: number;
		/** Total execution time in milliseconds */
		executionTime: number;
		/** Whether chain was terminated early */
		earlyTermination: boolean;
		/** Error that occurred during execution (if any) */
		error?: Error;
	};
}

/**
 * Middleware discovery options
 */
export interface MiddlewareDiscoveryOptions {
	/** Base directory to scan for middleware files */
	baseDirectory: string;
	/** File pattern to match middleware files */
	filePattern: string;
	/** Enable file watching for hot reloading */
	enableWatching?: boolean;
	/** Directories to exclude from scanning */
	excludeDirectories?: string[];
}

// === Zod Schemas for Runtime Validation ===

/**
 * Schema for middleware context validation
 */
export const MiddlewareContextSchema = z.object({
	request: z.any(), // Request object
	url: z.any(), // URL object
	params: z.record(z.string()),
	query: z.record(z.union([z.string(), z.array(z.string())])),
	state: z.any(), // Map object
	locals: z.record(z.unknown()),
});

/**
 * Schema for middleware response validation
 */
export const MiddlewareResponseSchema = z.object({
	response: z.any().optional(), // Response object
	continue: z.boolean(),
});

/**
 * Schema for middleware route validation
 */
export const MiddlewareRouteSchema = z.object({
	pattern: z.any(), // URLPattern object
	middlewarePath: z.string(),
	priority: z.number(),
	type: z.enum(['global', 'pages', 'api']),
});

/**
 * Schema for middleware chain validation
 */
export const MiddlewareChainSchema = z.object({
	global: z.array(z.function()),
	scoped: z.array(z.function()),
	route: z.string(),
	totalMiddleware: z.number(),
});

/**
 * Schema for middleware configuration validation
 */
export const MiddlewareConfigSchema = z.object({
	developmentMode: z.boolean().optional(),
	enableLogging: z.boolean().optional(),
	maxExecutionTime: z.number().positive().optional(),
	errorHandler: z.any().optional(), // MiddlewareErrorHandler interface
});

/**
 * Schema for middleware discovery options validation
 */
export const MiddlewareDiscoveryOptionsSchema = z.object({
	baseDirectory: z.string(),
	filePattern: z.string(),
	enableWatching: z.boolean().optional(),
	excludeDirectories: z.array(z.string()).optional(),
});

// === Type Guards ===

/**
 * Type guard for middleware context
 */
export function isMiddlewareContext(data: unknown): data is MiddlewareContext {
	return MiddlewareContextSchema.safeParse(data).success;
}

/**
 * Type guard for middleware response
 */
export function isMiddlewareResponse(data: unknown): data is MiddlewareResponse {
	return MiddlewareResponseSchema.safeParse(data).success;
}

/**
 * Type guard for middleware route
 */
export function isMiddlewareRoute(data: unknown): data is MiddlewareRoute {
	return MiddlewareRouteSchema.safeParse(data).success;
}

/**
 * Type guard for middleware chain
 */
export function isMiddlewareChain(data: unknown): data is MiddlewareChain {
	return MiddlewareChainSchema.safeParse(data).success;
}

// === Utility Types ===

/**
 * Extract middleware handler from middleware file export
 */
export type MiddlewareFileExport = {
	default: MiddlewareHandler;
};

/**
 * Middleware execution context with additional metadata
 */
export type MiddlewareExecutionContext = MiddlewareContext & {
	/** Current middleware index in chain */
	currentIndex: number;
	/** Total middleware count in chain */
	totalCount: number;
	/** Execution start time */
	startTime: number;
};

/**
 * Middleware chain builder function type
 */
export type MiddlewareChainBuilder = (url: URL) => Promise<MiddlewareHandler[]>;

/**
 * Middleware file watcher callback type
 */
export type MiddlewareWatcherCallback = (filePath: string, event: 'add' | 'change' | 'unlink') => void;
