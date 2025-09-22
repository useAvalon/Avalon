import { MiddlewareContext } from '../../schemas/middleware.ts';
import type { LayoutContext } from '../../types/layout.ts';

/**
 * Middleware Context Manager
 * Handles context creation, initialization, and state management for middleware execution
 * Requirements: 4.1, 4.2, 4.3
 */
export class MiddlewareContextManager {
	/**
	 * Creates a new middleware context for a request
	 * Requirements: 4.1 - middleware receives request context including URL, method, headers, and body
	 */
	static createContext(request: Request, params: Record<string, string> = {}): MiddlewareContext {
		const url = new URL(request.url);
		const query = this.parseQueryString(url.searchParams);

		return {
			request,
			url,
			params,
			query,
			state: new Map<string, unknown>(),
			locals: {},
		};
	}

	/**
	 * Initializes context with extracted parameters and query data
	 * Requirements: 4.1 - context includes URL, method, headers, and body
	 */
	static initializeContext(
		request: Request,
		routeParams: Record<string, string> = {},
		additionalLocals: Record<string, unknown> = {}
	): MiddlewareContext {
		const context = this.createContext(request, routeParams);

		// Add any additional locals data
		Object.assign(context.locals, additionalLocals);

		return context;
	}

	/**
	 * Parses URL search parameters into query object
	 * Handles both single values and arrays for repeated parameters
	 */
	private static parseQueryString(searchParams: URLSearchParams): Record<string, string | string[]> {
		const query: Record<string, string | string[]> = {};

		for (const [key, value] of searchParams.entries()) {
			if (key in query) {
				// Convert to array if multiple values exist
				const existing = query[key];
				if (Array.isArray(existing)) {
					existing.push(value);
				} else {
					query[key] = [existing, value];
				}
			} else {
				query[key] = value;
			}
		}

		return query;
	}

	/**
	 * Extracts route parameters from URL pattern matching
	 * Requirements: 4.1 - context includes extracted parameters
	 */
	static extractRouteParams(url: URL, pattern: URLPattern): Record<string, string> {
		const match = pattern.exec(url);
		const groups = match?.pathname?.groups || {};

		// Filter out undefined values and ensure all values are strings
		const params: Record<string, string> = {};
		for (const [key, value] of Object.entries(groups)) {
			if (value !== undefined) {
				params[key] = value;
			}
		}

		return params;
	}

	/**
	 * Sets state data in middleware context
	 * Requirements: 4.2 - middleware can modify request context and pass data to subsequent middleware
	 */
	static setState(context: MiddlewareContext, key: string, value: unknown): void {
		context.state.set(key, value);
	}

	/**
	 * Gets state data from middleware context
	 * Requirements: 4.2 - middleware can access data from previous middleware
	 */
	static getState<T = unknown>(context: MiddlewareContext, key: string): T | undefined {
		return context.state.get(key) as T | undefined;
	}

	/**
	 * Checks if state key exists in context
	 */
	static hasState(context: MiddlewareContext, key: string): boolean {
		return context.state.has(key);
	}

	/**
	 * Removes state data from context
	 */
	static deleteState(context: MiddlewareContext, key: string): boolean {
		return context.state.delete(key);
	}

	/**
	 * Clears all state data from context
	 */
	static clearState(context: MiddlewareContext): void {
		context.state.clear();
	}

	/**
	 * Sets locals data in middleware context
	 * Requirements: 4.3 - locals object for middleware-specific data storage
	 */
	static setLocal(context: MiddlewareContext, key: string, value: unknown): void {
		context.locals[key] = value;
	}

	/**
	 * Gets locals data from middleware context
	 * Requirements: 4.3 - access to locals object data
	 */
	static getLocal<T = unknown>(context: MiddlewareContext, key: string): T | undefined {
		return context.locals[key] as T | undefined;
	}

	/**
	 * Checks if locals key exists in context
	 */
	static hasLocal(context: MiddlewareContext, key: string): boolean {
		return key in context.locals;
	}

	/**
	 * Removes locals data from context
	 */
	static deleteLocal(context: MiddlewareContext, key: string): boolean {
		const exists = key in context.locals;
		delete context.locals[key];
		return exists;
	}

	/**
	 * Merges additional locals data into context
	 */
	static mergeLocals(context: MiddlewareContext, locals: Record<string, unknown>): void {
		Object.assign(context.locals, locals);
	}

	/**
	 * Creates a copy of the context with optional modifications
	 * Useful for creating isolated contexts for nested middleware execution
	 */
	static cloneContext(context: MiddlewareContext, modifications: Partial<MiddlewareContext> = {}): MiddlewareContext {
		return {
			request: context.request,
			url: context.url,
			params: { ...context.params },
			query: { ...context.query },
			state: new Map(context.state),
			locals: { ...context.locals },
			...modifications,
		};
	}

	/**
	 * Validates that a context object has all required properties
	 */
	static validateContext(context: unknown): context is MiddlewareContext {
		if (!context || typeof context !== 'object') {
			return false;
		}

		const ctx = context as Record<string, unknown>;

		return (
			ctx.request instanceof Request &&
			ctx.url instanceof URL &&
			typeof ctx.params === 'object' &&
			ctx.params !== null &&
			typeof ctx.query === 'object' &&
			ctx.query !== null &&
			ctx.state instanceof Map &&
			typeof ctx.locals === 'object' &&
			ctx.locals !== null
		);
	}

	/**
	 * Serializes context state and locals for debugging/logging
	 * Note: Request and URL objects are not serialized due to their complexity
	 */
	static serializeContext(context: MiddlewareContext): Record<string, unknown> {
		return {
			url: context.url.toString(),
			method: context.request.method,
			params: context.params,
			query: context.query,
			state: Object.fromEntries(context.state),
			locals: context.locals,
		};
	}

	/**
	 * Gets request headers as a plain object
	 */
	static getRequestHeaders(context: MiddlewareContext): Record<string, string> {
		const headers: Record<string, string> = {};
		context.request.headers.forEach((value, key) => {
			headers[key] = value;
		});
		return headers;
	}

	/**
	 * Gets request body as text (if available)
	 * Note: This clones the request to avoid consuming the body stream
	 */
	static async getRequestBody(context: MiddlewareContext): Promise<string | null> {
		try {
			const clonedRequest = context.request.clone();
			return await clonedRequest.text();
		} catch {
			return null;
		}
	}

	/**
	 * Gets request body as JSON (if available and valid JSON)
	 */
	static async getRequestJSON<T = unknown>(context: MiddlewareContext): Promise<T | null> {
		try {
			const clonedRequest = context.request.clone();
			return (await clonedRequest.json()) as T;
		} catch {
			return null;
		}
	}

	/**
	 * Checks if request has a specific content type
	 */
	static hasContentType(context: MiddlewareContext, contentType: string): boolean {
		const requestContentType = context.request.headers.get('content-type');
		return requestContentType?.includes(contentType) ?? false;
	}

	/**
	 * Gets the request method in uppercase
	 */
	static getMethod(context: MiddlewareContext): string {
		return context.request.method.toUpperCase();
	}

	/**
	 * Checks if request method matches any of the provided methods
	 */
	static isMethod(context: MiddlewareContext, ...methods: string[]): boolean {
		const requestMethod = this.getMethod(context);
		return methods.map(m => m.toUpperCase()).includes(requestMethod);
	}

	/**
	 * Gets the request pathname
	 */
	static getPathname(context: MiddlewareContext): string {
		return context.url.pathname;
	}

	/**
	 * Checks if the request pathname matches a pattern
	 */
	static matchesPath(context: MiddlewareContext, pattern: string | RegExp): boolean {
		const pathname = this.getPathname(context);
		if (typeof pattern === 'string') {
			return pathname === pattern || pathname.startsWith(pattern);
		}
		return pattern.test(pathname);
	}

	/**
	 * Create layout context from middleware context
	 * Requirements: 8.1, 8.2, 8.3 - Add layout context passing to middleware system
	 */
	static createLayoutContext(middlewareContext: MiddlewareContext): LayoutContext {
		// Convert query object to URLSearchParams
		const query = new URLSearchParams();
		for (const [key, value] of Object.entries(middlewareContext.query)) {
			if (Array.isArray(value)) {
				value.forEach(v => query.append(key, v));
			} else {
				query.set(key, value);
			}
		}

		return {
			request: middlewareContext.request,
			params: middlewareContext.params,
			query,
			state: middlewareContext.state,
			middlewareContext,
		};
	}

	/**
	 * Extract layout-relevant information from middleware context
	 */
	static extractLayoutInfo(context: MiddlewareContext): {
		routePath: string;
		params: Record<string, string>;
		query: URLSearchParams;
		headers: Headers;
	} {
		return {
			routePath: this.getPathname(context),
			params: context.params,
			query: new URLSearchParams(context.query as any),
			headers: context.request.headers,
		};
	}
}
