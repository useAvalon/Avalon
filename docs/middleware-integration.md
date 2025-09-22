# Middleware Integration Guide

This guide explains how the middleware system integrates with existing route handlers and how to migrate existing code to use middleware.

## Integration Overview

The middleware system integrates seamlessly with the existing routing architecture by:

1. **Intercepting requests** before they reach route handlers
2. **Providing context** to route handlers through middleware processing
3. **Maintaining backward compatibility** with existing route handlers
4. **Supporting hot reloading** in development mode

## Server Integration

### Request Handler Integration

The middleware system integrates into the main request handler in `src/render/server.ts`:

```typescript
// Before: Simple route matching
async function requestHandler(req: Request): Promise<Response> {
	const url = new URL(req.url);

	// Direct route matching
	if (url.pathname.startsWith('/api/')) {
		return handleApiRequest(req, apiRoutes);
	}

	return handlePageRequest(req);
}

// After: With middleware integration
async function requestHandler(req: Request): Promise<Response> {
	const url = new URL(req.url);

	// Initialize middleware system
	const middlewareDiscovery = new MiddlewareDiscovery();
	const middlewareExecutor = new MiddlewareExecutor();

	// Build middleware chain for this request
	const middlewareChain = await middlewareDiscovery.buildMiddlewareChain(url);

	// Create middleware context
	const context: MiddlewareContext = {
		request: req,
		url,
		params: {},
		query: Object.fromEntries(url.searchParams),
		state: new Map(),
		locals: {},
	};

	// Execute middleware chain
	const middlewareResult = await middlewareExecutor.execute(middlewareChain, context);

	// If middleware returned a response, use it
	if (middlewareResult) {
		return middlewareResult;
	}

	// Continue with existing route matching, passing context
	if (url.pathname.startsWith('/api/')) {
		return handleApiRequest(req, apiRoutes, context);
	}

	return handlePageRequest(req, context);
}
```

### API Route Integration

The API handling function is updated to accept and use middleware context:

```typescript
// Before: Basic API handling
export async function handleApiRequest(request: Request, routes: ApiRoute[]): Promise<Response> {
	const url = new URL(request.url);
	const method = request.method;

	// Find matching route
	const route = findMatchingRoute(url.pathname, method, routes);
	if (!route) {
		return new Response('Not Found', { status: 404 });
	}

	// Execute route handler
	return await route.handler(request);
}

// After: With middleware context support
export async function handleApiRequest(
	request: Request,
	routes: ApiRoute[],
	middlewareContext?: MiddlewareContext
): Promise<Response> {
	const url = new URL(request.url);
	const method = request.method;

	// Use middleware context if provided, otherwise create basic context
	const context = middlewareContext || {
		request,
		url,
		params: {},
		query: Object.fromEntries(url.searchParams),
		state: new Map(),
		locals: {},
	};

	// Find matching route
	const route = findMatchingRoute(url.pathname, method, routes);
	if (!route) {
		return new Response('Not Found', { status: 404 });
	}

	// Extract route parameters and add to context
	context.params = extractRouteParams(url.pathname, route.pattern);

	// Execute route handler with context
	return await route.handler(request, context);
}
```

### Page Route Integration

Page routes can access middleware context through the request handler:

```typescript
// Before: Basic page handling
async function handlePageRequest(request: Request): Promise<Response> {
	const url = new URL(request.url);

	// Find page component
	const pageComponent = await findPageComponent(url.pathname);
	if (!pageComponent) {
		return new Response('Not Found', { status: 404 });
	}

	// Render page
	return await renderPage(pageComponent, request);
}

// After: With middleware context support
async function handlePageRequest(request: Request, middlewareContext?: MiddlewareContext): Promise<Response> {
	const url = new URL(request.url);

	// Use middleware context if provided
	const context = middlewareContext || createDefaultContext(request);

	// Find page component
	const pageComponent = await findPageComponent(url.pathname);
	if (!pageComponent) {
		return new Response('Not Found', { status: 404 });
	}

	// Render page with context
	return await renderPage(pageComponent, request, context);
}
```

## Route Handler Updates

### API Route Handlers

API route handlers can be updated to accept middleware context:

```typescript
// Before: Basic API route handler
export async function getUserHandler(request: Request): Promise<Response> {
	const url = new URL(request.url);
	const userId = extractUserIdFromPath(url.pathname);

	// Manual authentication check
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) {
		return new Response('Unauthorized', { status: 401 });
	}

	const user = await getUser(userId);
	return Response.json(user);
}

// After: Using middleware context
export async function getUserHandler(request: Request, context: MiddlewareContext): Promise<Response> {
	// User ID from route parameters (extracted by middleware)
	const userId = context.params.id;

	// Authentication handled by middleware
	const currentUser = context.locals.user;
	if (!currentUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	// Authorization check
	if (currentUser.id !== userId && currentUser.role !== 'admin') {
		return new Response('Forbidden', { status: 403 });
	}

	const user = await getUser(userId);
	return Response.json(user);
}
```

### Page Component Props

Page components can receive middleware context through props:

```typescript
// Before: Basic page component
interface PageProps {
	request: Request;
}

export default function AdminDashboard({ request }: PageProps) {
	// Manual authentication check needed
	const [user, setUser] = useState(null);

	useEffect(() => {
		// Check authentication on client side
		checkAuth().then(setUser);
	}, []);

	if (!user) {
		return <div>Loading...</div>;
	}

	return <div>Welcome, {user.name}!</div>;
}

// After: Using middleware context
interface PageProps {
	request: Request;
	context: MiddlewareContext;
}

export default function AdminDashboard({ request, context }: PageProps) {
	// User already authenticated by middleware
	const user = context.locals.user;
	const isAdmin = context.locals.isAdmin;

	return (
		<div>
			<h1>Admin Dashboard</h1>
			<p>Welcome, {user.name}!</p>
			{isAdmin && <AdminPanel />}
		</div>
	);
}
```

## Migration Guide

### Step 1: Update Route Handlers

Update your existing route handlers to accept middleware context:

```typescript
// API routes
export async function myApiHandler(
	request: Request,
	context?: MiddlewareContext // Make optional for backward compatibility
): Promise<Response> {
	// Use context if available, fallback to manual extraction
	const userId = context?.params.id || extractFromUrl(request.url);
	const user = context?.locals.user || (await authenticateRequest(request));

	// Your existing logic here
}

// Page components
interface MyPageProps {
	request: Request;
	context?: MiddlewareContext; // Make optional for backward compatibility
}

export default function MyPage({ request, context }: MyPageProps) {
	// Use context if available, fallback to existing logic
	const user = context?.locals.user || useAuthHook();

	// Your existing JSX here
}
```

### Step 2: Create Middleware Files

Create middleware files to replace manual authentication/authorization:

```typescript
// src/_middleware.ts - Global middleware
export default async function globalMiddleware(
	context: MiddlewareContext,
	next: () => Promise<MiddlewareResponse>
): Promise<MiddlewareResponse> {
	// Add request ID for tracing
	context.locals.requestId = generateRequestId();

	// Add CORS headers
	context.locals.corsHeaders = {
		'Access-Control-Allow-Origin': '*',
		// ... other CORS headers
	};

	return await next();
}

// src/pages/admin/_middleware.ts - Admin authentication
export default async function adminMiddleware(
	context: MiddlewareContext,
	next: () => Promise<MiddlewareResponse>
): Promise<MiddlewareResponse> {
	// Check authentication
	const user = await authenticateRequest(context.request);
	if (!user || user.role !== 'admin') {
		return {
			response: new Response('Access Denied', { status: 403 }),
			continue: false,
		};
	}

	context.locals.user = user;
	context.locals.isAdmin = true;

	return await next();
}
```

### Step 3: Remove Manual Checks

Remove manual authentication/authorization checks from route handlers:

```typescript
// Before: Manual checks in every handler
export async function adminApiHandler(request: Request): Promise<Response> {
	// Remove these manual checks
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) {
		return new Response('Unauthorized', { status: 401 });
	}

	const user = await validateToken(authHeader);
	if (!user || user.role !== 'admin') {
		return new Response('Forbidden', { status: 403 });
	}

	// Your business logic here
}

// After: Clean handler using middleware context
export async function adminApiHandler(request: Request, context: MiddlewareContext): Promise<Response> {
	// User already validated by middleware
	const user = context.locals.user;

	// Your business logic here
}
```

### Step 4: Update Tests

Update your tests to work with the middleware system:

```typescript
// Before: Testing route handlers directly
test('admin API requires authentication', async () => {
	const request = new Request('https://example.com/api/admin/users');
	const response = await adminApiHandler(request);
	expect(response.status).toBe(401);
});

// After: Testing with middleware context
test('admin API works with authenticated user', async () => {
	const request = new Request('https://example.com/api/admin/users');
	const context: MiddlewareContext = {
		request,
		url: new URL(request.url),
		params: {},
		query: {},
		state: new Map(),
		locals: {
			user: { id: '1', role: 'admin' },
			isAdmin: true,
		},
	};

	const response = await adminApiHandler(request, context);
	expect(response.status).toBe(200);
});
```

## Backward Compatibility

The middleware system maintains backward compatibility by:

1. **Making context optional** in route handler signatures
2. **Providing fallback behavior** when context is not available
3. **Preserving existing route matching** logic
4. **Supporting gradual migration** of route handlers

### Compatibility Layer

You can create a compatibility layer for gradual migration:

```typescript
// utils/middleware-compat.ts
export function withMiddlewareCompat<T extends any[]>(
	handler: (request: Request, context: MiddlewareContext, ...args: T) => Promise<Response>
) {
	return async (request: Request, contextOrArg?: MiddlewareContext | T[0], ...args: T): Promise<Response> => {
		// Check if second argument is middleware context
		if (contextOrArg && typeof contextOrArg === 'object' && 'request' in contextOrArg) {
			// New signature with middleware context
			return handler(request, contextOrArg as MiddlewareContext, ...args);
		} else {
			// Old signature, create minimal context
			const context: MiddlewareContext = {
				request,
				url: new URL(request.url),
				params: {},
				query: Object.fromEntries(new URL(request.url).searchParams),
				state: new Map(),
				locals: {},
			};

			// Adjust arguments for old signature
			const adjustedArgs = contextOrArg ? [contextOrArg, ...args] : args;
			return handler(request, context, ...(adjustedArgs as T));
		}
	};
}

// Usage
export const myApiHandler = withMiddlewareCompat(
	async (request: Request, context: MiddlewareContext): Promise<Response> => {
		// Handler implementation using context
	}
);
```

## Performance Considerations

### Middleware Chain Caching

The middleware system caches middleware chains for better performance:

```typescript
class MiddlewareDiscovery {
	private chainCache = new Map<string, MiddlewareHandler[]>();

	async buildMiddlewareChain(url: URL): Promise<MiddlewareHandler[]> {
		const cacheKey = url.pathname;

		if (this.chainCache.has(cacheKey)) {
			return this.chainCache.get(cacheKey)!;
		}

		const chain = await this.buildChainForPath(url.pathname);
		this.chainCache.set(cacheKey, chain);

		return chain;
	}
}
```

### Hot Reloading

In development mode, middleware files are watched for changes:

```typescript
// Development mode file watching
if (Deno.env.get('NODE_ENV') === 'development') {
	const watcher = Deno.watchFs('./src');

	for await (const event of watcher) {
		if (event.kind === 'modify' && event.paths.some(path => path.includes('_middleware'))) {
			// Clear middleware cache
			middlewareDiscovery.clearCache();
			console.log('Middleware cache cleared due to file changes');
		}
	}
}
```

## Troubleshooting

### Common Issues

1. **Middleware not executing**: Check file naming (`_middleware.ts`) and location
2. **Context not available**: Ensure route handlers accept context parameter
3. **Infinite loops**: Avoid calling `next()` multiple times in the same middleware
4. **Memory leaks**: Clear middleware cache in long-running processes

### Debugging

Enable debug logging to trace middleware execution:

```typescript
// Enable debug mode
Deno.env.set('MIDDLEWARE_DEBUG', 'true');

// In middleware
if (Deno.env.get('MIDDLEWARE_DEBUG')) {
	console.log(`[DEBUG] Executing middleware: ${middlewareName}`);
	console.log(`[DEBUG] Context:`, context);
}
```
