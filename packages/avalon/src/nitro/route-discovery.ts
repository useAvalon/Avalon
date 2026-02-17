/**
 * Route Discovery Module for Nitro
 *
 * This module provides minimal route discovery for Avalon's SSR pages.
 * 
 * IMPORTANT: This module is simplified to complement Nitro's native routing:
 * - API routes: Handled by Nitro's auto-discovery from `api/` directory
 * - Page routes: Discovered here for SSR rendering (pages are components, not h3 handlers)
 * - Middleware: Handled by Nitro's auto-discovery from `middleware/` directory
 *
 * The page discovery is needed because Avalon pages are React/Vue/Svelte components
 * that require SSR rendering, which is different from Nitro's h3 route handlers.
 *
 * @module nitro/route-discovery
 */

import { basename, dirname, relative } from "node:path";
import { walk } from "../utils/std-fs-shim.ts";
import type { DiscoveredRoute } from "./types.ts";

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
 * Options for page route discovery
 */
export interface PageDiscoveryOptions {
  /** Pages directory path (absolute or relative to project root) */
  pagesDir: string;
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
 * Discovers page routes from the pages directory for SSR rendering
 *
 * NOTE: This is specifically for page components that need SSR rendering.
 * API routes should be placed in the `api/` directory and are auto-discovered
 * by Nitro's native file-system routing.
 *
 * @param pagesDir - Path to the pages directory
 * @param options - Discovery options
 * @returns Array of discovered page routes
 *
 * @example
 * ```ts
 * const routes = await discoverPageRoutes('src/pages', {
 *   developmentMode: true,
 * });
 * ```
 */
export async function discoverPageRoutes(
  pagesDir: string,
  options?: Pick<PageDiscoveryOptions, "developmentMode" | "excludeDirectories">
): Promise<DiscoveredRoute[]> {
  const routes: DiscoveredRoute[] = [];
  const excludeDirs = options?.excludeDirectories ?? ["node_modules", ".git"];

  try {
    // Check if directory exists
    const stat = await Deno.stat(pagesDir);
    if (!stat.isDirectory) {
      if (options?.developmentMode) {
        console.warn(
          `[route-discovery] Pages path is not a directory: ${pagesDir}`
        );
      }
      return [];
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      if (options?.developmentMode) {
        console.warn(
          `[route-discovery] Pages directory not found: ${pagesDir}`
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
  routes: DiscoveredRoute[]
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
      `Malformed dynamic segments: ${malformedSegments.join(", ")}. Dynamic segments must be properly closed with ]`
    );
  }

  // Check for empty dynamic segments
  const emptySegments = pattern.match(/\[\]/g);
  if (emptySegments) {
    errors.push(
      "Empty dynamic segments [] are not allowed. Use [param] for dynamic segments or [...rest] for catch-all"
    );
  }

  // Check for nested dynamic segments
  const nestedSegments = pattern.match(/\[[^\]]*\[[^\]]*\]/g);
  if (nestedSegments) {
    errors.push(
      `Nested dynamic segments are not supported: ${nestedSegments.join(", ")}`
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
  path: string
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


