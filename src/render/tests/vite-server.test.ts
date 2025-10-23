/**
 * Tests for Vite server proxy functionality
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { proxyToVite } from '../vite-server.ts';
import { DEFAULT_SERVER_PORT, VITE_DEV_PORT } from '../constants.ts';

// Mock fetch for testing
const originalFetch = globalThis.fetch;

Deno.test('proxyToVite - CORS headers', async t => {
	// Mock successful response
	globalThis.fetch = async (_url: string | URL | Request, _init?: RequestInit) => {
		return new Response('mock content', {
			status: 200,
			headers: {
				'Content-Type': 'application/javascript',
			},
		});
	};

	await t.step('should add CORS headers to response', async () => {
		const request = new Request(`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/preact.js`);
		const response = await proxyToVite(request, `http://localhost:${VITE_DEV_PORT}`);

		assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
		assertEquals(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, PUT, DELETE, OPTIONS');
		assertEquals(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type, Authorization, X-Requested-With');
	});

	await t.step('should set proper cache headers for .vite/deps/', async () => {
		const request = new Request(`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/solid-js_web.js`);
		const response = await proxyToVite(request, `http://localhost:${VITE_DEV_PORT}`);

		assertEquals(response.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
	});

	await t.step('should set no-cache for @vite/ paths', async () => {
		const request = new Request(`http://localhost:${DEFAULT_SERVER_PORT}/@vite/client`);
		const response = await proxyToVite(request, `http://localhost:${VITE_DEV_PORT}`);

		assertEquals(response.headers.get('Cache-Control'), 'no-cache, no-store, must-revalidate');
	});

	await t.step('should set no-cache for /src/ paths', async () => {
		const request = new Request(`http://localhost:${DEFAULT_SERVER_PORT}/src/islands/Counter.tsx`);
		const response = await proxyToVite(request, `http://localhost:${VITE_DEV_PORT}`);

		assertEquals(response.headers.get('Cache-Control'), 'no-cache, must-revalidate');
	});
});

Deno.test('proxyToVite - OPTIONS request handling', async t => {
	await t.step('should handle OPTIONS preflight requests', async () => {
		const request = new Request(`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/preact.js`, {
			method: 'OPTIONS',
		});
		const response = await proxyToVite(request, `http://localhost:${VITE_DEV_PORT}`);

		assertEquals(response.status, 200);
		assertEquals(response.headers.get('Access-Control-Allow-Origin'), '*');
		assertEquals(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, PUT, DELETE, OPTIONS');
		assertEquals(response.headers.get('Access-Control-Max-Age'), '86400');
	});
});

Deno.test('proxyToVite - Error handling', async t => {
	// Mock fetch error
	globalThis.fetch = async (_url: string | URL | Request, _init?: RequestInit) => {
		throw new Error('Network error');
	};

	await t.step('should return 502 on proxy error', async () => {
		const request = new Request(`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/preact.js`);
		const response = await proxyToVite(request, `http://localhost:${VITE_DEV_PORT}`);

		assertEquals(response.status, 502);
		const text = await response.text();
		assertEquals(text, 'Vite proxy failed');
	});
});

// Restore original fetch
Deno.test('Cleanup', () => {
	globalThis.fetch = originalFetch;
});