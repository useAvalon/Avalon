import { z } from "zod";

/**
 * Supported HTTP methods for API routes
 */
export const ApiMethodSchema = z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

export type ApiMethod = z.infer<typeof ApiMethodSchema>;

/**
 * Discovered API route with metadata
 */
export interface ApiRoute {
	/** URL pattern for matching requests */
	pattern: URLPattern;
	/** Route configuration with handlers */
	config: unknown;
	/** Original file path relative to src/api */
	filePath: string;
	/** Extracted dynamic parameter names */
	paramNames: string[];
}
