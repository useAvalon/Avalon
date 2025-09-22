# Middleware System API Documentation

This document provides comprehensive TypeScript documentation for the middleware system.

## Core Interfaces

### MiddlewareContext

The `MiddlewareContext` interface provides access to request information and allows middleware to share data.

```typescript
interface MiddlewareContext {
	/** The original HTTP request object */
	request: Request;

	/** Parsed URL object with pathname, search params, etc. */
	url: URL;

	/** Route parameters extracted from the URL pattern */
	params: Record<string, string>;

	/** Query string parameters as key-value pairs */
	query: Record<string, string | string[]>;

	/** State map for sharing data between middleware in the chain */
	state: Map<string, unknown>;

	/** Locals object for middleware-specific data storage */
	locals: Record<string, unknown>;
}
```

#### Usage Examples

```typescript
// Access request information
const method = context.request.method;
const headers = context.request.headers;
const body = await context.request.json();

// Access URL information
const pathname = context.url.pathname;
const searchParams = context.url.searchParams;

// Access route parameters (e.g., /users/:id)
const userId = context.params.id;

// Access query parameters
const page = context.query.page;
const filters = context.query.filter; // Can be string or string[]

// Share data between middleware
context.state.set('user', userObject);
context.locals.requestId = generateId();
```

### MiddlewareResponse

The `MiddlewareResponse` interface defines the return type for middleware functions.

```typescript
interface MiddlewareResponse {
	/** Optional HTTP response to return (terminates middleware chain) */
	response?: Response;

	/** Whether to continue to the next middleware (ignored if response is provided) */
	continue: boolean;
}
```

#### Usage Examples

```typescript
// Continue to next middleware
return { continue: true };

// Return early with a response
return {
	response: new Response('Unauthorized', { status: 401 }),
	continue: false,
};

// Continue after modifying context
context.locals.user = user;
return await next();
```

### MiddlewareHandler

The `MiddlewareHandler` type defines the signature for middleware functions.

```typescript
type MiddlewareHandler = (
	context: MiddlewareContext,
	next: () => Promise<MiddlewareResponse>
) => Promise<MiddlewareResponse>;
```

#### Implementation Pattern

```typescript
export default async function myMiddleware(
	context: MiddlewareContext,
	next: () => Promise<MiddlewareResponse>
): Promise<MiddlewareResponse> {
	// Pre-processing logic
	console.log(`Processing ${context.request.method} ${context.url.pathname}`);

	// Call next middleware
	const result = await next();

	// Post-processing logic (if needed)
	if (result.response) {
		// Modify response headers, etc.
	}

	return result;
}
```

## Core Classes

### MiddlewareDiscovery

The `MiddlewareDiscovery` class is responsible for scanning the file system and building middleware chains.

```typescript
class MiddlewareDiscovery {
	/**
	 * Discover all middleware files in the src directory
	 * @returns Array of middleware routes with patterns and priorities
	 */
	async discoverMiddleware(): Promise<MiddlewareRoute[]>;

	/**
	 * Build middleware chain for a specific URL
	 * @param url - The request URL to match against
	 * @returns Array of middleware handlers in execution order
	 */
	buildMiddlewareChain(url: URL): Promise<MiddlewareHandler[]>;

	/**
	 * Enable file watching for hot reloading in development
	 */
	enableWatchMode(): void;

	/**
	 * Clear middleware cache (useful for testing)
	 */
	clearCache(): void;
}
```

#### Usage Example

```typescript
const discovery = new MiddlewareDiscovery();
await discovery.discoverMiddleware();

const url = new URL('https://example.com/admin/dashboard');
const middlewareChain = await discovery.buildMiddlewareChain(url);
```

### MiddlewareExecutor

The `MiddlewareExecutor` class handles the execution of middleware chains.

```typescript
class MiddlewareExecutor {
	/**
	 * Execute a middleware chain with the given context
	 * @param middlewareChain - Array of middleware handlers to execute
	 * @param context - The middleware context
	 * @returns Response if middleware chain returns one, null otherwise
	 */
	async execute(middlewareChain: MiddlewareHandler[], context: MiddlewareContext): Promise<Response | null>;
}
```

#### Usage Example

```typescript
const executor = new MiddlewareExecutor();
const context = createMiddlewareContext(request);
const response = await executor.execute(middlewareChain, context);

if (response) {
	return response; // Middleware returned a response
}
// Continue with route handling
```

### MiddlewareErrorHandler

The `MiddlewareErrorHandler` class provides centralized error handling for the middleware system.

```typescript
class MiddlewareErrorHandler {
	/**
	 * Handle errors that occur during middleware discovery
	 * @param error - The error that occurred
	 * @param filePath - Path to the middleware file that caused the error
	 */
	handleDiscoveryError(error: Error, filePath: string): void;

	/**
	 * Handle errors that occur during middleware execution
	 * @param error - The error that occurred
	 * @param middleware - Name/path of the middleware that failed
	 * @param context - The middleware context
	 * @returns Error response to send to client
	 */
	handleExecutionError(error: Error, middleware: string, context: MiddlewareContext): Response;

	/**
	 * Handle errors in middleware chain construction
	 * @param error - The error that occurred
	 * @param chain - The middleware chain being constructed
	 * @returns Error response to send to client
	 */
	handleChainError(error: Error, chain: MiddlewareChain): Response;
}
```

## Supporting Types

### MiddlewareRoute

Represents a discovered middleware file with its URL pattern and execution priority.

```typescript
interface MiddlewareRoute {
	/** URL pattern to match requests against */
	pattern: URLPattern;

	/** File system path to the middleware file */
	middlewarePath: string;

	/** Execution priority (lower numbers execute first) */
	priority: number;
}
```

### MiddlewareChain

Represents a complete middleware chain for a specific route.

```typescript
interface MiddlewareChain {
	/** Global middleware handlers */
	global: MiddlewareHandler[];

	/** Scoped middleware handlers (pages or api) */
	scoped: MiddlewareHandler[];

	/** The route pattern this chain applies to */
	route: string;

	/** Total number of middleware in the chain */
	totalMiddleware: number;
}
```

## Utility Functions

### createMiddlewareContext

Creates a middleware context from an HTTP request.

```typescript
function createMiddlewareContext(request: Request, params?: Record<string, string>): MiddlewareContext {
	const url = new URL(request.url);

	return {
		request,
		url,
		params: params || {},
		query: Object.fromEntries(url.searchParams),
		state: new Map(),
		locals: {},
	};
}
```

### isMiddlewareFile

Checks if a file path represents a middleware file.

```typescript
function isMiddlewareFile(filePath: string): boolean {
	return filePath.endsWith('_middleware.ts') || filePath.endsWith('_middleware.js');
}
```

### getMiddlewarePriority

Calculates the execution priority for a middleware based on its file path.

```typescript
function getMiddlewarePriority(filePath: string): number {
	// Global middleware has highest priority (lowest number)
	if (filePath === 'src/_middleware.ts') return 0;

	// Count directory depth for scoped middleware
	const depth = filePath.split('/').length - 2; // Subtract 'src' and filename
	return depth;
}
```

## Error Classes

### Custom Error Types

The middleware system defines several custom error types for better error handling:

```typescript
/** Thrown when request validation fails */
class ValidationError extends Error {
	constructor(message: string, public details?: Record<string, string[]>) {
		super(message);
		this.name = 'ValidationError';
	}
}

/** Thrown when authentication is required but not provided */
class AuthenticationError extends Error {
	constructor(message: string = 'Authentication required') {
		super(message);
		this.name = 'AuthenticationError';
	}
}

/** Thrown when user lacks required permissions */
class AuthorizationError extends Error {
	constructor(message: string = 'Access denied') {
		super(message);
		this.name = 'AuthorizationError';
	}
}

/** Thrown when a requested resource is not found */
class NotFoundError extends Error {
	constructor(message: string = 'Resource not found') {
		super(message);
		this.name = 'NotFoundError';
	}
}
```

## Integration Points

### Server Integration

The middleware system integrates with the existing server request handler:

```typescript
// In src/render/server.ts
async function requestHandler(req: Request): Promise<Response> {
	const middlewareDiscovery = new MiddlewareDiscovery();
	const middlewareExecutor = new MiddlewareExecutor();

	// Build middleware chain
	const url = new URL(req.url);
	const middlewareChain = await middlewareDiscovery.buildMiddlewareChain(url);

	// Create context
	const context = createMiddlewareContext(req);

	// Execute middleware
	const middlewareResult = await middlewareExecutor.execute(middlewareChain, context);

	if (middlewareResult) {
		return middlewareResult;
	}

	// Continue with existing route handling...
}
```

### API Integration

The middleware system integrates with API route handling:

```typescript
// In src/functions/api.ts
export async function handleApiRequest(
	request: Request,
	routes: ApiRoute[],
	middlewareContext?: MiddlewareContext
): Promise<Response> {
	// Use middleware context if provided
	const context = middlewareContext || createMiddlewareContext(request);

	// API route handling with middleware context...
}
```

## Best Practices

### Middleware Organization

1. **Global middleware** (`src/_middleware.ts`): Cross-cutting concerns like CORS, logging, security headers
2. **Scoped middleware** (`src/pages/_middleware.ts`, `src/api/_middleware.ts`): Route-type specific logic
3. **Nested middleware**: Specific authentication, authorization, validation

### Error Handling

1. Use custom error classes for different error types
2. Implement global error handler middleware early in the chain
3. Provide different error responses for API vs page routes
4. Include detailed error information in development mode only

### Performance

1. Keep global middleware lightweight
2. Use early returns to avoid unnecessary processing
3. Cache middleware chains in production
4. Implement request timeouts for long-running operations

### Security

1. Validate and sanitize all inputs in middleware
2. Implement rate limiting for API routes
3. Add security headers in global middleware
4. Use HTTPS-only cookies for session management
