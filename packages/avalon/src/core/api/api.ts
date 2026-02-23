/**
 * API utilities for creating consistent responses
 * Provides helpers similar to Next.js API utilities
 */

export interface ApiResponseOptions {
	status?: number;
	headers?: HeadersInit;
}

/**
 * Create a JSON response with proper headers
 */
export function json(data: unknown, options: ApiResponseOptions = {}): Response {
	const { status = 200, headers = {} } = options;

	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...headers,
		},
	});
}

/**
 * Create a text response
 */
export function text(data: string, options: ApiResponseOptions = {}): Response {
	const { status = 200, headers = {} } = options;

	return new Response(data, {
		status,
		headers: {
			'Content-Type': 'text/plain',
			...headers,
		},
	});
}

/**
 * Create an HTML response
 */
export function html(data: string, options: ApiResponseOptions = {}): Response {
	const { status = 200, headers = {} } = options;

	return new Response(data, {
		status,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			...headers,
		},
	});
}

/**
 * Create a redirect response
 */
export function redirect(url: string, status = 302): Response {
	return new Response(null, {
		status,
		headers: {
			Location: url,
		},
	});
}

/**
 * Create a 404 Not Found response
 */
export function notFound(message = 'Not Found'): Response {
	return json({ error: message }, { status: 404 });
}

/**
 * Create a 400 Bad Request response
 */
export function badRequest(message = 'Bad Request'): Response {
	return json({ error: message }, { status: 400 });
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorized(message = 'Unauthorized'): Response {
	return json({ error: message }, { status: 401 });
}

/**
 * Create a 403 Forbidden response
 */
export function forbidden(message = 'Forbidden'): Response {
	return json({ error: message }, { status: 403 });
}

/**
 * Create a 500 Internal Server Error response
 */
export function internalServerError(message = 'Internal Server Error'): Response {
	return json({ error: message }, { status: 500 });
}

/**
 * Create a 405 Method Not Allowed response
 */
export function methodNotAllowed(allowedMethods: string[] = []): Response {
	return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
		status: 405,
		headers: {
			'Content-Type': 'application/json',
			Allow: allowedMethods.join(', '),
		},
	});
}

/**
 * Parse request body as JSON with error handling
 */
export async function parseJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch (_error) {
		throw new Error('Invalid JSON in request body');
	}
}

/**
 * Parse form data from request
 */
export async function parseFormData(request: Request): Promise<FormData> {
	try {
		return await request.formData();
	} catch (_error) {
		throw new Error('Invalid form data in request body');
	}
}

/**
 * Extract query parameters from URL
 */
export function getQueryParams(url: URL): Record<string, string | string[]> {
	const params: Record<string, string | string[]> = {};

	for (const [key, value] of url.searchParams.entries()) {
		if (params[key]) {
			// If key already exists, convert to array or add to existing array
			if (Array.isArray(params[key])) {
				(params[key]).push(value);
			} else {
				params[key] = [params[key], value];
			}
		} else {
			params[key] = value;
		}
	}

	return params;
}

/**
 * Check if request method matches expected method(s)
 */
export function isMethod(request: Request, ...methods: string[]): boolean {
	return methods.includes(request.method);
}

/**
 * CORS headers for API responses
 */
export function corsHeaders(
	options: {
		origin?: string | string[];
		methods?: string[];
		headers?: string[];
		credentials?: boolean;
	} = {}
): Record<string, string> {
	const {
		origin = '*',
		methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		headers = ['Content-Type', 'Authorization'],
		credentials = false,
	} = options;

	const corsHeaders: Record<string, string> = {
		'Access-Control-Allow-Methods': methods.join(', '),
		'Access-Control-Allow-Headers': headers.join(', '),
	};

	if (Array.isArray(origin)) {
		corsHeaders['Access-Control-Allow-Origin'] = origin.join(', ');
	} else {
		corsHeaders['Access-Control-Allow-Origin'] = origin;
	}

	if (credentials) {
		corsHeaders['Access-Control-Allow-Credentials'] = 'true';
	}

	return corsHeaders;
}
