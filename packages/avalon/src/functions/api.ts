import type { ApiRoute, ApiContext, ApiMethod } from '../schemas/api.ts';
import type { MiddlewareContext } from '../nitro/middleware-adapter.ts';
import { methodNotAllowed } from '../core/api/api.ts';



/**
 * Convert file path to URL path
 * Examples:
 * - users.ts -> /users
 * - users/[id].ts -> /users/:id
 * - users/[id]/posts.ts -> /users/:id/posts
 * - [...slug].ts -> /*slug
 */
function filePathToUrlPath(filePath: string) {
	// Remove file extension
	let urlPath = filePath.replace(/\.(ts|tsx|js)$/, '');

	// Handle index files
	if (urlPath.endsWith('/index') || urlPath === 'index') {
		urlPath = urlPath.replace(/\/index$|^index$/, '');
	}

	// Convert dynamic segments
	// [param] -> :param
	urlPath = urlPath.replaceAll(/\[([^\]]+)\]/g, ':$1');

	// Convert catch-all segments
	// [...param] -> *param
	urlPath = urlPath.replaceAll(/:\.\.\.([^/]+)/g, '*$1');

	// Ensure leading slash
	if (!urlPath.startsWith('/')) {
		urlPath = '/' + urlPath;
	}

	// Handle root index case
	if (urlPath === '/') {
		return '/';
	}

	return urlPath;
}

/**
 * Create URLPattern and extract parameter names
 */
function createUrlPattern(urlPath: string) {
	const paramNames: string[] = [];

	// Extract parameter names from the path
	const paramMatches = urlPath.match(/:([^/]+)/g);
	if (paramMatches) {
		for (const match of paramMatches) {
			paramNames.push(match.substring(1)); // Remove ':' prefix
		}
	}

	// Handle catch-all parameters
	const catchAllMatches = urlPath.match(/\*([^/]+)/g);
	if (catchAllMatches) {
		for (const match of catchAllMatches) {
			paramNames.push(match.substring(1)); // Remove '*' prefix
		}
	}

	// Convert to URLPattern syntax
	let patternPath = urlPath;

	// Convert :param to :param
	patternPath = patternPath.replaceAll(/:([^/]+)/g, ':$1');

	// Convert *param to *
	patternPath = patternPath.replaceAll(/\*[^/]+/g, '*');

	const pattern = new URLPattern({
		pathname: '/api' + patternPath,
	});

	return { pattern, paramNames };
}

/**
 * Extract parameters from matched URL
 */
function extractParams(pattern: URLPattern, url: URL, paramNames: string[]) {
	const params: Record<string, string> = {};

	const result = pattern.exec(url);
	if (result?.pathname?.groups) {
		// Map URLPattern groups to our parameter names
		const groups = result.pathname.groups;
		let paramIndex = 0;

		for (const [key, value] of Object.entries(groups)) {
			if (key !== '0' && value !== undefined) {
				// Skip full match
				if (paramIndex < paramNames.length) {
					params[paramNames[paramIndex]] = value;
					paramIndex++;
				}
			}
		}
	}

	return params;
}

/**
 * Handle API request with middleware support
 *
 * @param request - The HTTP request object
 * @param routes - Array of discovered API routes
 * @param middlewareContext - Optional middleware context from middleware execution
 * @returns Response object
 *
 * Requirements: 3.1, 3.3, 3.4, 5.2
 */
export async function handleApiRequest(
	request: Request,
	routes: ApiRoute[],
	middlewareContext?: MiddlewareContext
): Promise<Response> {
	const url = new URL(request.url);

	// Find matching route
	const matchedRoute = routes.find(route => route.pattern.test(url));

	if (!matchedRoute) {
		return new Response(JSON.stringify({ error: 'API route not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	// Extract parameters - prioritize middleware context over fresh extraction
	// This ensures middleware-processed parameters (e.g., validated, transformed) are used
	const params = middlewareContext?.params || extractParams(matchedRoute.pattern, url, matchedRoute.paramNames);

	// Parse query parameters - prioritize middleware context over fresh parsing
	// This ensures middleware-processed query params (e.g., validated, transformed) are used
	const query = middlewareContext?.query || parseQueryParameters(url);

	// Create API context with middleware integration
	const context: ApiContext = {
		request: middlewareContext?.request || request, // Use middleware-processed request if available
		url: middlewareContext?.url || url, // Use middleware-processed URL if available
		params,
		query,
		// Include middleware state and locals for API handlers to access
		...(middlewareContext && {
			state: middlewareContext.state,
			locals: middlewareContext.locals,
		}),
	};

	try {
		const { config } = matchedRoute;

		// Handle single handler function
		if (typeof config === 'function') {
			return await config(context);
		}

		// Handle method-specific handlers
		const method = request.method as ApiMethod;
		const handler = config[method];

		if (!handler) {
			// Method not allowed - return available methods
			const allowedMethods = Object.keys(config).filter(key => config[key as ApiMethod]);
			return methodNotAllowed(allowedMethods);
		}

		return await handler(context);
	} catch (error) {
		console.error('API route error:', error);

		// Enhanced error handling with middleware context information
		const errorResponse: Record<string, unknown> = {
			error: 'Internal Server Error',
		};

		// Add development mode details if available
		if (middlewareContext?.locals?.developmentMode) {
			errorResponse.details = error instanceof Error ? error.message : String(error);
			errorResponse.route = matchedRoute.filePath;
		}

		return new Response(JSON.stringify(errorResponse), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
}

/**
 * Parse query parameters from URL
 * Handles multiple values for the same parameter
 */
function parseQueryParameters(url: URL) {
	const query: Record<string, string | string[]> = {};

	for (const [key, value] of url.searchParams.entries()) {
		const existing = query[key];
		if (existing) {
			// Convert to array if multiple values exist
			if (Array.isArray(existing)) {
				existing.push(value);
			} else {
				query[key] = [existing, value];
			}
		} else {
			query[key] = value;
		}
	}

	return query;
}
