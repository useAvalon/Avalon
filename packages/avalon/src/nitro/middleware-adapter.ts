/**
 * Nitro Middleware Adapter for Avalon
 *
 * This module adapts Avalon's middleware system to work with Nitro's h3 middleware.
 * It creates Nitro event handlers from Avalon middleware configurations,
 * supporting middleware chain execution, context propagation, and error handling.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import type {
  H3Event,
  AvalonEventContext,
} from "./types.ts";
import type {
  MiddlewareContext,
  MiddlewareHandler,
  MiddlewareResponse,
  MiddlewareExecutionResult,
  MiddlewareConfig,
} from "../schemas/middleware.ts";
import { MiddlewareExecutor } from "../core/middleware/middleware-executor.ts";
import {
  createDefaultErrorHandler,
  MiddlewareError,
  MiddlewareErrorType,
} from "../core/middleware/middleware-error-handler.ts";

/**
 * Options for creating a middleware handler
 */
export interface CreateMiddlewareHandlerOptions {
  /** Whether running in development mode */
  isDev?: boolean;
  /** Enable detailed logging */
  enableLogging?: boolean;
  /** Maximum execution time for middleware chain (ms) */
  maxExecutionTime?: number;
}

/**
 * Result of middleware execution in Nitro context
 */
export interface NitroMiddlewareResult {
  /** Response to return (if middleware terminated the chain) */
  response?: Response;
  /** Modified middleware context */
  context: MiddlewareContext;
  /** Whether the chain should continue to the next handler */
  shouldContinue: boolean;
  /** Execution metadata */
  metadata: {
    middlewareExecuted: number;
    executionTime: number;
    earlyTermination: boolean;
    error?: Error;
  };
}

/**
 * Gets the request URL from an H3 event
 * Requirements: 4.1
 */
export function getRequestURL(event: H3Event): URL {
  const protocol = "http";
  const host = "localhost";
  return new URL(event.path, `${protocol}://${host}`);
}

/**
 * Gets request headers from an H3 event
 */
export function getRequestHeaders(event: H3Event): Headers {
  const headers = new Headers();
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
 * Requirements: 4.1
 */
export function toRequest(event: H3Event): Request {
  const url = getRequestURL(event);
  const method = event.method.toUpperCase();
  const hasBody = !["GET", "HEAD", "OPTIONS"].includes(method);
  
  return new Request(url, {
    method,
    headers: getRequestHeaders(event),
    body: hasBody ? undefined : undefined,
  });
}

/**
 * Extracts route parameters from an H3 event
 * Requirements: 4.1
 */
export function getRouterParams(event: H3Event): Record<string, string> {
  const params = event.context.params as Record<string, string> | undefined;
  return params ?? {};
}

/**
 * Creates a MiddlewareContext from an H3 event
 * Requirements: 4.1, 4.3
 *
 * @param event - The H3 event
 * @returns MiddlewareContext for use in middleware handlers
 */
export function createMiddlewareContext(event: H3Event): MiddlewareContext {
  const url = getRequestURL(event);
  const params = getRouterParams(event);
  
  // Parse query parameters
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of url.searchParams.entries()) {
    if (query[key]) {
      if (Array.isArray(query[key])) {
        (query[key] as string[]).push(value);
      } else {
        query[key] = [query[key] as string, value];
      }
    } else {
      query[key] = value;
    }
  }

  return {
    request: toRequest(event),
    url,
    params,
    query,
    state: new Map(),
    locals: {},
  };
}

/**
 * Stores the middleware context in the H3 event for downstream handlers
 * Requirements: 4.3
 *
 * @param event - The H3 event
 * @param context - The middleware context to store
 */
export function storeMiddlewareContext(
  event: H3Event,
  context: MiddlewareContext
): void {
  // Initialize avalon context if not present
  if (!event.context.avalon) {
    event.context.avalon = {} as AvalonEventContext;
  }
  
  // Store the middleware context
  (event.context.avalon as AvalonEventContext).middlewareContext = context;
}

/**
 * Retrieves the middleware context from an H3 event
 * Requirements: 4.3
 *
 * @param event - The H3 event
 * @returns The stored middleware context or undefined
 */
export function getMiddlewareContext(event: H3Event): MiddlewareContext | undefined {
  const avalonContext = event.context.avalon as AvalonEventContext | undefined;
  return avalonContext?.middlewareContext;
}


/**
 * Executes a middleware chain with proper error handling
 * Requirements: 4.2, 4.4, 4.5, 4.6
 *
 * @param middlewareChain - Array of middleware handlers to execute
 * @param context - The middleware context
 * @param options - Execution options
 * @returns Middleware execution result
 */
export async function executeMiddlewareChain(
  middlewareChain: MiddlewareHandler[],
  context: MiddlewareContext,
  options: CreateMiddlewareHandlerOptions = {}
): Promise<NitroMiddlewareResult> {
  const { isDev = false, enableLogging = false, maxExecutionTime = 30000 } = options;
  
  const startTime = Date.now();
  let middlewareExecuted = 0;
  let earlyTermination = false;
  let finalResponse: Response | undefined;
  let executionError: Error | undefined;

  if (enableLogging) {
    console.log(`[Middleware] Executing chain with ${middlewareChain.length} middleware`);
  }

  // If no middleware, just continue
  if (middlewareChain.length === 0) {
    return {
      response: undefined,
      context,
      shouldContinue: true,
      metadata: {
        middlewareExecuted: 0,
        executionTime: Date.now() - startTime,
        earlyTermination: false,
      },
    };
  }

  try {
    // Create the middleware executor with configuration
    const executor = new MiddlewareExecutor({
      developmentMode: isDev,
      enableLogging,
      maxExecutionTime,
    });

    // Execute the middleware chain
    const result = await executor.execute(middlewareChain, context);

    middlewareExecuted = result.metadata.middlewareExecuted;
    earlyTermination = result.metadata.earlyTermination;
    finalResponse = result.response;
    executionError = result.metadata.error;

    // Update context with any modifications from middleware
    Object.assign(context, result.context);

  } catch (error) {
    executionError = error instanceof Error ? error : new Error(String(error));
    earlyTermination = true;

    console.error("[Middleware Error]", executionError);

    // Create error response
    finalResponse = createMiddlewareErrorResponse(executionError, context, isDev);
  }

  const executionTime = Date.now() - startTime;

  if (enableLogging) {
    console.log(`[Middleware] Chain completed in ${executionTime}ms, executed ${middlewareExecuted} middleware`);
  }

  return {
    response: finalResponse,
    context,
    shouldContinue: !finalResponse && !earlyTermination,
    metadata: {
      middlewareExecuted,
      executionTime,
      earlyTermination,
      error: executionError,
    },
  };
}

/**
 * Creates an error response for middleware errors
 * Requirements: 4.6
 *
 * @param error - The error that occurred
 * @param context - The middleware context
 * @param isDev - Whether running in development mode
 * @returns Response object with error details
 */
export function createMiddlewareErrorResponse(
  error: Error,
  context: MiddlewareContext,
  isDev: boolean
): Response {
  console.error("[Middleware Error]", error);

  if (isDev) {
    // Development mode: return detailed error response
    const errorDetails = {
      error: "Middleware Error",
      message: error.message,
      stack: error.stack,
      context: {
        url: context.url.pathname,
        method: context.request.method,
        params: context.params,
        query: context.query,
      },
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(errorDetails, null, 2), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "X-Middleware-Error": "true",
      },
    });
  }

  // Production mode: return generic error response
  return new Response("Internal Server Error", {
    status: 500,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}

/**
 * Creates a Nitro middleware handler from Avalon middleware chain
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 *
 * This function:
 * 1. Creates a MiddlewareContext from the H3 event
 * 2. Executes the middleware chain in correct order
 * 3. Handles early termination when middleware returns a Response
 * 4. Stores the context in event.context.avalon for downstream handlers
 * 5. Handles errors without crashing the server
 *
 * @param middlewareChain - Array of middleware handlers to execute
 * @param options - Handler options
 * @returns Handler function for Nitro
 */
export function createMiddlewareHandler(
  middlewareChain: MiddlewareHandler[],
  options: CreateMiddlewareHandlerOptions = {}
): (event: H3Event) => Promise<Response | void> {
  const { isDev = false, enableLogging = false, maxExecutionTime = 30000 } = options;

  return async function middlewareHandler(event: H3Event): Promise<Response | void> {
    try {
      // Create middleware context from H3 event
      const context = createMiddlewareContext(event);

      // Execute middleware chain
      const result = await executeMiddlewareChain(middlewareChain, context, {
        isDev,
        enableLogging,
        maxExecutionTime,
      });

      // Store context in event for downstream handlers
      storeMiddlewareContext(event, result.context);

      // If middleware returned a response, return it (early termination)
      if (result.response) {
        return result.response;
      }

      // Continue to next handler (no return = continue)
      return;
    } catch (error) {
      // Catch any unexpected errors to prevent server crash
      console.error("[Middleware Handler Error]", error);

      const err = error instanceof Error ? error : new Error(String(error));
      const context = createMiddlewareContext(event);
      
      return createMiddlewareErrorResponse(err, context, isDev);
    }
  };
}

/**
 * Creates a middleware handler that combines global and scoped middleware
 * Requirements: 4.2
 *
 * Middleware execution order:
 * 1. Global middleware (applies to all routes)
 * 2. Scoped middleware (pages or api specific)
 * 3. Route-specific middleware
 *
 * @param globalMiddleware - Global middleware handlers
 * @param scopedMiddleware - Scoped middleware handlers (pages or api)
 * @param routeMiddleware - Route-specific middleware handlers
 * @param options - Handler options
 * @returns Handler function for Nitro
 */
export function createCombinedMiddlewareHandler(
  globalMiddleware: MiddlewareHandler[],
  scopedMiddleware: MiddlewareHandler[],
  routeMiddleware: MiddlewareHandler[] = [],
  options: CreateMiddlewareHandlerOptions = {}
): (event: H3Event) => Promise<Response | void> {
  // Combine middleware in correct order: global → scoped → route-specific
  const combinedChain = [
    ...globalMiddleware,
    ...scopedMiddleware,
    ...routeMiddleware,
  ];

  return createMiddlewareHandler(combinedChain, options);
}

/**
 * Wraps an existing handler with middleware execution
 * Requirements: 4.1, 4.2, 4.3
 *
 * @param handler - The handler to wrap
 * @param middlewareChain - Middleware to execute before the handler
 * @param options - Handler options
 * @returns Wrapped handler function
 */
export function withMiddleware<T>(
  handler: (event: H3Event) => Promise<T>,
  middlewareChain: MiddlewareHandler[],
  options: CreateMiddlewareHandlerOptions = {}
): (event: H3Event) => Promise<T | Response> {
  const middlewareHandler = createMiddlewareHandler(middlewareChain, options);

  return async function wrappedHandler(event: H3Event): Promise<T | Response> {
    // Execute middleware first
    const middlewareResult = await middlewareHandler(event);

    // If middleware returned a response, return it
    if (middlewareResult instanceof Response) {
      return middlewareResult;
    }

    // Otherwise, execute the original handler
    return handler(event);
  };
}

/**
 * Type guard to check if a value is a valid middleware handler
 */
export function isMiddlewareHandler(value: unknown): value is MiddlewareHandler {
  return typeof value === "function";
}

/**
 * Validates a middleware chain
 *
 * @param chain - The middleware chain to validate
 * @returns True if valid, throws error if invalid
 */
export function validateMiddlewareChain(chain: unknown[]): chain is MiddlewareHandler[] {
  for (let i = 0; i < chain.length; i++) {
    if (!isMiddlewareHandler(chain[i])) {
      throw new MiddlewareError(
        `Invalid middleware at index ${i}: expected function, got ${typeof chain[i]}`,
        MiddlewareErrorType.VALIDATION_ERROR
      );
    }
  }
  return true;
}
