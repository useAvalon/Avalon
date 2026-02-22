/**
 * Nitro Error Handler for Avalon
 *
 * This module provides error handling utilities for the Nitro integration,
 * including support for custom error pages (404, 500, _error).
 *
 * Custom error pages are discovered from the pages directory:
 * - src/pages/404.tsx → Custom 404 page
 * - src/pages/500.tsx → Custom 500 page
 * - src/pages/_error.tsx → Generic error page (fallback)
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import type { PageModule, NitroRenderContext, AvalonRuntimeConfig } from "./types.ts";
import type { H3Event } from "h3";
import { HttpError, isHttpError, createNotFoundError, createInternalError } from "./types.ts";
import { createRenderContext, getRequestURL } from "./renderer.ts";

/**
 * Error page props passed to custom error page components
 */
export interface ErrorPageProps {
  /** HTTP status code */
  statusCode: number;
  /** Error message */
  message: string;
  /** Error object (development only) */
  error?: Error;
  /** Stack trace (development only) */
  stack?: string;
  /** Request URL that caused the error */
  url?: string;
}

/**
 * Options for error handling
 */
export interface ErrorHandlerOptions {
  /** Whether running in development mode */
  isDev?: boolean;
  /** Avalon runtime configuration */
  avalonConfig?: AvalonRuntimeConfig;
  /** Custom page module loader */
  loadPageModule?: (filePath: string) => Promise<PageModule>;
  /** Pages directory path */
  pagesDir?: string;
}

/**
 * Cache for discovered error pages
 */
interface ErrorPageCache {
  /** Custom 404 page module */
  notFound?: PageModule | null;
  /** Custom 500 page module */
  serverError?: PageModule | null;
  /** Generic error page module */
  genericError?: PageModule | null;
  /** Whether cache has been initialized */
  initialized: boolean;
}

// Module-level cache for error pages
let errorPageCache: ErrorPageCache = {
  initialized: false,
};

/**
 * Clears the error page cache
 * Call this during development when error pages change
 */
export function clearErrorPageCache(): void {
  errorPageCache = {
    initialized: false,
  };
}

/**
 * Discovers and caches custom error pages from the pages directory
 *
 * @param options - Error handler options
 * @returns Object containing discovered error page modules
 */
export async function discoverErrorPages(
  options: ErrorHandlerOptions
): Promise<ErrorPageCache> {
  if (errorPageCache.initialized && !options.isDev) {
    return errorPageCache;
  }

  const { loadPageModule, pagesDir = "src/pages" } = options;

  if (!loadPageModule) {
    errorPageCache.initialized = true;
    return errorPageCache;
  }

  // Try to load custom 404 page
  try {
    errorPageCache.notFound = await loadPageModule(`${pagesDir}/404.tsx`);
  } catch {
    // Try .jsx extension
    try {
      errorPageCache.notFound = await loadPageModule(`${pagesDir}/404.jsx`);
    } catch {
      errorPageCache.notFound = null;
    }
  }

  // Try to load custom 500 page
  try {
    errorPageCache.serverError = await loadPageModule(`${pagesDir}/500.tsx`);
  } catch {
    // Try .jsx extension
    try {
      errorPageCache.serverError = await loadPageModule(`${pagesDir}/500.jsx`);
    } catch {
      errorPageCache.serverError = null;
    }
  }

  // Try to load generic error page
  try {
    errorPageCache.genericError = await loadPageModule(`${pagesDir}/_error.tsx`);
  } catch {
    // Try .jsx extension
    try {
      errorPageCache.genericError = await loadPageModule(`${pagesDir}/_error.jsx`);
    } catch {
      errorPageCache.genericError = null;
    }
  }

  errorPageCache.initialized = true;
  return errorPageCache;
}

/**
 * Gets the appropriate error page module for a status code
 *
 * @param statusCode - HTTP status code
 * @param cache - Error page cache
 * @returns Error page module or null if no custom page exists
 */
export function getErrorPageModule(
  statusCode: number,
  cache: ErrorPageCache
): PageModule | null {
  // Check for specific status code pages first
  if (statusCode === 404 && cache.notFound) {
    return cache.notFound;
  }

  if (statusCode === 500 && cache.serverError) {
    return cache.serverError;
  }

  // Fall back to generic error page
  if (cache.genericError) {
    return cache.genericError;
  }

  return null;
}

/**
 * Creates error page props from an error
 *
 * @param error - The error that occurred
 * @param url - Request URL
 * @param isDev - Whether running in development mode
 * @returns Error page props
 */
export function createErrorPageProps(
  error: Error | HttpError,
  url?: string,
  isDev?: boolean
): ErrorPageProps {
  const statusCode = isHttpError(error) ? error.statusCode : 500;

  const props: ErrorPageProps = {
    statusCode,
    message: error.message,
    url,
  };

  // Include error details only in development
  if (isDev) {
    props.error = error;
    props.stack = error.stack;
  }

  return props;
}

/**
 * Renders a custom error page to HTML
 *
 * @param pageModule - The error page module
 * @param props - Error page props
 * @param context - Render context
 * @param isDev - Whether running in development mode
 * @returns Rendered HTML string
 */
export async function renderErrorPage(
  pageModule: PageModule,
  props: ErrorPageProps,
  context: NitroRenderContext,
  isDev: boolean
): Promise<string> {
  // The page module's default export should be a component function
  const Component = pageModule.default as (props: ErrorPageProps) => unknown;

  if (typeof Component !== "function") {
    // Fall back to default error page if component is invalid
    return generateDefaultErrorPage(props.statusCode, props.message, isDev, props.stack);
  }

  try {
    // Render the component
    // In a real implementation, this would use the SSR pipeline
    // For now, we generate a basic HTML structure
    const metadata = pageModule.metadata || {};

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(String(metadata.title || `Error ${props.statusCode}`))}</title>
    ${metadata.description ? `<meta name="description" content="${escapeHtml(String(metadata.description))}">` : ""}
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        margin: 0;
        padding: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        box-sizing: border-box;
        background: #f5f5f5;
      }
      .error-page {
        text-align: center;
        max-width: 600px;
      }
      h1 {
        font-size: 48px;
        margin: 0 0 20px 0;
        color: #333;
      }
      p {
        color: #666;
        margin: 0 0 20px 0;
      }
      a {
        color: #0066cc;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
      details {
        margin-top: 20px;
        text-align: left;
      }
      pre {
        background: #1a1a1a;
        color: #e0e0e0;
        padding: 15px;
        border-radius: 4px;
        overflow-x: auto;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <div id="app" data-error-page="true" data-status-code="${props.statusCode}" data-props='${escapeHtml(JSON.stringify(props))}'>
      <!-- Custom error page content rendered by Avalon SSR pipeline -->
      <div class="error-page">
        <h1>${props.statusCode}</h1>
        <p>${escapeHtml(props.message)}</p>
        ${isDev && props.stack ? `
        <details>
          <summary>Error details</summary>
          <pre>${escapeHtml(props.stack)}</pre>
        </details>
        ` : ""}
        <a href="/">Go back home</a>
      </div>
    </div>
  </body>
</html>`;
  } catch (renderError) {
    console.error("[Error Page Render Error]", renderError);
    // Fall back to default error page
    return generateDefaultErrorPage(props.statusCode, props.message, isDev, props.stack);
  }
}

/**
 * Generates a default error page when no custom page is available
 *
 * @param statusCode - HTTP status code
 * @param message - Error message
 * @param isDev - Whether running in development mode
 * @param stack - Stack trace (development only)
 * @returns HTML string
 */
export function generateDefaultErrorPage(
  statusCode: number,
  message: string,
  isDev: boolean,
  stack?: string
): string {
  if (isDev) {
    return generateDevErrorPage(statusCode, message, stack);
  }
  return generateProdErrorPage(statusCode, message);
}

/**
 * Generates a development error page with full details
 */
function generateDevErrorPage(
  statusCode: number,
  message: string,
  stack?: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Error ${statusCode}</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        margin: 0;
        padding: 40px;
        background: #1a1a1a;
        color: #fff;
      }
      .error-container {
        max-width: 800px;
        margin: 0 auto;
        background: #2d2d2d;
        padding: 40px;
        border-radius: 8px;
        border-left: 4px solid #ff6b6b;
      }
      h1 {
        color: #ff6b6b;
        margin-top: 0;
        font-size: 24px;
      }
      .status-code {
        font-size: 48px;
        font-weight: bold;
        color: #ff6b6b;
        margin-bottom: 10px;
      }
      .message {
        font-size: 18px;
        color: #ccc;
        margin-bottom: 20px;
      }
      pre {
        background: #1a1a1a;
        padding: 20px;
        border-radius: 4px;
        overflow-x: auto;
        font-size: 14px;
        line-height: 1.5;
        color: #e0e0e0;
      }
      .stack-title {
        color: #888;
        font-size: 12px;
        text-transform: uppercase;
        margin-bottom: 10px;
      }
      a {
        color: #6b9fff;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="error-container">
      <div class="status-code">${statusCode}</div>
      <h1>${getStatusText(statusCode)}</h1>
      <p class="message">${escapeHtml(message)}</p>
      ${stack ? `
      <div class="stack-title">Stack Trace</div>
      <pre>${escapeHtml(stack)}</pre>
      ` : ""}
      <p><a href="/">← Return to home</a></p>
    </div>
  </body>
</html>`;
}

/**
 * Generates a production error page without sensitive details
 */
function generateProdErrorPage(statusCode: number, message: string): string {
  // Use generic message for 500 errors in production
  const displayMessage = statusCode >= 500 
    ? "An unexpected error occurred. Please try again later."
    : message;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Error ${statusCode}</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        margin: 0;
        padding: 40px;
        background: #f5f5f5;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        box-sizing: border-box;
      }
      .error-container {
        text-align: center;
        max-width: 400px;
      }
      .status-code {
        font-size: 72px;
        font-weight: bold;
        color: #333;
        margin-bottom: 10px;
      }
      h1 {
        color: #666;
        font-size: 24px;
        margin: 0 0 20px 0;
      }
      p {
        color: #888;
        margin: 0 0 20px 0;
      }
      a {
        color: #0066cc;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="error-container">
      <div class="status-code">${statusCode}</div>
      <h1>${getStatusText(statusCode)}</h1>
      <p>${escapeHtml(displayMessage)}</p>
      <p><a href="/">Return to home</a></p>
    </div>
  </body>
</html>`;
}

/**
 * Gets the status text for an HTTP status code
 */
function getStatusText(statusCode: number): string {
  const statusTexts: Record<number, string> = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Page Not Found",
    405: "Method Not Allowed",
    408: "Request Timeout",
    410: "Gone",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };
  return statusTexts[statusCode] || "Error";
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replaceAll('&', "&amp;")
    .replaceAll('<', "&lt;")
    .replaceAll('>', "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll('\'', "&#039;");
}

/**
 * Handles a render error and returns an appropriate response
 *
 * This function:
 * 1. Discovers custom error pages if available
 * 2. Renders the appropriate error page (custom or default)
 * 3. Returns a Response with the correct status code
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 *
 * @param error - The error that occurred
 * @param event - H3 event
 * @param options - Error handler options
 * @returns Response with error page
 */
export async function handleRenderError(
  error: Error | HttpError,
  event: H3Event,
  options: ErrorHandlerOptions
): Promise<Response> {
  const { isDev = false } = options;
  const statusCode = isHttpError(error) ? error.statusCode : 500;
  const url = getRequestURL(event);

  console.error(`[Render Error] ${statusCode} - ${error.message}`, {
    url: url.pathname,
    stack: isDev ? error.stack : undefined,
  });

  // Try to discover and use custom error pages
  const errorPages = await discoverErrorPages(options);
  const errorPageModule = getErrorPageModule(statusCode, errorPages);

  let html: string;

  if (errorPageModule) {
    // Render custom error page
    const props = createErrorPageProps(error, url.pathname, isDev);
    const context = createRenderContext(event, {});
    html = await renderErrorPage(errorPageModule, props, context, isDev);
  } else {
    // Use default error page
    html = generateDefaultErrorPage(
      statusCode,
      error.message,
      isDev,
      isDev ? error.stack : undefined
    );
  }

  return new Response(html, {
    status: statusCode,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Handles an API error and returns an appropriate JSON response
 *
 * Requirements: 10.1, 10.2, 10.4
 *
 * @param error - The error that occurred
 * @param options - Error handler options
 * @returns Response with JSON error
 */
export function handleApiError(
  error: Error | HttpError,
  options: ErrorHandlerOptions
): Response {
  const { isDev = false } = options;
  const statusCode = isHttpError(error) ? error.statusCode : 500;

  console.error(`[API Error] ${statusCode} - ${error.message}`, {
    stack: isDev ? error.stack : undefined,
  });

  const body = isDev
    ? {
        error: error.message,
        statusCode,
        stack: error.stack,
      }
    : {
        error: statusCode >= 500 ? "Internal Server Error" : error.message,
        statusCode,
      };

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Creates a 404 Not Found response
 *
 * @param pathname - The requested path
 * @param event - H3 event
 * @param options - Error handler options
 * @returns Response with 404 error page
 */
export async function handleNotFound(
  pathname: string,
  event: H3Event,
  options: ErrorHandlerOptions
): Promise<Response> {
  const error = createNotFoundError(`Page not found: ${pathname}`);
  return handleRenderError(error, event, options);
}

/**
 * Creates a 500 Internal Server Error response
 *
 * @param error - The original error
 * @param event - H3 event
 * @param options - Error handler options
 * @returns Response with 500 error page
 */
export async function handleInternalError(
  error: Error,
  event: H3Event,
  options: ErrorHandlerOptions
): Promise<Response> {
  const httpError = createInternalError(error.message);
  // Preserve the original stack trace
  httpError.stack = error.stack;
  return handleRenderError(httpError, event, options);
}

