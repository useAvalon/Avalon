/**
 * Nitro-Aligned Middleware Types
 *
 * This module defines types for Avalon's middleware system that align with
 * Nitro's conventions while preserving route-scoped middleware features.
 *
 * Key differences from old middleware system:
 * - Handler signature: (event: H3Event) => void | Response | Promise<void | Response>
 * - Return void to continue, return Response to terminate
 * - Uses event.context for data passing instead of custom state/locals
 *
 * Requirements: 1.1
 */

import type { H3Event } from 'h3';

/**
 * Nitro-aligned middleware handler signature
 *
 * This signature matches Nitro's middleware conventions:
 * - Return nothing (void/undefined) to continue to next middleware
 * - Return a Response to terminate the chain and send that response
 * - Throw an error to trigger Nitro's error handling
 *
 * @example
 * ```ts
 * const handler: MiddlewareHandler = async (event) => {
 *   // Check auth
 *   if (!event.context.user) {
 *     return new Response('Unauthorized', { status: 401 });
 *   }
 *   // Continue to next middleware
 * };
 * ```
 */
export type MiddlewareHandler = (
  event: H3Event
) => void | Response | Promise<void | Response>;

/**
 * Route-scoped middleware file export interface
 *
 * Middleware files should export a default function matching the MiddlewareHandler signature.
 *
 * @example
 * ```ts
 * // src/pages/admin/_middleware.ts
 * export default async (event) => {
 *   // middleware logic
 * };
 * ```
 */
export interface MiddlewareFileExport {
  /** Default export must be a MiddlewareHandler function */
  default: MiddlewareHandler;
}

/**
 * Discovered middleware route configuration
 *
 * Represents a middleware file discovered during scanning, with its
 * URL pattern, file path, execution priority, and type.
 */
export interface MiddlewareRoute {
  /** URL pattern for matching requests */
  pattern: URLPattern;
  /** Absolute path to the middleware file */
  filePath: string;
  /** Execution priority (lower numbers execute first) */
  priority: number;
  /** Middleware type - determines which routes it applies to */
  type: 'global' | 'pages';
}

/**
 * Middleware discovery options
 */
export interface MiddlewareDiscoveryOptions {
  /** Base directory to scan (e.g., 'src') */
  baseDir: string;
  /** File pattern to match (default: '_middleware.ts') */
  filePattern?: string;
  /** Directories to exclude from scanning */
  excludeDirs?: string[];
  /** Enable development mode logging */
  devMode?: boolean;
}

/**
 * Middleware execution options
 */
export interface MiddlewareExecutorOptions {
  /** Enable development mode logging */
  devMode?: boolean;
  /** Timeout for middleware execution in milliseconds */
  timeout?: number;
}


