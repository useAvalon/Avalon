import { z } from 'zod';

/**
 * Supported HTTP methods for API routes
 */
export const ApiMethodSchema: z.ZodEnum<['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']> = z.enum([
	'GET',
	'POST',
	'PUT',
	'DELETE',
	'PATCH',
	'HEAD',
	'OPTIONS',
]);

export type ApiMethod = z.infer<typeof ApiMethodSchema>;

/**
 * Context object provided to API handlers
 */
export const ApiContextSchema: z.ZodObject<{
	request: z.ZodAny;
	url: z.ZodAny;
	params: z.ZodRecord<z.ZodString, z.ZodString>;
	query: z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString>]>>;
}> = z.object({
	/** HTTP request object */
	request: z.any(), // Request object
	/** URL object for easy access to pathname, search params, etc */
	url: z.any(), // URL object
	/** Route parameters extracted from dynamic routes like /api/users/[id].ts */
	params: z.record(z.string()),
	/** Query parameters from URL search params */
	query: z.record(z.union([z.string(), z.array(z.string())])),
});

export type ApiContext = {
	request: Request;
	url: URL;
	params: Record<string, string>;
	query: Record<string, string | string[]>;
};

/**
 * API handler function signature
 */
export type ApiHandler = (context: ApiContext) => Response | Promise<Response>;

/**
 * API route configuration
 * Can be either a single handler function or an object with method-specific handlers
 */
export type ApiRouteConfig = ApiHandler | Partial<Record<ApiMethod, ApiHandler>>;

export const ApiRouteConfigSchema = z.union([
	// Single handler function (handles all methods)
	z.function(),
	// Object with method-specific handlers
	z
		.object({
			GET: z.function().optional(),
			POST: z.function().optional(),
			PUT: z.function().optional(),
			DELETE: z.function().optional(),
			PATCH: z.function().optional(),
			HEAD: z.function().optional(),
			OPTIONS: z.function().optional(),
		})
		.refine(config => Object.values(config).some(handler => handler !== undefined), {
			message: 'At least one HTTP method handler must be defined',
		}),
]) as z.ZodType<ApiRouteConfig>;

/**
 * Discovered API route with metadata
 */
export interface ApiRoute {
	/** URL pattern for matching requests */
	pattern: URLPattern;
	/** Route configuration with handlers */
	config: ApiRouteConfig;
	/** Original file path relative to src/api */
	filePath: string;
	/** Extracted dynamic parameter names */
	paramNames: string[];
}
