/**
 * Nitro API Handler Factory for Avalon
 *
 * This module provides the API handler factory for Nitro integration.
 * It creates Nitro event handlers from Avalon API route configurations,
 * supporting method-specific handlers, parameter extraction, and response handling.
 *
 * SIMPLIFIED: This module now delegates route matching and parameter extraction
 * to Nitro's built-in h3 utilities. Custom route pattern matching has been removed
 * in favor of Nitro's native file-system routing.
 *
 * Middleware Integration:
 * - Global middleware runs first (handled by Nitro's middleware/ directory)
 * - Route-scoped middleware runs after global middleware, before API handler execution
 * - If global middleware terminates, route-scoped middleware does not run
 *
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.6
 */

import type { H3Event, NitroApiContext, HttpError } from './types.ts';
import { createMethodNotAllowedError, isHttpError } from './types.ts';
import type { ApiRouteConfig, ApiContext, ApiMethod, ApiHandler } from '../schemas/api.ts';
import type { MiddlewareRoute } from '../middleware/types.ts';
import type { H3Event as H3EventFull } from 'h3';
import { getRequestURL as h3GetRequestURL } from 'h3';
import { discoverScopedMiddleware, executeScopedMiddleware } from '../middleware/index.ts';

/**
 * Supported HTTP methods for API routes
 */
const SUPPORTED_METHODS: ApiMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

/**
 * Options for creating an API handler
 */
export interface CreateApiHandlerOptions {
	/** Whether running in development mode */
	isDev?: boolean;
	/** Custom error handler */
	onError?: (error: Error, context: NitroApiContext) => Response | Promise<Response>;
	/** Base directory for middleware discovery (e.g., 'src') */
	baseDir?: string;
	/** Pre-discovered middleware routes (for performance) */
	middlewareRoutes?: MiddlewareRoute[];
}

/**
 * Gets the request URL from an H3 event
 * Requirements: 3.4
 */
export function getRequestURL(event: H3Event): URL {
	// Use h3's getRequestURL for h3 v2 compatibility
	const protocol = 'http';
	const host = 'localhost';
	return new URL(h3GetRequestURL(event).pathname, `${protocol}://${host}`);
}

/**
 * Gets request headers from an H3 event
 */
export function getRequestHeaders(event: H3Event): Headers {
	const headers = new Headers();
	// In a real Nitro environment, headers come from the underlying node request
	const nodeReq = event.node?.req as { headers?: Record<string, string | string[] | undefined> } | undefined;
	if (nodeReq?.headers) {
		for (const [key, value] of Object.entries(nodeReq.headers)) {
			if (value) {
				if (Array.isArray(value)) {
					value.forEach(v => headers.append(key, v));
				} else {
					headers.set(key, value);
				}
			}
		}
	}
	return headers;
}

/**
 * Converts an H3 event to a standard Request object
 * Requirements: 3.4
 */
export function toRequest(event: H3Event): Request {
	const url = getRequestURL(event);
	const method = event.method.toUpperCase();

	// For methods that can have a body, we need to handle it
	// In a real Nitro environment, this would use h3's readBody
	const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(method);

	return new Request(url, {
		method,
		headers: getRequestHeaders(event),
		// Body handling would be done via h3's readBody in real implementation
		body: hasBody ? null : undefined,
	});
}

/**
 * Extracts route parameters from an H3 event
 *
 * SIMPLIFIED: This function now delegates to Nitro's h3 router.
 * Parameters are stored in event.context.params by Nitro's file-system router.
 *
 * For dynamic segments like [id] or catch-all [...slug], Nitro automatically
 * extracts and provides the values via event.context.params.
 *
 * Requirements: 1.3, 3.3
 *
 * @param event - The H3 event
 * @returns Record of parameter names to values
 */
export function getRouterParams(event: H3Event): Record<string, string> {
	// Nitro's h3 router stores extracted parameters in event.context.params
	// This is populated automatically by Nitro's file-system routing
	const params = event.context.params as Record<string, string> | undefined;
	return params ?? {};
}

/**
 * Gets a single router parameter from an H3 event
 *
 * This is a convenience wrapper that mirrors h3's getRouterParam function.
 * In production, handlers should use h3's getRouterParam directly.
 *
 * Requirements: 1.3, 3.3
 *
 * @param event - The H3 event
 * @param name - The parameter name
 * @returns The parameter value or undefined
 */
export function getRouterParam(event: H3Event, name: string): string | undefined {
	const params = getRouterParams(event);
	return params[name];
}

/**
 * Extracts query parameters from an H3 event
 * Requirements: 3.4
 *
 * @param event - The H3 event
 * @returns Record of query parameter names to values (string or string[])
 */
export function getQuery(event: H3Event): Record<string, string | string[]> {
	const url = getRequestURL(event);
	const query: Record<string, string | string[]> = {};

	for (const [key, value] of url.searchParams.entries()) {
		if (query[key]) {
			// If key already exists, convert to array or add to existing array
			if (Array.isArray(query[key])) {
				query[key].push(value);
			} else {
				query[key] = [query[key], value];
			}
		} else {
			query[key] = value;
		}
	}

	return query;
}

/**
 * Creates an API context from an H3 event
 * Requirements: 3.4
 *
 * @param event - The H3 event
 * @returns NitroApiContext for use in API handlers
 */
export function createApiContext(event: H3Event): NitroApiContext {
	const url = getRequestURL(event);
	const params = getRouterParams(event);
	const query = getQuery(event);

	// Get middleware context if available
	const avalonContext = event.context.avalon as
		| {
				middlewareContext?: {
					state?: Map<string, unknown>;
					locals?: Record<string, unknown>;
				};
		  }
		| undefined;

	return {
		request: toRequest(event),
		url,
		params,
		query,
		state: avalonContext?.middlewareContext?.state,
		locals: avalonContext?.middlewareContext?.locals,
		event,
	};
}

/**
 * Handles the response from an API handler
 * Requirements: 3.5, 3.6
 *
 * - If the handler returns a Response object, pass it through unchanged
 * - If the handler returns a plain object, serialize it as JSON
 * - If the handler returns null/undefined, return 204 No Content
 *
 * @param result - The result from the API handler
 * @returns Response object
 */
export function handleApiResponse(result: unknown): Response {
	// If it's already a Response, pass through unchanged
	if (result instanceof Response) {
		return result;
	}

	// If null or undefined, return 204 No Content
	if (result === null || result === undefined) {
		return new Response(null, { status: 204 });
	}

	// For plain objects, serialize as JSON
	if (typeof result === 'object') {
		return new Response(JSON.stringify(result, null, 0), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	// For primitives (string, number, boolean, bigint), convert to string
	if (
		typeof result === 'string' ||
		typeof result === 'number' ||
		typeof result === 'boolean' ||
		typeof result === 'bigint'
	) {
		return new Response(String(result), {
			status: 200,
			headers: { 'Content-Type': 'text/plain' },
		});
	}

	return new Response(null, { status: 204 });
}

/**
 * Creates an error response for API errors
 * Requirements: 3.6
 *
 * @param error - The error that occurred
 * @param isDev - Whether running in development mode
 * @returns Response object with error details
 */
export function createApiErrorResponse(error: Error | HttpError, isDev: boolean): Response {
	const statusCode = isHttpError(error) ? error.statusCode : 500;
	const data = isHttpError(error) ? error.data : undefined;

	const body = isDev
		? {
				error: error.message,
				stack: error.stack,
				...(data && { data }),
			}
		: {
				error: statusCode === 500 ? 'Internal Server Error' : error.message,
				...(data && { data }),
			};

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};

	// Add Allow header for 405 Method Not Allowed
	if (statusCode === 405 && data?.allowed) {
		headers['Allow'] = (data.allowed as string[]).join(', ');
	}

	return new Response(JSON.stringify(body), {
		status: statusCode,
		headers,
	});
}

/**
 * Gets the allowed methods from an API route config
 *
 * @param config - The API route configuration
 * @returns Array of allowed HTTP methods
 */
export function getAllowedMethods(config: ApiRouteConfig): ApiMethod[] {
	// If config is a function, it handles all methods
	if (typeof config === 'function') {
		return [...SUPPORTED_METHODS];
	}

	// Otherwise, get the methods that have handlers defined
	return SUPPORTED_METHODS.filter(method => typeof config[method] === 'function');
}

/**
 * Creates a Nitro event handler from an Avalon API route configuration
 *
 * SIMPLIFIED: This function now relies on Nitro's built-in file-system routing
 * for route matching and parameter extraction. Custom route pattern matching
 * has been removed.
 *
 * This function:
 * 1. Executes route-scoped middleware for API routes
 * 2. Creates an API context from the H3 event (with params from Nitro's router)
 * 3. Routes to the appropriate method handler
 * 4. Handles response serialization
 * 5. Handles errors appropriately
 *
 * Middleware execution order:
 * 1. Global middleware (from middleware/ directory) - handled by Nitro
 * 2. Route-scoped middleware (from src/api/_middleware.ts files) - handled here
 * 3. API handler execution
 *
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.6
 *
 * @param config - The API route configuration (single handler or method-specific handlers)
 * @param options - Handler options
 * @returns Handler function for Nitro
 */
export function createApiHandler(
	config: ApiRouteConfig,
	options: CreateApiHandlerOptions = {},
): (event: H3Event) => Promise<Response> {
	const { isDev = false, onError, baseDir = 'src', middlewareRoutes: preloadedRoutes } = options;

	// Middleware routes cache - discovered once at startup or use preloaded routes
	let scopedMiddlewareRoutes: MiddlewareRoute[] | null = preloadedRoutes || null;

	/**
	 * Gets scoped middleware routes, discovering them on first call
	 * Routes are cached for performance in production
	 */
	async function getScopedMiddleware(): Promise<MiddlewareRoute[]> {
		scopedMiddlewareRoutes ??= await discoverScopedMiddleware({
			baseDir,
			devMode: isDev,
		});
		return scopedMiddlewareRoutes;
	}

	return async function apiHandler(event: H3Event): Promise<Response> {
		const method = event.method.toUpperCase() as ApiMethod;

		try {
			// Execute route-scoped middleware before API handler
			// Global middleware has already run (handled by Nitro's middleware/ directory)
			// Requirements: 3.2
			const middlewareRoutes = await getScopedMiddleware();
			const middlewareResponse = await executeScopedMiddleware(event as unknown as H3EventFull, middlewareRoutes, {
				devMode: isDev,
			});

			// If middleware returned a response, use it and skip API handler
			if (middlewareResponse) {
				if (isDev) {
					console.log(
						`[api] Middleware terminated request for ${h3GetRequestURL(event as unknown as H3EventFull).pathname}`,
					);
				}
				return middlewareResponse;
			}

			// Create API context compatible with existing handlers
			// Parameters are extracted by Nitro's router and available in event.context.params
			const context = createApiContext(event);

			// Handle single handler function (handles all methods)
			if (typeof config === 'function') {
				const result = await config(context);
				return handleApiResponse(result);
			}

			// Handle method-specific handlers
			const handler = config[method] satisfies ApiHandler | undefined;

			if (!handler) {
				// Method not allowed - return 405 with allowed methods
				const allowedMethods = getAllowedMethods(config);
				const error = createMethodNotAllowedError(allowedMethods);
				return createApiErrorResponse(error, isDev);
			}

			// Execute the handler
			const result = await handler(context);
			return handleApiResponse(result);
		} catch (error) {
			console.error('[API Error]', error);

			const err = error instanceof Error ? error : new Error(String(error));

			// Use custom error handler if provided
			if (onError) {
				try {
					const context = createApiContext(event);
					return await onError(err, context);
				} catch (handlerError) {
					console.error('[API Error Handler Error]', handlerError);
					// Fall through to default error handling
				}
			}

			return createApiErrorResponse(err, isDev);
		}
	};
}

/**
 * Type guard to check if a value is a valid API method
 */
export function isValidApiMethod(method: string): method is ApiMethod {
	return SUPPORTED_METHODS.includes(method.toUpperCase() as ApiMethod);
}

/**
 * Re-export middleware cache clearing for hot reload support
 *
 * Call this function when middleware files change during development
 * to ensure the latest version is loaded on the next request.
 *
 * @example
 * ```ts
 * // In your HMR handler
 * if (file.endsWith('_middleware.ts')) {
 *   clearApiMiddlewareCache();
 * }
 * ```
 */
export { clearMiddlewareCache as clearApiMiddlewareCache } from '../middleware/index.ts';

// ============================================================================
// REMOVED FUNCTIONS (now handled by Nitro's built-in routing):
// ============================================================================
// - extractParamNames: Nitro extracts params from [param] and [...slug] syntax
// - filePathToRoutePattern: Nitro handles file-to-route conversion
// - matchRoutePattern: Nitro's h3 router handles route matching
// ============================================================================
