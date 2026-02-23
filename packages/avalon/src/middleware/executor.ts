/**
 * Simplified Middleware Executor
 *
 * This module provides a streamlined middleware execution system that aligns
 * with Nitro's conventions while supporting Avalon's route-scoped middleware.
 *
 * Key features:
 * - Nitro-style handler signature: return void to continue, return Response to terminate
 * - Middleware caching for performance

 * - Error propagation to Nitro's error handling
 * - Context preservation: event.context modifications persist through the chain
 * - Development logging for context changes
 *
 * Requirements: 1.2, 1.3, 1.4, 2.1, 2.2
 */

import type { H3Event } from 'h3';
import type { MiddlewareHandler, MiddlewareRoute, MiddlewareFileExport, MiddlewareExecutorOptions } from './types.ts';
import { getMatchingMiddleware } from './discovery.ts';

/**
 * Captures a snapshot of the event context for comparison
 * Used in development mode to log context changes
 */
function captureContextSnapshot(context: Record<string, unknown>): Map<string, unknown> {
	const snapshot = new Map<string, unknown>();
	for (const key of Object.keys(context)) {
		snapshot.set(key, context[key]);
	}
	return snapshot;
}

/**
 * Compares two context snapshots and returns the changes
 * Used in development mode to log context modifications
 */
function getContextChanges(
	before: Map<string, unknown>,
	after: Record<string, unknown>,
): { added: string[]; modified: string[]; removed: string[] } {
	const added: string[] = [];
	const modified: string[] = [];
	const removed: string[] = [];

	for (const key of Object.keys(after)) {
		if (!before.has(key)) {
			added.push(key);
		} else if (before.get(key) !== after[key]) {
			modified.push(key);
		}
	}

	for (const key of before.keys()) {
		if (!(key in after)) {
			removed.push(key);
		}
	}

	return { added, modified, removed };
}

/**
 * Logs context changes in development mode
 * Requirements: 2.1, 2.2
 *
 * Note: Intentionally minimal to reduce log noise.
 * Uncomment the body for debugging middleware context issues.
 */
function logContextChanges(
	_filePath: string,
	_changes: { added: string[]; modified: string[]; removed: string[] },
): void {
	// Uncomment for debugging middleware context issues:
	// const hasChanges = _changes.added.length > 0 || _changes.modified.length > 0 || _changes.removed.length > 0;
	// if (!hasChanges) return;
	// console.log(`[middleware] Context changes in ${_filePath}: ...`);
}

/** Default executor options */
const DEFAULT_OPTIONS: Required<MiddlewareExecutorOptions> = {
	devMode: false,
	timeout: 30000,
};

/** Middleware cache: maps file paths to loaded handlers */
const middlewareCache = new Map<string, MiddlewareHandler>();

/**
 * Executes a single middleware route handler with context tracking.
 * Returns the Response if the chain should terminate, undefined to continue.
 */
async function executeMiddlewareRoute(
	event: H3Event,
	route: MiddlewareRoute,
	devMode: boolean,
	timeout: number,
): Promise<Response | undefined> {
	const handler = await loadMiddleware(route.filePath, devMode);
	if (!handler) return undefined;

	const contextBefore = devMode ? captureContextSnapshot(event.context) : null;

	const result = await executeWithTimeout(() => handler(event), timeout, route.filePath);

	if (devMode && contextBefore) {
		const changes = getContextChanges(contextBefore, event.context);
		logContextChanges(route.filePath, changes);
	}

	const response = handleMiddlewareResult(result, route.filePath, devMode);
	if (response && devMode) {
		console.log(`[middleware] Chain terminated by ${route.filePath}`);
	}
	return response;
}

/**
 * Executes route-scoped middleware chain for a request
 *
 * 1. Finds middleware that matches the request URL
 * 2. Executes them in priority order (parent before child)
 * 3. Handles void return (continue) and Response return (terminate)
 * 4. Propagates errors to Nitro's error handling
 * 5. Preserves event.context modifications across the chain
 * 6. Logs context changes in development mode
 *
 * @param event - H3 event object from Nitro
 * @param routes - Discovered middleware routes from discoverScopedMiddleware
 * @param options - Execution options
 * @returns Response if middleware terminated the chain, undefined otherwise
 */
export async function executeScopedMiddleware(
	event: H3Event,
	routes: MiddlewareRoute[],
	options: MiddlewareExecutorOptions = {},
): Promise<Response | undefined> {
	const { devMode, timeout } = { ...DEFAULT_OPTIONS, ...options };

	const url = buildUrlFromEvent(event);
	const matchingRoutes = getMatchingMiddleware(routes, url);

	if (matchingRoutes.length === 0) {
		return undefined;
	}

	for (const route of matchingRoutes) {
		try {
			const response = await executeMiddlewareRoute(event, route, devMode, timeout);
			if (response) return response;
		} catch (error) {
			if (devMode) {
				console.error(`[middleware] Error in ${route.filePath}:`, error);
			}
			throw error;
		}
	}

	return undefined;
}

/**
 * Builds a URL object from an H3 event.
 * Supports both h3 v2 (event.url / event.req.url) and the dev-mode mock shape (event.path).
 */
function buildUrlFromEvent(event: H3Event): URL {
	const base = 'http://localhost';

	// h3 v2: event.url is a string
	if (typeof (event as any).url === 'string') {
		return new URL((event as any).url, base);
	}

	// h3 v2: event.req is a Web Request
	if ((event as any).req?.url) {
		return new URL((event as any).req.url, base);
	}

	// Dev-mode mock: event.path
	if ((event as any).path) {
		return new URL((event as any).path, base);
	}

	// Legacy h3 v1: event.node.req.url
	if ((event as any).node?.req?.url) {
		return new URL((event as any).node.req.url, base);
	}

	return new URL('/', base);
}

/**
 * Converts an absolute file path to a valid ESM import specifier.
 * Windows absolute paths (C:\...) are converted to file:// URLs.
 * On Unix, the path is returned as-is (no-op).
 */
export function toImportSpecifier(filePath: string): string {
	if (/^[A-Za-z]:[\\/]/.test(filePath)) {
		return `file:///${filePath.replaceAll('\\', '/')}`;
	}
	return filePath;
}

/**
 * Loads a middleware handler via Vite's ssrLoadModule (dev) or dynamic import (prod/worker).
 */
async function loadMiddleware(filePath: string, devMode: boolean): Promise<MiddlewareHandler | null> {
	if (!devMode && middlewareCache.has(filePath)) {
		return middlewareCache.get(filePath)!;
	}

	try {
		let module: MiddlewareFileExport;

		const viteServer = globalThis.__viteDevServer;
		if (devMode && viteServer) {
			const viteRoot = viteServer.config.root || '';
			const vitePath = filePath.startsWith(viteRoot) ? '/' + filePath.slice(viteRoot.length + 1) : filePath;
			module = (await viteServer.ssrLoadModule(vitePath)) as MiddlewareFileExport;
		} else {
			const importPath = toImportSpecifier(filePath);
			module = (await import(/* @vite-ignore */ importPath)) as MiddlewareFileExport;
		}

		if (!module.default || typeof module.default !== 'function') {
			if (devMode) {
				console.warn(`[middleware] ${filePath} does not export a default function`);
			}
			return null;
		}

		if (!devMode) {
			middlewareCache.set(filePath, module.default);
		}

		return module.default;
	} catch (error) {
		if (devMode) {
			console.error(`[middleware] Failed to load ${filePath}:`, error);
		}
		return null;
	}
}

/**
 * Executes a middleware handler with a timeout
 */
async function executeWithTimeout<T>(fn: () => T | Promise<T>, timeout: number, filePath: string): Promise<T> {
	return Promise.race([
		Promise.resolve(fn()),
		new Promise<never>((_, reject) => {
			setTimeout(() => {
				reject(new Error(`Middleware timeout after ${timeout}ms: ${filePath}`));
			}, timeout);
		}),
	]);
}

/**
 * Handles the result of a middleware execution.
 * Supports Nitro-style (void/Response) format.
 */
function handleMiddlewareResult(result: unknown, filePath: string, devMode: boolean): Response | undefined {
	if (result === undefined || result === null) {
		return undefined;
	}

	if (result instanceof Response) {
		return result;
	}

	if (devMode) {
		console.warn(
			`[middleware] ${filePath} returned unexpected value: ${typeof result}. ` +
				`Expected void or Response.`,
		);
	}

	return undefined;
}

/** Clears the middleware cache (e.g. during hot reload) */
export function clearMiddlewareCache(): void {
	middlewareCache.clear();
}

/** Removes a specific middleware from the cache */
export function invalidateMiddleware(filePath: string): boolean {
	return middlewareCache.delete(filePath);
}

/** Gets the current size of the middleware cache */
export function getMiddlewareCacheSize(): number {
	return middlewareCache.size;
}

/** Checks if a key exists in event.context */
export function hasContextValue(event: H3Event, key: string): boolean {
	return key in event.context;
}

/** Gets a typed value from event.context */
export function getContextValue<T>(event: H3Event, key: string): T | undefined {
	return event.context[key] as T | undefined;
}

/** Sets a value in event.context with optional development logging */
export function setContextValue<T>(event: H3Event, key: string, value: T, devMode: boolean = false): void {
	const isNew = !(key in event.context);
	event.context[key] = value;

	if (devMode) {
		console.log(`[middleware] Context ${isNew ? 'set' : 'updated'}: ${key}`);
	}
}
