/**
 * Nitro Types and Interfaces for Avalon
 *
 * This module defines the core types used throughout the Nitro integration,
 * including render context, runtime configuration, and route definitions.
 *
 * In Nitro v3, canonical types should be imported from `nitro/types`.
 * Avalon-specific types that extend or complement Nitro's types are defined here.
 */

import type { MiddlewareContext } from "../nitro/middleware-adapter.ts";
import type { ApiMethod } from "../schemas/api.ts";

/**
 * ServerRequest type reference from Nitro v3 (`nitro/types`).
 * Re-exported here for convenience within Avalon's Nitro integration.
 *
 * Represents the server-side request object in Nitro v3's type system.
 * When the full `nitro/types` package is available, prefer importing directly.
 */
export interface ServerRequest {
  /** HTTP method */
  method: string;
  /** Request URL */
  url: string;
  /** Request headers */
  headers: Record<string, string | string[] | undefined>;
  /** Request body (if applicable) */
  body?: unknown;
}

/**
 * H3 Event type placeholder
 * This represents the H3 event object from Nitro's h3 library
 */
export interface H3Event {
  /** HTTP method */
  method: string;
  /** Node.js request object */
  node?: {
    req: unknown;
    res?: unknown;
  };
  /** Event context for storing data */
  context: Record<string, unknown>;
  /** Request path */
  path: string;
}

/**
 * Avalon-specific runtime configuration stored in Nitro's runtimeConfig
 * This is accessed via useRuntimeConfig().avalon in handlers
 */
export interface AvalonRuntimeConfig {
  /** Enable streaming SSR responses */
  streaming: boolean;
  /** Pages directory path relative to project root */
  pagesDir: string;
  /** Layouts directory path relative to project root */
  layoutsDir: string;
}

/**
 * Render context provided to the SSR renderer
 * Contains all information needed to render a page
 */
export interface NitroRenderContext {
  /** Request URL */
  url: URL;
  /** Route parameters extracted from dynamic segments */
  params: Record<string, string>;
  /** Query parameters from URL search string */
  query: Record<string, string | string[]>;
  /** Original HTTP request */
  request: Request;
  /** H3 event for advanced use cases */
  event: H3Event;
  /** Middleware context if middleware was executed */
  middlewareContext?: MiddlewareContext;
  /** Layout context for rendering */
  layoutContext?: LayoutContext;
}

/**
 * Layout context for page rendering
 */
export interface LayoutContext {
  /** Layout component paths in nesting order (outermost first) */
  layouts: string[];
  /** Layout data loaded from layout modules */
  layoutData?: Record<string, unknown>;
}

/**
 * Discovered route information
 */
export interface DiscoveredRoute {
  /** Route type: page or API */
  type: "page" | "api";
  /** Absolute file path to the route handler */
  filePath: string;
  /** Route pattern for matching (e.g., /users/:id) */
  pattern: string;
  /** Extracted parameter names from dynamic segments */
  params: string[];
  /** HTTP method for API routes with method suffix */
  method?: ApiMethod;
}

/**
 * Nitro route configuration
 */
export interface NitroRouteConfig {
  /** Route pattern (e.g., /users/:id) */
  pattern: string;
  /** Route handler type */
  type: "page" | "api" | "middleware";
  /** File path to the handler */
  filePath: string;
  /** Extracted parameter names */
  params: string[];
  /** HTTP method (for API routes) */
  method?: ApiMethod;
  /** Layout chain for pages */
  layouts?: string[];
}

/**
 * SSR render options
 */
export interface SSRRenderOptions {
  /** Enable streaming SSR */
  streaming?: boolean;
  /** Callback when shell is ready (for streaming) */
  onShellReady?: () => void;
  /** Callback when all content is ready */
  onAllReady?: () => void;
  /** Callback on render error */
  onError?: (error: Error) => void;
}

/**
 * SSR render result
 */
export interface SSRRenderResult {
  /** Rendered HTML string or stream */
  html: string | ReadableStream<Uint8Array>;
  /** HTTP status code */
  statusCode: number;
  /** Response headers */
  headers: Record<string, string>;
}

/**
 * Island manifest entry for a single island
 */
export interface IslandEntry {
  /** Compiled JavaScript path */
  src: string;
  /** Framework identifier (react, vue, svelte, etc.) */
  framework: string;
  /** CSS dependencies */
  css?: string[];
  /** Preload dependencies */
  preload?: string[];
}

/**
 * Island manifest for production builds
 */
export interface IslandManifest {
  /** Map of island ID to compiled asset information */
  islands: Record<string, IslandEntry>;
  /** Client entry script path */
  clientEntry: string;
  /** CSS assets to inject */
  css: string[];
}

/**
 * Page module export interface
 */
export interface PageModule {
  /** Default export - the page component */
  default: unknown;
  /** Optional page metadata */
  metadata?: PageMetadata;
  /** Optional getStaticProps for static generation */
  getStaticProps?: () => Promise<Record<string, unknown>>;
  /** Optional getServerSideProps for SSR */
  getServerSideProps?: (
    context: NitroRenderContext
  ) => Promise<Record<string, unknown>>;
}

/**
 * Page metadata for SEO and configuration
 */
export interface PageMetadata {
  /** Page title */
  title?: string;
  /** Page description */
  description?: string;
  /** Open Graph metadata */
  openGraph?: {
    title?: string;
    description?: string;
    image?: string;
  };
  /** Additional head elements */
  head?: Array<{
    tag: string;
    attrs?: Record<string, string>;
    content?: string;
  }>;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  /** HTTP status code */
  statusCode: number;
  /** Error message */
  message: string;
  /** Stack trace (development only) */
  stack?: string;
  /** Additional error data */
  data?: Record<string, unknown>;
}

/**
 * HTTP error class for typed error handling
 */
export class HttpError extends Error {
  /** HTTP status code */
  statusCode: number;
  /** Additional error data */
  data?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    data?: Record<string, unknown>
  ) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.data = data;
  }
}

/**
 * Create a 404 Not Found error
 */
export function createNotFoundError(message = "Not Found"): HttpError {
  return new HttpError(404, message);
}

/**
 * Create a 405 Method Not Allowed error
 */
export function createMethodNotAllowedError(
  allowedMethods: string[]
): HttpError {
  return new HttpError(405, "Method Not Allowed", { allowed: allowedMethods });
}

/**
 * Create a 500 Internal Server Error
 */
export function createInternalError(message = "Internal Server Error"): HttpError {
  return new HttpError(500, message);
}

/**
 * Type guard to check if an error is an HttpError
 */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

/**
 * Avalon context stored in H3 event.context
 */
export interface AvalonEventContext {
  /** Middleware context after middleware execution */
  middlewareContext?: MiddlewareContext;
  /** Resolved route information */
  route?: NitroRouteConfig;
  /** Page props from getServerSideProps */
  pageProps?: Record<string, unknown>;
}

/**
 * Development server options
 */
export interface DevServerOptions {
  /** Port to listen on */
  port?: number;
  /** Host to bind to */
  host?: string;
  /** Enable HTTPS */
  https?: boolean;
  /** Open browser on start */
  open?: boolean;
}

/**
 * Build options for production
 */
export interface BuildOptions {
  /** Output directory */
  outDir?: string;
  /** Enable source maps */
  sourcemap?: boolean;
  /** Minify output */
  minify?: boolean;
  /** Target preset */
  preset?: string;
}
