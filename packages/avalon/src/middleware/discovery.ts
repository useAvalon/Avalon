/**
 * Simplified Middleware Discovery
 *
 * This module provides a streamlined middleware discovery system that scans
 * for _middleware.ts files in src/pages/ directories.
 *
 * Key features:
 * - Scans src/pages/ for page middleware
 * - Calculates priority based on directory depth (parent before child)
 * - Creates URL patterns for route matching
 *
 * Note: API middleware is handled natively by Nitro and is not scanned here.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { join, relative, resolve } from 'node:path';
import { stat as fsStat, readdir } from 'node:fs/promises';
import type { MiddlewareRoute, MiddlewareDiscoveryOptions } from './types.ts';

/**
 * Default options for middleware discovery
 */
const DEFAULT_OPTIONS: Required<Omit<MiddlewareDiscoveryOptions, 'baseDir'>> = {
  filePattern: '_middleware.ts',
  excludeDirs: ['node_modules', '.git', 'dist', '.output', '.vite'],
  devMode: false,
};

/**
 * Base priority values for different middleware types
 * Lower values execute first
 */
const PRIORITY_BASE = {
  /** Page middleware base priority */
  pages: 50,
} as const;

/**
 * Discovers route-scoped middleware files in the project
 *
 * Scans for _middleware.ts files in:
 * - src/pages/ directory (and subdirectories) for page routes
 *
 * API middleware is handled natively by Nitro and is not scanned here.
 *
 * Middleware files are sorted by priority (directory depth), ensuring
 * parent middleware executes before child middleware.
 *
 * @param options - Discovery options
 * @returns Array of discovered middleware routes, sorted by priority
 *
 * @example
 * ```ts
 * const routes = await discoverScopedMiddleware({
 *   baseDir: 'src',
 *   devMode: true,
 * });
 *
 * // Returns routes like:
 * // [
 * //   { pattern: URLPattern('/blog/*'), filePath: 'src/pages/blog/_middleware.ts', priority: 51, type: 'pages' },
 * // ]
 * ```
 */
export async function discoverScopedMiddleware(
  options: MiddlewareDiscoveryOptions
): Promise<MiddlewareRoute[]> {
  const {
    baseDir,
    filePattern = DEFAULT_OPTIONS.filePattern,
    excludeDirs = DEFAULT_OPTIONS.excludeDirs,
    devMode = DEFAULT_OPTIONS.devMode,
  } = options;

  const resolvedBaseDir = resolve(baseDir);
  const routes: MiddlewareRoute[] = [];

  // Scan pages directory for page middleware
  const pagesDir = join(resolvedBaseDir, 'pages');
  await scanDirectory(pagesDir, 'pages', filePattern, excludeDirs, routes, devMode);

  // Sort by priority (lower numbers execute first)
  routes.sort((a, b) => a.priority - b.priority);

  if (devMode && routes.length > 0) {
    console.log(`[middleware] Discovered ${routes.length} route-scoped middleware:`);
    for (const route of routes) {
      console.log(`  - ${route.type}: ${route.filePath} (priority: ${route.priority})`);
    }
  }

  return routes;
}

/**
 * Scans a directory recursively for middleware files
 *
 * @param dir - Directory to scan
 * @param type - Middleware type ('pages')
 * @param filePattern - File pattern to match
 * @param excludeDirs - Directories to exclude
 * @param routes - Array to collect discovered routes
 * @param devMode - Whether to log debug information
 */
async function scanDirectory(
  dir: string,
  type: 'pages',
  filePattern: string,
  excludeDirs: string[],
  routes: MiddlewareRoute[],
  devMode: boolean
): Promise<void> {
  try {
    // Check if directory exists
    const dirInfo = await fsStat(dir).catch(() => null);
    if (!dirInfo?.isDirectory()) {
      return;
    }

    // Recursively scan directory
    await scanDirectoryRecursive(dir, dir, type, filePattern, excludeDirs, routes, devMode);
  } catch (error) {
    // Directory doesn't exist or can't be read - skip silently
    if (devMode && (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== 'ENOENT')) {
      console.warn(`[middleware] Error scanning ${dir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Recursively scans a directory for middleware files
 *
 * @param rootDir - Root directory being scanned
 * @param currentDir - Current directory being scanned
 * @param type - Middleware type
 * @param filePattern - File pattern to match
 * @param excludeDirs - Directories to exclude
 * @param routes - Array to collect discovered routes
 * @param devMode - Whether to log debug information
 */
async function scanDirectoryRecursive(
  rootDir: string,
  currentDir: string,
  type: 'pages',
  filePattern: string,
  excludeDirs: string[],
  routes: MiddlewareRoute[],
  devMode: boolean
): Promise<void> {
  try {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      // Skip excluded directories
      if (entry.isDirectory() && excludeDirs.includes(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        await scanDirectoryRecursive(rootDir, fullPath, type, filePattern, excludeDirs, routes, devMode);
      } else if (entry.name === filePattern) {
        // Found a middleware file
        const relativePath = relative(rootDir, currentDir);
        const route = createMiddlewareRoute(fullPath, relativePath, type);
        routes.push(route);
      }
    }
  } catch (error) {
    if (devMode && (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== 'ENOENT')) {
      console.warn(`[middleware] Error reading ${currentDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Creates a middleware route configuration from a file path
 *
 * @param filePath - Absolute path to the middleware file
 * @param relativePath - Path relative to the pages directory
 * @param type - Middleware type
 * @returns Middleware route configuration
 *
 * @example
 * ```ts
 * // For src/pages/blog/_middleware.ts
 * createMiddlewareRoute('/abs/path/src/pages/blog/_middleware.ts', 'blog', 'pages')
 * // Returns: { pattern: URLPattern('/blog/*'), filePath: '...', priority: 51, type: 'pages' }
 * ```
 */
function createMiddlewareRoute(
  filePath: string,
  relativePath: string,
  type: 'pages'
): MiddlewareRoute {
  // Calculate URL pattern from relative path
  // relativePath is the directory path relative to pages/
  // e.g., 'blog' for src/pages/blog/_middleware.ts
  // e.g., '' for src/pages/_middleware.ts (root middleware)

  // Page middleware: /* or /blog{/*}?
  // Use {/*}? to match both /blog and /blog/anything
  const urlPattern = relativePath ? `/${relativePath}{/*}?` : '/*';

  // Calculate priority based on directory depth
  // Shallower directories have lower priority (execute first)
  const depth = relativePath ? relativePath.split('/').filter(Boolean).length : 0;
  const priority = PRIORITY_BASE[type] + depth;

  return {
    pattern: new URLPattern({ pathname: urlPattern }),
    filePath,
    priority,
    type,
  };
}

/**
 * Gets middleware routes that match a given URL
 *
 * Filters discovered routes to only include those that match the URL,
 * respecting type isolation (page middleware doesn't run for API routes
 * and vice versa).
 *
 * @param routes - All discovered middleware routes
 * @param url - URL to match against
 * @returns Matching routes, sorted by priority
 *
 * @example
 * ```ts
 * const allRoutes = await discoverScopedMiddleware({ baseDir: 'src' });
 * const matchingRoutes = getMatchingMiddleware(allRoutes, new URL('http://localhost/blog/post-1'));
 * ```
 */
export function getMatchingMiddleware(
  routes: MiddlewareRoute[],
  url: URL
): MiddlewareRoute[] {
  const isApiRoute = url.pathname.startsWith('/api');

  return routes.filter(route => {
    // Check if pattern matches the URL
    if (!route.pattern.test(url)) {
      return false;
    }

    // Type isolation: page middleware doesn't run for API routes
    if (route.type === 'pages' && isApiRoute) {
      return false;
    }

    return true;
  });
}

/**
 * Clears the middleware discovery cache
 *
 * This is a no-op in the simplified discovery module since we don't
 * maintain a persistent cache. The function is provided for API
 * compatibility with the executor module.
 */
export function clearDiscoveryCache(): void {
  // No-op: simplified discovery doesn't maintain a persistent cache
  // Each call to discoverScopedMiddleware scans the file system
}
