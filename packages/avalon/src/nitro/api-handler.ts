/**
 * Nitro API Handler Factory for Avalon
 *
 * This module provides the API handler factory for Nitro integration.
 * It creates Nitro event handlers from Avalon API route configurations,
 * supporting method-specific handlers, parameter extraction, and response handling.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import type {
  H3Event,
  NitroApiContext,
  HttpError,
} from "./types.ts";
import {
  createMethodNotAllowedError,
  createInternalError,
  isHttpError,
} from "./types.ts";
import type {
  ApiRouteConfig,
  ApiContext,
  ApiMethod,
  ApiHandler,
} from "../schemas/api.ts";

/**
 * Supported HTTP methods for API routes
 */
const SUPPORTED_METHODS: ApiMethod[] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
];

/**
 * Options for creating an API handler
 */
export interface CreateApiHandlerOptions {
  /** Whether running in development mode */
  isDev?: boolean;
  /** Custom error handler */
  onError?: (error: Error, context: NitroApiContext) => Response | Promise<Response>;
}

/**
 * Gets the request URL from an H3 event
 * Requirements: 3.4
 */
export function getRequestURL(event: H3Event): URL {
  // In a real Nitro environment, this would use h3's getRequestURL
  // For now, we construct it from the event path
  const protocol = "http";
  const host = "localhost";
  return new URL(event.path, `${protocol}://${host}`);
}

/**
 * Gets request headers from an H3 event
 */
export function getRequestHeaders(event: H3Event): Headers {
  const headers = new Headers();
  // In a real Nitro environment, headers would come from event.node.req.headers
  // This is a placeholder implementation
  const nodeReq = event.node.req as { headers?: Record<string, string | string[] | undefined> };
  if (nodeReq && nodeReq.headers) {
    for (const [key, value] of Object.entries(nodeReq.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
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
  const hasBody = !["GET", "HEAD", "OPTIONS"].includes(method);
  
  return new Request(url, {
    method,
    headers: getRequestHeaders(event),
    // Body handling would be done via h3's readBody in real implementation
    body: hasBody ? undefined : undefined,
  });
}

/**
 * Extracts route parameters from an H3 event
 * Supports dynamic segments [param] and catch-all segments [...slug]
 * Requirements: 3.3
 *
 * @param event - The H3 event
 * @returns Record of parameter names to values
 */
export function getRouterParams(event: H3Event): Record<string, string> {
  // In a real Nitro environment, this would use h3's getRouterParams
  // Parameters are typically stored in event.context.params by the router
  const params = event.context.params as Record<string, string> | undefined;
  return params ?? {};
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
        (query[key] as string[]).push(value);
      } else {
        query[key] = [query[key] as string, value];
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
  const avalonContext = event.context.avalon as {
    middlewareContext?: {
      state?: Map<string, unknown>;
      locals?: Record<string, unknown>;
    };
  } | undefined;

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
  if (typeof result === "object") {
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // For primitives (string, number, boolean), convert to string
  return new Response(String(result), {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

/**
 * Creates an error response for API errors
 * Requirements: 3.6
 *
 * @param error - The error that occurred
 * @param isDev - Whether running in development mode
 * @returns Response object with error details
 */
export function createApiErrorResponse(
  error: Error | HttpError,
  isDev: boolean
): Response {
  const statusCode = isHttpError(error) ? error.statusCode : 500;
  const data = isHttpError(error) ? error.data : undefined;

  const body = isDev
    ? {
        error: error.message,
        stack: error.stack,
        ...(data && { data }),
      }
    : {
        error: statusCode === 500 ? "Internal Server Error" : error.message,
        ...(data && { data }),
      };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add Allow header for 405 Method Not Allowed
  if (statusCode === 405 && data?.allowed) {
    headers["Allow"] = (data.allowed as string[]).join(", ");
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
  if (typeof config === "function") {
    return [...SUPPORTED_METHODS];
  }

  // Otherwise, get the methods that have handlers defined
  return SUPPORTED_METHODS.filter(
    (method) => typeof config[method] === "function"
  );
}

/**
 * Creates a Nitro event handler from an Avalon API route configuration
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.6
 *
 * This function:
 * 1. Creates an API context from the H3 event
 * 2. Routes to the appropriate method handler
 * 3. Handles response serialization
 * 4. Handles errors appropriately
 *
 * @param config - The API route configuration (single handler or method-specific handlers)
 * @param options - Handler options
 * @returns Handler function for Nitro
 */
export function createApiHandler(
  config: ApiRouteConfig,
  options: CreateApiHandlerOptions = {}
): (event: H3Event) => Promise<Response> {
  const { isDev = false, onError } = options;

  return async function apiHandler(event: H3Event): Promise<Response> {
    const method = event.method.toUpperCase() as ApiMethod;

    try {
      // Create API context compatible with existing handlers
      const context = createApiContext(event);

      // Handle single handler function (handles all methods)
      if (typeof config === "function") {
        const result = await config(context);
        return handleApiResponse(result);
      }

      // Handle method-specific handlers
      const handler = config[method] as ApiHandler | undefined;

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
      console.error("[API Error]", error);

      const err = error instanceof Error ? error : new Error(String(error));

      // Use custom error handler if provided
      if (onError) {
        try {
          const context = createApiContext(event);
          return await onError(err, context);
        } catch (handlerError) {
          console.error("[API Error Handler Error]", handlerError);
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
 * Extracts dynamic parameters from a file path pattern
 * Supports [param] for single segments and [...slug] for catch-all
 * Requirements: 3.3
 *
 * @param pattern - The route pattern (e.g., "/users/[id]" or "/docs/[...slug]")
 * @returns Array of parameter names
 */
export function extractParamNames(pattern: string): string[] {
  const params: string[] = [];
  
  // Match [param] or [...param] patterns
  const paramRegex = /\[(?:\.\.\.)?([^\]]+)\]/g;
  let match;

  while ((match = paramRegex.exec(pattern)) !== null) {
    params.push(match[1]);
  }

  return params;
}

/**
 * Converts a file path pattern to a route pattern
 * Requirements: 3.3
 *
 * Converts:
 * - [param] to :param (single segment)
 * - [...slug] to ** (catch-all)
 *
 * @param filePath - The file path pattern
 * @returns The route pattern for matching
 */
export function filePathToRoutePattern(filePath: string): string {
  return filePath
    // Convert catch-all [...param] to **
    .replace(/\[\.\.\.([^\]]+)\]/g, "**")
    // Convert dynamic [param] to :param
    .replace(/\[([^\]]+)\]/g, ":$1");
}

/**
 * Matches a URL path against a route pattern and extracts parameters
 * Requirements: 3.3
 *
 * @param urlPath - The URL path to match
 * @param pattern - The route pattern
 * @param paramNames - The parameter names in order
 * @returns Extracted parameters or null if no match
 */
export function matchRoutePattern(
  urlPath: string,
  pattern: string,
  paramNames: string[]
): Record<string, string> | null {
  // Normalize paths
  const normalizedUrl = urlPath.replace(/\/$/, "") || "/";
  const normalizedPattern = pattern.replace(/\/$/, "") || "/";

  // Convert pattern to regex
  let regexPattern = normalizedPattern
    // Escape special regex characters except our placeholders
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    // Convert ** (catch-all) to capture group
    .replace(/\\\*\\\*/g, "(.+)")
    // Convert :param to capture group
    .replace(/:([^/]+)/g, "([^/]+)");

  // Ensure exact match
  regexPattern = `^${regexPattern}$`;

  const regex = new RegExp(regexPattern);
  const match = normalizedUrl.match(regex);

  if (!match) {
    return null;
  }

  // Extract parameters
  const params: Record<string, string> = {};
  for (let i = 0; i < paramNames.length; i++) {
    if (match[i + 1] !== undefined) {
      params[paramNames[i]] = match[i + 1];
    }
  }

  return params;
}

// Types are exported inline with the interface definition
