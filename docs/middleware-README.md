# Fresh-Style Middleware System

A hierarchical middleware system for web applications that follows the Fresh framework pattern, allowing you to define middleware at different levels of your application structure.

## Quick Start

### 1. Create Global Middleware

Create `src/_middleware.ts` for middleware that runs on all requests:

```typescript
import type { MiddlewareContext, MiddlewareResponse } from './schemas/middleware.ts';

export default async function globalMiddleware(
	context: MiddlewareContext,
	next: () => Promise<MiddlewareResponse>
): Promise<MiddlewareResponse> {
	// Add CORS headers
	context.locals.corsHeaders = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
	};

	console.log(`${context.request.method} ${context.url.pathname}`);

	const result = await next();

	// Add headers to response
	if (result.response) {
		const headers = new Headers(result.response.headers);
		Object.entries(context.locals.corsHeaders).forEach(([key, value]) => {
			headers.set(key, value as string);
		});

		return {
			response: new Response(result.response.body, {
				status: result.response.status,
				headers,
			}),
			continue: false,
		};
	}

	return result;
}
```

### 2. Create Scoped Middleware

Create `src/pages/_middleware.ts` for page-specific middleware:

```typescript
export default async function pagesMiddleware(
	context: MiddlewareContext,
	next: () => Promise<MiddlewareResponse>
): Promise<MiddlewareResponse> {
	// Check for user session
	const sessionId = context.request.headers
		.get('Cookie')
		?.split(';')
		.find(c => c.trim().startsWith('sessionId='))
		?.split('=')[1];

	if (sessionId) {
		const user = await validateSession(sessionId);
		if (user) {
			context.locals.user = user;
			context.locals.isLoggedIn = true;
		}
	}

	return await next();
}
```

### 3. Create Protected Route Middleware

Create `src/pages/admin/_middleware.ts` for admin-only pages:

```typescript
export default async function adminMiddleware(
	context: MiddlewareContext,
	next: () => Promise<MiddlewareResponse>
): Promise<MiddlewareResponse> {
	if (!context.locals.isLoggedIn) {
		return {
			response: new Response('Please log in', {
				status: 401,
				headers: { Location: '/login' },
			}),
			continue: false,
		};
	}

	const user = context.locals.user as any;
	if (user.role !== 'admin') {
		return {
			response: new Response('Access denied', { status: 403 }),
			continue: false,
		};
	}

	return await next();
}
```

## Directory Structure

```
src/
├── _middleware.ts              # Global middleware (all requests)
├── pages/
│   ├── _middleware.ts          # All page routes
│   ├── admin/
│   │   ├── _middleware.ts      # Admin pages only
│   │   └── dashboard.tsx
│   └── index.tsx
└── api/
    ├── _middleware.ts          # All API routes
    ├── auth/
    │   ├── _middleware.ts      # Auth API routes
    │   └── login.ts
    └── users.ts
```

## Execution Order

Middleware executes in hierarchical order based on the request path:

### For `/admin/dashboard`:

1. `src/_middleware.ts` (Global)
2. `src/pages/_middleware.ts` (All pages)
3. `src/pages/admin/_middleware.ts` (Admin pages)
4. Route handler

### For `/api/auth/login`:

1. `src/_middleware.ts` (Global)
2. `src/api/_middleware.ts` (All APIs)
3. `src/api/auth/_middleware.ts` (Auth APIs)
4. Route handler

## Common Use Cases

### Authentication Middleware

```typescript
// src/pages/protected/_middleware.ts
export default async function authMiddleware(
	context: MiddlewareContext,
	next: () => Promise<MiddlewareResponse>
): Promise<MiddlewareResponse> {
	const token = context.request.headers.get('Authorization')?.replace('Bearer ', '');

	if (!token) {
		return {
			response: new Response('Authentication required', { status: 401 }),
			continue: false,
		};
	}

	try {
		const user = await validateJWT(token);
		context.locals.user = user;
		return await next();
	} catch (error) {
		return {
			response: new Response('Invalid token', { status: 401 }),
			continue: false,
		};
	}
}
```

### Rate Limiting Middleware

```typescript
// src/api/_middleware.ts
const rateLimitStore = new Map();

export default async function rateLimitMiddleware(
	context: MiddlewareContext,
	next: () => Promise<MiddlewareResponse>
): Promise<MiddlewareResponse> {
	const clientIP = context.request.headers.get('X-Forwarded-For') || 'unknown';
	const now = Date.now();
	const windowMs = 60 * 1000; // 1 minute
	const maxRequests = 100;

	const clientData = rateLimitStore.get(clientIP) || { count: 0, resetTime: now + windowMs };

	if (now > clientData.resetTime) {
		clientData.count = 1;
		clientData.resetTime = now + windowMs;
	} else {
		clientData.count++;
	}

	rateLimitStore.set(clientIP, clientData);

	if (clientData.count > maxRequests) {
		return {
			response: new Response('Rate limit exceeded', {
				status: 429,
				headers: {
					'Retry-After': Math.ceil((clientData.resetTime - now) / 1000).toString(),
				},
			}),
			continue: false,
		};
	}

	return await next();
}
```

### Request Validation Middleware

```typescript
// src/api/users/_middleware.ts
export default async function validateUserRequest(
	context: MiddlewareContext,
	next: () => Promise<MiddlewareResponse>
): Promise<MiddlewareResponse> {
	if (['POST', 'PUT'].includes(context.request.method)) {
		const contentType = context.request.headers.get('Content-Type');

		if (!contentType?.includes('application/json')) {
			return {
				response: new Response('Content-Type must be application/json', {
					status: 400,
				}),
				continue: false,
			};
		}

		try {
			const body = await context.request.json();

			// Validate required fields
			if (context.request.method === 'POST' && (!body.email || !body.name)) {
				return {
					response: new Response('Missing required fields: email, name', {
						status: 400,
					}),
					continue: false,
				};
			}

			// Store validated body in context
			context.locals.validatedBody = body;
		} catch (error) {
			return {
				response: new Response('Invalid JSON', { status: 400 }),
				continue: false,
			};
		}
	}

	return await next();
}
```

## Error Handling

### Global Error Handler

```typescript
// src/_middleware.ts
export default async function globalErrorHandler(
	context: MiddlewareContext,
	next: () => Promise<MiddlewareResponse>
): Promise<MiddlewareResponse> {
	try {
		return await next();
	} catch (error) {
		console.error('Middleware error:', error);

		const isApiRoute = context.url.pathname.startsWith('/api');
		const isDevelopment = Deno.env.get('NODE_ENV') !== 'production';

		if (isApiRoute) {
			return {
				response: new Response(
					JSON.stringify({
						error: 'Internal Server Error',
						message: isDevelopment ? error.message : 'Something went wrong',
					}),
					{
						status: 500,
						headers: { 'Content-Type': 'application/json' },
					}
				),
				continue: false,
			};
		} else {
			return {
				response: new Response(
					`<h1>500 - Internal Server Error</h1>
           <p>${isDevelopment ? error.message : 'Something went wrong'}</p>`,
					{
						status: 500,
						headers: { 'Content-Type': 'text/html' },
					}
				),
				continue: false,
			};
		}
	}
}
```

### Custom Error Types

```typescript
// utils/errors.ts
export class ValidationError extends Error {
	constructor(message: string, public field?: string) {
		super(message);
		this.name = 'ValidationError';
	}
}

export class AuthenticationError extends Error {
	constructor(message: string = 'Authentication required') {
		super(message);
		this.name = 'AuthenticationError';
	}
}

// In middleware
if (!isValid) {
	throw new ValidationError('Invalid email format', 'email');
}
```

## Context Usage

### Sharing Data Between Middleware

```typescript
// Early middleware
context.locals.requestId = generateId();
context.locals.startTime = Date.now();
context.state.set('user', userObject);

// Later middleware
const requestId = context.locals.requestId;
const user = context.state.get('user');
```

### Accessing in Route Handlers

```typescript
// API route handler
export async function getUserHandler(request: Request, context: MiddlewareContext): Promise<Response> {
	const user = context.locals.user;
	const userId = context.params.id;

	return Response.json({ user, userId });
}

// Page component
interface PageProps {
	request: Request;
	context: MiddlewareContext;
}

export default function UserProfile({ context }: PageProps) {
	const user = context.locals.user;
	return <div>Welcome, {user.name}!</div>;
}
```

## Best Practices

### 1. Keep Global Middleware Lightweight

```typescript
// ✅ Good - lightweight global middleware
export default async function globalMiddleware(context, next) {
	context.locals.requestId = generateId();
	context.locals.startTime = Date.now();
	return await next();
}

// ❌ Bad - heavy processing in global middleware
export default async function globalMiddleware(context, next) {
	await heavyDatabaseOperation();
	await complexValidation();
	return await next();
}
```

### 2. Use Early Returns

```typescript
// ✅ Good - early return for unauthorized requests
if (!isAuthenticated) {
	return {
		response: new Response('Unauthorized', { status: 401 }),
		continue: false,
	};
}

// ❌ Bad - unnecessary processing
const result = await next();
if (!isAuthenticated) {
	return { response: new Response('Unauthorized', { status: 401 }), continue: false };
}
```

### 3. Handle Async Operations Properly

```typescript
// ✅ Good - proper async handling
export default async function middleware(context, next) {
	try {
		const user = await authenticateUser(context.request);
		context.locals.user = user;
		return await next();
	} catch (error) {
		return { response: new Response('Auth failed', { status: 401 }), continue: false };
	}
}
```

### 4. Use Specific Middleware for Specific Routes

```typescript
// ✅ Good - specific middleware in appropriate directories
// src/api/admin/_middleware.ts - only for admin API routes
// src/pages/public/_middleware.ts - only for public pages

// ❌ Bad - checking route paths in global middleware
export default async function globalMiddleware(context, next) {
	if (context.url.pathname.startsWith('/admin')) {
		// Admin-specific logic in global middleware
	}
	return await next();
}
```

## Testing

### Unit Testing Middleware

```typescript
import { assertEquals } from 'https://deno.land/std/testing/asserts.ts';
import authMiddleware from './auth-middleware.ts';

Deno.test('auth middleware allows valid token', async () => {
	const context = {
		request: new Request('https://example.com', {
			headers: { Authorization: 'Bearer valid-token' },
		}),
		url: new URL('https://example.com'),
		params: {},
		query: {},
		state: new Map(),
		locals: {},
	};

	const next = async () => ({ continue: true });
	const result = await authMiddleware(context, next);

	assertEquals(result.continue, true);
	assertEquals(context.locals.user.id, 'user-123');
});
```

### Integration Testing

```typescript
Deno.test('middleware chain executes in correct order', async () => {
	const executionOrder: string[] = [];

	const middleware1 = async (context, next) => {
		executionOrder.push('middleware1-start');
		const result = await next();
		executionOrder.push('middleware1-end');
		return result;
	};

	const middleware2 = async (context, next) => {
		executionOrder.push('middleware2-start');
		const result = await next();
		executionOrder.push('middleware2-end');
		return result;
	};

	// Test execution order
	assertEquals(executionOrder, ['middleware1-start', 'middleware2-start', 'middleware2-end', 'middleware1-end']);
});
```

## Performance Tips

1. **Cache middleware chains** in production
2. **Use early returns** to avoid unnecessary processing
3. **Keep global middleware minimal**
4. **Implement request timeouts** for long-running operations
5. **Use connection pooling** for database operations in middleware

## Troubleshooting

### Common Issues

1. **Middleware not executing**: Check file naming (`_middleware.ts`) and location
2. **Infinite loops**: Ensure you call `next()` only once per middleware
3. **Context not available**: Make sure route handlers accept context parameter
4. **Memory leaks**: Clear caches and close connections properly

### Debug Mode

Enable debug logging:

```typescript
// Set environment variable
Deno.env.set('MIDDLEWARE_DEBUG', 'true');

// In middleware
if (Deno.env.get('MIDDLEWARE_DEBUG')) {
	console.log(`[DEBUG] Executing: ${middlewareName}`);
	console.log(`[DEBUG] Context:`, context.locals);
}
```

## Migration from Manual Checks

### Before (Manual Authentication)

```typescript
export async function protectedHandler(request: Request): Promise<Response> {
	const token = request.headers.get('Authorization');
	if (!token) {
		return new Response('Unauthorized', { status: 401 });
	}

	const user = await validateToken(token);
	if (!user) {
		return new Response('Invalid token', { status: 401 });
	}

	// Business logic here
}
```

### After (Using Middleware)

```typescript
// src/pages/protected/_middleware.ts
export default async function authMiddleware(context, next) {
	const token = context.request.headers.get('Authorization');
	if (!token) {
		return { response: new Response('Unauthorized', { status: 401 }), continue: false };
	}

	const user = await validateToken(token);
	if (!user) {
		return { response: new Response('Invalid token', { status: 401 }), continue: false };
	}

	context.locals.user = user;
	return await next();
}

// Route handler (much cleaner)
export async function protectedHandler(request: Request, context: MiddlewareContext): Promise<Response> {
	const user = context.locals.user; // Already authenticated by middleware
	// Business logic here
}
```

This middleware system provides a clean, hierarchical way to handle cross-cutting concerns in your web application while maintaining excellent performance and developer experience.
