/**
 * Route Discovery Module for Nitro
 *
 * This module discovers page and API routes from the file system and converts
 * them to Nitro-compatible route patterns. It handles dynamic segments,
 * catch-all routes, and method-specific API handlers.
 *
 * @module nitro/route-discovery
 */

import { basename, dirname, extname, join, relative } from "@std/path";
import { walk } from "@std/fs";
import type { DiscoveredRoute } from "./types.ts";
import type { ApiMethod } from "../schemas/api.ts";

/**
 * Supported page file extensions
 */
export const PAGE_EXTENSIONS = [
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".vue",
  ".svelte",
  ".md",
  ".mdx",
];

/**
 * Supported API file extensions
 */
export const API_EXTENSIONS = [".ts", ".js"];

/**
 * Valid HTTP methods for API routes
 */
export const VALID_HTTP_METHODS: ApiMethod[] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
];

/**
 * Options for route discovery
 */
export interface RouteDiscoveryOptions {
  /** Pages directory path (absolute or relative to project root) */
  pagesDir: string;
  /** API directory path (absolute or relative to project root) */
  apiDir: string;
  /** Enable development mode logging */
  developmentMode?: boolean;
  /** Directories to exclude from scanning */
  excludeDirectories?: string[];
}

/**
 * Result of file path to pattern conversion
 */
export interface FilePathPatternResult {
  /** Route pattern (e.g., /users/:id) */
  pattern: string;
  /** Extracted parameter names */
  params: string[];
}

/**
 * Result of API file path to pattern conversion
 */
export interface ApiFilePathPatternResult extends FilePathPatternResult {
  /** HTTP method extracted from filename (e.g., GET from users.get.ts) */
  method?: ApiMethod;
}

/**
 * Discovers all routes from pages and API directories
 *
 * @param options - Route discovery options
 * @returns Array of discovered routes
 *
 * @example
 * ```ts
 * const routes = await discoverRoutes({
 *   pagesDir: 'src/pages',
 *   apiDir: 'src/api',
 * });
 * ```
 */
export async function discoverRoutes(
  options: RouteDiscoveryOptions,
): Promise<DiscoveredRoute[]> {
  const routes: DiscoveredRoute[] = [];

  // Discover page routes
  const pageRoutes = await discoverPageRoutes(options.pagesDir, options);
  routes.push(...pageRoutes);

  // Discover API routes
  const apiRoutes = await discoverApiRoutes(options.apiDir, options);
  routes.push(...apiRoutes);

  return routes;
}

/**
 * Discovers page routes from the pages directory
 *
 * @param pagesDir - Path to the pages directory
 * @param options - Route discovery options
 * @returns Array of discovered page routes
 */
export async function discoverPageRoutes(
  pagesDir: string,
  options?: Pick<
    RouteDiscoveryOptions,
    "developmentMode" | "excludeDirectories"
  >,
): Promise<DiscoveredRoute[]> {
  const routes: DiscoveredRoute[] = [];
  const excludeDirs = options?.excludeDirectories ?? ["node_modules", ".git"];

  try {
    // Check if directory exists
    const stat = await Deno.stat(pagesDir);
    if (!stat.isDirectory) {
      if (options?.developmentMode) {
        console.warn(
          `[route-discovery] Pages path is not a directory: ${pagesDir}`,
        );
      }
      return [];
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      if (options?.developmentMode) {
        console.warn(
          `[route-discovery] Pages directory not found: ${pagesDir}`,
        );
      }
      return [];
    }
    throw error;
  }

  // Walk through the pages directory
  const extensions = PAGE_EXTENSIONS.map((e) => e.slice(1)); // Remove leading dot

  for await (
    const entry of walk(pagesDir, {
      includeDirs: false,
      followSymlinks: false,
      exts: extensions,
    })
  ) {
    if (!entry.isFile) continue;

    const relativePath = relative(pagesDir, entry.path);

    // Skip files in excluded directories
    if (excludeDirs.some((dir) => relativePath.includes(dir))) {
      continue;
    }

    // Skip private files (in folders starting with _)
    if (isPrivateFile(relativePath)) {
      continue;
    }

    // Convert file path to route pattern
    const { pattern, params } = filePathToPattern(relativePath);

    routes.push({
      type: "page",
      filePath: entry.path,
      pattern,
      params,
    });
  }

  // Sort routes by specificity (more specific routes first)
  return sortRoutesBySpecificity(routes);
}

/**
 * Discovers API routes from the API directory
 *
 * @param apiDir - Path to the API directory
 * @param options - Route discovery options
 * @returns Array of discovered API routes
 */
export async function discoverApiRoutes(
  apiDir: string,
  options?: Pick<
    RouteDiscoveryOptions,
    "developmentMode" | "excludeDirectories"
  >,
): Promise<DiscoveredRoute[]> {
  const routes: DiscoveredRoute[] = [];
  const excludeDirs = options?.excludeDirectories ?? ["node_modules", ".git"];

  try {
    // Check if directory exists
    const stat = await Deno.stat(apiDir);
    if (!stat.isDirectory) {
      if (options?.developmentMode) {
        console.warn(
          `[route-discovery] API path is not a directory: ${apiDir}`,
        );
      }
      return [];
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      if (options?.developmentMode) {
        console.warn(`[route-discovery] API directory not found: ${apiDir}`);
      }
      return [];
    }
    throw error;
  }

  // Walk through the API directory
  const extensions = API_EXTENSIONS.map((e) => e.slice(1)); // Remove leading dot

  for await (
    const entry of walk(apiDir, {
      includeDirs: false,
      followSymlinks: false,
      exts: extensions,
    })
  ) {
    if (!entry.isFile) continue;

    const relativePath = relative(apiDir, entry.path);

    // Skip files in excluded directories
    if (excludeDirs.some((dir) => relativePath.includes(dir))) {
      continue;
    }

    // Skip private files (in folders starting with _)
    if (isPrivateFile(relativePath)) {
      continue;
    }

    // Skip middleware files
    if (isMiddlewareFile(relativePath)) {
      continue;
    }

    // Convert file path to API route pattern
    const { pattern, params, method } = filePathToApiPattern(relativePath);

    routes.push({
      type: "api",
      filePath: entry.path,
      pattern: `/api${pattern}`,
      params,
      method,
    });
  }

  // Sort routes by specificity (more specific routes first)
  return sortRoutesBySpecificity(routes);
}

/**
 * Converts a file path to a route pattern
 *
 * Handles:
 * - Index files (index.tsx -> /)
 * - Dynamic segments ([param] -> :param)
 * - Catch-all segments ([...slug] -> **)
 * - Route groups ((group) -> removed from path)
 *
 * @param filePath - Relative file path from pages directory
 * @returns Pattern and extracted parameter names
 *
 * @example
 * ```ts
 * filePathToPattern('users/[id].tsx')
 * // { pattern: '/users/:id', params: ['id'] }
 *
 * filePathToPattern('blog/[...slug].tsx')
 * // { pattern: '/blog/**', params: ['slug'] }
 * ```
 */
export function filePathToPattern(filePath: string): FilePathPatternResult {
  const params: string[] = [];

  let pattern = filePath
    // Normalize path separators
    .replace(/\\/g, "/")
    // Remove file extension
    .replace(/\.(tsx|ts|jsx|js|vue|svelte|md|mdx)$/, "")
    // Remove route groups (parentheses)
    .replace(/\([^)]+\)\//g, "")
    .replace(/\([^)]+\)$/, "");

  // Handle index files
  if (basename(pattern) === "index") {
    pattern = dirname(pattern);
    if (pattern === ".") {
      pattern = "";
    }
  }

  // Convert dynamic segments [param] to :param
  // Convert catch-all segments [...slug] to **
  pattern = pattern.replace(/\[([^\]]+)\]/g, (_, param) => {
    if (param.startsWith("...")) {
      // Catch-all segment
      const paramName = param.slice(3);
      params.push(paramName);
      return "**";
    } else {
      // Dynamic segment
      params.push(param);
      return `:${param}`;
    }
  });

  // Ensure leading slash
  if (!pattern.startsWith("/")) {
    pattern = "/" + pattern;
  }

  // Handle root path
  if (pattern === "/" || pattern === "") {
    pattern = "/";
  }

  // Remove trailing slash (except for root)
  if (pattern.length > 1 && pattern.endsWith("/")) {
    pattern = pattern.slice(0, -1);
  }

  return { pattern, params };
}

/**
 * Converts an API file path to a route pattern with optional method extraction
 *
 * Handles:
 * - Method suffix (users.get.ts -> GET method)
 * - Index files (index.ts -> /)
 * - Dynamic segments ([param] -> :param)
 * - Catch-all segments ([...slug] -> **)
 *
 * @param filePath - Relative file path from API directory
 * @returns Pattern, extracted parameter names, and optional HTTP method
 *
 * @example
 * ```ts
 * filePathToApiPattern('users/[id].get.ts')
 * // { pattern: '/users/:id', params: ['id'], method: 'GET' }
 *
 * filePathToApiPattern('users/index.ts')
 * // { pattern: '/users', params: [], method: undefined }
 * ```
 */
export function filePathToApiPattern(
  filePath: string,
): ApiFilePathPatternResult {
  const params: string[] = [];

  // Extract method from filename (e.g., users.get.ts -> GET)
  const methodMatch = filePath.match(
    /\.(get|post|put|delete|patch|head|options)\.(ts|js)$/i,
  );
  const method = methodMatch
    ? (methodMatch[1].toUpperCase() as ApiMethod)
    : undefined;

  let pattern = filePath
    // Normalize path separators
    .replace(/\\/g, "/")
    // Remove method suffix and extension (method is optional)
    .replace(/\.(get|post|put|delete|patch|head|options)\.(ts|js)$/i, "")
    // Remove just extension if no method suffix
    .replace(/\.(ts|js)$/i, "");

  // Handle index files
  if (basename(pattern) === "index") {
    pattern = dirname(pattern);
    if (pattern === ".") {
      pattern = "";
    }
  }

  // Convert dynamic segments [param] to :param
  // Convert catch-all segments [...slug] to **
  pattern = pattern.replace(/\[([^\]]+)\]/g, (_, param) => {
    if (param.startsWith("...")) {
      // Catch-all segment
      const paramName = param.slice(3);
      params.push(paramName);
      return "**";
    } else {
      // Dynamic segment
      params.push(param);
      return `:${param}`;
    }
  });

  // Ensure leading slash
  if (!pattern.startsWith("/")) {
    pattern = "/" + pattern;
  }

  // Handle root path
  if (pattern === "/" || pattern === "") {
    pattern = "/";
  }

  // Remove trailing slash (except for root)
  if (pattern.length > 1 && pattern.endsWith("/")) {
    pattern = pattern.slice(0, -1);
  }

  return { pattern, params, method };
}

/**
 * Checks if a file is in a private folder (starts with _)
 *
 * @param relativePath - Relative file path
 * @returns True if the file is private
 */
export function isPrivateFile(relativePath: string): boolean {
  const pathParts = relativePath.split(/[/\\]/);
  return pathParts.some((part) => part.startsWith("_"));
}

/**
 * Checks if a file is a middleware file
 *
 * @param relativePath - Relative file path
 * @returns True if the file is a middleware file
 */
export function isMiddlewareFile(relativePath: string): boolean {
  const fileName = basename(relativePath);
  return fileName === "_middleware.ts" || fileName === "_middleware.js";
}

/**
 * Calculates route specificity score for sorting
 * Lower score = more specific = higher priority
 *
 * @param route - Discovered route
 * @returns Specificity score
 */
export function calculateRouteSpecificity(route: DiscoveredRoute): number {
  const segments = route.pattern.split("/").filter((s) => s.length > 0);
  let score = 0;

  for (const segment of segments) {
    if (segment === "**") {
      // Catch-all has lowest priority
      score += 1000;
    } else if (segment.startsWith(":")) {
      // Dynamic segment has medium priority
      score += 100;
    } else {
      // Static segment has highest priority
      score += 1;
    }
  }

  // Shorter paths are more specific (for same type of segments)
  score += segments.length;

  return score;
}

/**
 * Sorts routes by specificity (most specific first)
 *
 * @param routes - Array of discovered routes
 * @returns Sorted array of routes
 */
export function sortRoutesBySpecificity(
  routes: DiscoveredRoute[],
): DiscoveredRoute[] {
  return [...routes].sort((a, b) => {
    const scoreA = calculateRouteSpecificity(a);
    const scoreB = calculateRouteSpecificity(b);
    return scoreA - scoreB;
  });
}

/**
 * Validates a route pattern for correctness
 *
 * @param pattern - Route pattern to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateRoutePattern(pattern: string): string[] {
  const errors: string[] = [];

  // Check for leading slash
  if (!pattern.startsWith("/")) {
    errors.push("Route pattern must start with /");
  }

  // Check for malformed dynamic segments
  const malformedSegments = pattern.match(/\[[^\]]*$/g);
  if (malformedSegments) {
    errors.push(
      `Malformed dynamic segments: ${
        malformedSegments.join(", ")
      }. Dynamic segments must be properly closed with ]`,
    );
  }

  // Check for empty dynamic segments
  const emptySegments = pattern.match(/\[\]/g);
  if (emptySegments) {
    errors.push(
      "Empty dynamic segments [] are not allowed. Use [param] for dynamic segments or [...rest] for catch-all",
    );
  }

  // Check for nested dynamic segments
  const nestedSegments = pattern.match(/\[[^\]]*\[[^\]]*\]/g);
  if (nestedSegments) {
    errors.push(
      `Nested dynamic segments are not supported: ${nestedSegments.join(", ")}`,
    );
  }

  return errors;
}

/**
 * Extracts parameter names from a route pattern
 *
 * @param pattern - Route pattern (e.g., /users/:id/posts/:postId)
 * @returns Array of parameter names
 */
export function extractParamsFromPattern(pattern: string): string[] {
  const params: string[] = [];

  // Match :param patterns
  const dynamicMatches = pattern.matchAll(/:([^/]+)/g);
  for (const match of dynamicMatches) {
    params.push(match[1]);
  }

  // Match ** catch-all (represented as unnamed param)
  if (pattern.includes("**")) {
    // The catch-all param name should have been stored during conversion
    // For now, we use a placeholder
    params.push("slug");
  }

  return params;
}

/**
 * Checks if a route pattern matches a given URL path
 *
 * @param pattern - Route pattern
 * @param path - URL path to match
 * @returns True if the pattern matches the path
 */
export function matchRoutePattern(
  pattern: string,
  path: string,
): { matches: boolean; params: Record<string, string> } {
  const params: Record<string, string> = {};

  // Normalize paths
  const normalizedPattern = pattern.replace(/\/$/, "") || "/";
  const normalizedPath = path.replace(/\/$/, "") || "/";

  const patternSegments = normalizedPattern.split("/").filter((s) => s);
  const pathSegments = normalizedPath.split("/").filter((s) => s);

  let patternIndex = 0;
  let pathIndex = 0;

  while (patternIndex < patternSegments.length) {
    const patternSegment = patternSegments[patternIndex];

    if (patternSegment === "**") {
      // Catch-all: match remaining path segments
      const remainingPath = pathSegments.slice(pathIndex).join("/");
      params["slug"] = remainingPath;
      return { matches: true, params };
    }

    if (pathIndex >= pathSegments.length) {
      // No more path segments but pattern has more
      return { matches: false, params: {} };
    }

    const pathSegment = pathSegments[pathIndex];

    if (patternSegment.startsWith(":")) {
      // Dynamic segment: extract param value
      const paramName = patternSegment.slice(1);
      params[paramName] = pathSegment;
    } else if (patternSegment !== pathSegment) {
      // Static segment: must match exactly
      return { matches: false, params: {} };
    }

    patternIndex++;
    pathIndex++;
  }

  // Check if all path segments were consumed
  if (pathIndex < pathSegments.length) {
    return { matches: false, params: {} };
  }

  return { matches: true, params };
}
