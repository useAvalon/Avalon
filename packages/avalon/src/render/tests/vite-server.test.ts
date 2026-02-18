/**
 * Tests for Vite server proxy functionality
 */

import { describe, it, expect, afterAll } from 'vitest';
import { proxyToVite } from '../vite-server.ts';
import { DEFAULT_SERVER_PORT, VITE_DEV_PORT } from '../constants.ts';

// Mock fetch for testing
const originalFetch = globalThis.fetch;

describe('proxyToVite - CORS headers', () => {
	// Mock successful response
	globalThis.fetch = async (_url: string | URL | Request, _init?: RequestInit) => {
		return new Response('mock content', {
			status: 200,
			headers: {
				'Content-Type': 'application/javascript',
			},
		});
	};

	it('should add CORS headers to response', async () => {
		const request = new Request(`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/preact.js`);
		const response = await proxyToVite(request, `http://localhost:${VITE_DEV_PORT}`);

		expect(response.headers.get('Access-Control-Allow-Origin')).toEqual('*');
		expect(response.headers.get('Access-Control-Allow-Methods')).toEqual('GET, POST, PUT, DELETE, OPTIONS');
		expect(response.headers.get('Access-Control-Allow-Headers')).toEqual('Content-Type, Authorization, X-Requested-With');
	});

	it('should set proper cache headers for .vite/deps/', async () => {
		const request = new Request(`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/solid-js_web.js`);
		const response = await proxyToVite(request, `http://localhost:${VITE_DEV_PORT}`);

		expect(response.headers.get('Cache-Control')).toEqual('public, max-age=31536000, immutable');
	});

	it('should set no-cache for @vite/ paths', async () => {
		const request = new Request(`http://localhost:${DEFAULT_SERVER_PORT}/@vite/client`);
		const response = await proxyToVite(request, `http://localhost:${VITE_DEV_PORT}`);

		expect(response.headers.get('Cache-Control')).toEqual('no-cache, no-store, must-revalidate');
	});

	it('should set no-cache for /src/ paths', async () => {
		const request = new Request(`http://localhost:${DEFAULT_SERVER_PORT}/src/islands/Counter.tsx`);
		const response = await proxyToVite(request, `http://localhost:${VITE_DEV_PORT}`);

		expect(response.headers.get('Cache-Control')).toEqual('no-cache, must-revalidate');
	});
});

describe('proxyToVite - OPTIONS request handling', () => {
	it('should handle OPTIONS preflight requests', async () => {
		const request = new Request(`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/preact.js`, {
			method: 'OPTIONS',
		});
		const response = await proxyToVite(request, `http://localhost:${VITE_DEV_PORT}`);

		expect(response.status).toEqual(200);
		expect(response.headers.get('Access-Control-Allow-Origin')).toEqual('*');
		expect(response.headers.get('Access-Control-Allow-Methods')).toEqual('GET, POST, PUT, DELETE, OPTIONS');
		expect(response.headers.get('Access-Control-Max-Age')).toEqual('86400');
	});
});

describe('proxyToVite - Error handling', () => {
	it('should return 502 on proxy error', async () => {
		// Mock fetch error
		globalThis.fetch = async (_url: string | URL | Request, _init?: RequestInit) => {
			throw new Error('Network error');
		};

		const request = new Request(`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/preact.js`);
		const response = await proxyToVite(request, `http://localhost:${VITE_DEV_PORT}`);

		expect(response.status).toEqual(502);
		const text = await response.text();
		expect(text).toEqual('Vite proxy failed');
	});
});

// Restore original fetch
afterAll(() => {
	globalThis.fetch = originalFetch;
});
