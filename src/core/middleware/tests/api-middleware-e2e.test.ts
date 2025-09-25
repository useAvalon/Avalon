/**
 * End-to-end test for API middleware integration
 * Tests the complete flow from middleware context to API handler
 */

import { assertEquals } from '@std/assert';
import { handleApiRequest } from '../../../functions/api.ts';
import { MiddlewareContextManager } from '../middleware-context.ts';
import type { ApiRoute } from '../../../schemas/api.ts';

// Create a realistic API route for testing
const testApiRoute: ApiRoute = {
	pattern: new URLPattern({ pathname: '/api/users/:id/posts' }),
	config: {
		GET: async context => {
			// Simulate an API handler that uses middleware data
			const userId = context.params.id;
			const authUser = context.locals?.authUser;
			const isAuthenticated = context.state?.get('authenticated') === true;
			const requestId = context.locals?.requestId;

			if (!isAuthenticated) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			return new Response(
				JSON.stringify({
					userId,
					authUser,
					requestId,
					posts: [
						{ id: 1, title: 'First Post', author: authUser },
						{ id: 2, title: 'Second Post', author: authUser },
					],
				}),
				{
					headers: { 'Content-Type': 'application/json' },
				}
			);
		},
		POST: async context => {
			const userId = context.params.id;
			const authUser = context.locals?.authUser;
			const isAuthenticated = context.state?.get('authenticated') === true;
			const csrfToken = context.locals?.csrfToken;

			if (!isAuthenticated) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			if (!csrfToken) {
				return new Response(JSON.stringify({ error: 'CSRF token required' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			return new Response(
				JSON.stringify({
					message: 'Post created successfully',
					userId,
					authUser,
					csrfToken,
				}),
				{
					status: 201,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		},
	},
	filePath: 'users/[id]/posts.ts',
	paramNames: ['id'],
};

Deno.test('API Middleware E2E - Complete authentication flow', async () => {
	const request = new Request('http://localhost:3000/api/users/123/posts', {
		headers: {
			Authorization: 'Bearer token123',
			'X-Request-ID': 'req-456',
		},
	});

	// Create middleware context as if it was processed by auth middleware
	const middlewareContext = MiddlewareContextManager.createContext(request);

	// Simulate middleware processing
	middlewareContext.params = { id: '123' }; // Extracted by routing middleware
	middlewareContext.state.set('authenticated', true); // Set by auth middleware
	middlewareContext.state.set('userId', '123'); // Set by auth middleware
	middlewareContext.locals.authUser = 'john_doe'; // Set by auth middleware
	middlewareContext.locals.requestId = 'req-456'; // Set by logging middleware

	const response = await handleApiRequest(request, [testApiRoute], middlewareContext);

	assertEquals(response.status, 200);

	const responseData = await response.json();
	assertEquals(responseData.userId, '123');
	assertEquals(responseData.authUser, 'john_doe');
	assertEquals(responseData.requestId, 'req-456');
	assertEquals(responseData.posts.length, 2);
	assertEquals(responseData.posts[0].author, 'john_doe');
});

Deno.test('API Middleware E2E - Unauthenticated request', async () => {
	const request = new Request('http://localhost:3000/api/users/123/posts');

	// Create middleware context without authentication
	const middlewareContext = MiddlewareContextManager.createContext(request);
	middlewareContext.params = { id: '123' };
	// No authentication state set

	const response = await handleApiRequest(request, [testApiRoute], middlewareContext);

	assertEquals(response.status, 401);

	const responseData = await response.json();
	assertEquals(responseData.error, 'Unauthorized');
});

Deno.test('API Middleware E2E - POST request with CSRF protection', async () => {
	const request = new Request('http://localhost:3000/api/users/123/posts', {
		method: 'POST',
		body: JSON.stringify({ title: 'New Post', content: 'Post content' }),
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Bearer token123',
		},
	});

	// Create middleware context with authentication and CSRF token
	const middlewareContext = MiddlewareContextManager.createContext(request);
	middlewareContext.params = { id: '123' };
	middlewareContext.state.set('authenticated', true);
	middlewareContext.locals.authUser = 'jane_doe';
	middlewareContext.locals.csrfToken = 'csrf-token-789';

	const response = await handleApiRequest(request, [testApiRoute], middlewareContext);

	assertEquals(response.status, 201);

	const responseData = await response.json();
	assertEquals(responseData.message, 'Post created successfully');
	assertEquals(responseData.userId, '123');
	assertEquals(responseData.authUser, 'jane_doe');
	assertEquals(responseData.csrfToken, 'csrf-token-789');
});

Deno.test('API Middleware E2E - POST request without CSRF token', async () => {
	const request = new Request('http://localhost:3000/api/users/123/posts', {
		method: 'POST',
		body: JSON.stringify({ title: 'New Post', content: 'Post content' }),
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Bearer token123',
		},
	});

	// Create middleware context with authentication but no CSRF token
	const middlewareContext = MiddlewareContextManager.createContext(request);
	middlewareContext.params = { id: '123' };
	middlewareContext.state.set('authenticated', true);
	middlewareContext.locals.authUser = 'jane_doe';
	// No CSRF token set

	const response = await handleApiRequest(request, [testApiRoute], middlewareContext);

	assertEquals(response.status, 403);

	const responseData = await response.json();
	assertEquals(responseData.error, 'CSRF token required');
});

Deno.test('API Middleware E2E - Backward compatibility without middleware context', async () => {
	const request = new Request('http://localhost:3000/api/users/123/posts');

	// Call without middleware context (backward compatibility)
	const response = await handleApiRequest(request, [testApiRoute]);

	assertEquals(response.status, 401); // Should be unauthorized without middleware auth

	const responseData = await response.json();
	assertEquals(responseData.error, 'Unauthorized');
});
