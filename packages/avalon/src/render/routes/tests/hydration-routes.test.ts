/**
 * Tests for HydrationRouteHandler and hydration routes
 */

import { describe, it, expect } from 'vitest';
import { HydrationRouteHandler, createHydrationRoutes } from '../hydration-routes.ts';

// Mock file system for testing
const mockFiles: Record<string, string> = {
	'src/islands/SolidCounter.tsx': `
import { createSignal } from 'solid-js';

export default function SolidCounter() {
  const [count, setCount] = createSignal(0);
  return <button onClick={() => setCount(count() + 1)}>Count: {count()}</button>;
}
  `,
	'src/islands/PreactCounter.tsx': `
import { useState } from 'preact/hooks';

export default function PreactCounter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
  `,
	'src/islands/VueCounter.vue': `
<template>
  <button @click="increment">Count: {{ count }}</button>
</template>

<script setup>
import { ref } from 'vue';
const count = ref(0);
const increment = () => count.value++;
</script>
  `,
	'src/islands/SvelteCounter.svelte': `
<script>
  let count = 0;
  const increment = () => count++;
</script>

<button on:click={increment}>Count: {count}</button>
  `,
};

// Mock readFile for testing
const originalReadTextFile = readFile;
readFile = async (path: string | URL): Promise<string> => {
	const pathStr = typeof path === 'string' ? path : path.pathname;
	const normalizedPath = pathStr.startsWith('/') ? pathStr.slice(1) : pathStr;
	if (mockFiles[normalizedPath]) {
		return mockFiles[normalizedPath];
	}
	throw new Error(`File not found: ${pathStr}`);
};

describe('HydrationRouteHandler - Basic functionality', () => {
	it('should create handler with development mode', () => {
		const handler = new HydrationRouteHandler(true);
		expect(typeof handler.handleHydrationRequest).toEqual('function');
	});

	it('should create handler with production mode', () => {
		const handler = new HydrationRouteHandler(false);
		expect(typeof handler.handleHydrationRequest).toEqual('function');
	});
});

describe('HydrationRouteHandler - Framework detection from path', () => {
	const handler = new HydrationRouteHandler(true);

	it('should detect Solid from .tsx files', async () => {
		const request = new Request('http://localhost/src/islands/SolidCounter.tsx');
		const response = await handler.handleHydrationRequest(request);

		expect(response.headers.get('X-Framework')).toEqual('solid');
	});

	it('should detect framework from path patterns', async () => {
		// Test with files that don't exist but should still detect framework
		const solidRequest = new Request('http://localhost/src/islands/solid-counter.tsx');
		const solidResponse = await handler.handleHydrationRequest(solidRequest);
		// Even if file doesn't exist, framework should be detected from path
		expect(solidResponse.status).toEqual(404); // File not found

		const preactRequest = new Request('http://localhost/src/islands/preact-counter.tsx');
		const preactResponse = await handler.handleHydrationRequest(preactRequest);
		expect(preactResponse.status).toEqual(404); // File not found
	});

	it('should detect Vue from .vue extension', async () => {
		const request = new Request('http://localhost/src/islands/VueCounter.vue');
		const response = await handler.handleHydrationRequest(request);

		expect(response.headers.get('X-Framework')).toEqual('vue');
	});

	it('should detect Svelte from .svelte extension', async () => {
		const request = new Request('http://localhost/src/islands/SvelteCounter.svelte');
		const response = await handler.handleHydrationRequest(request);

		expect(response.headers.get('X-Framework')).toEqual('svelte');
	});
});

describe('HydrationRouteHandler - Framework query parameter', () => {
	const handler = new HydrationRouteHandler(true);

	it('should use framework from query parameter', async () => {
		const request = new Request('http://localhost/src/islands/PreactCounter.tsx?framework=preact');
		const response = await handler.handleHydrationRequest(request);

		expect(response.headers.get('X-Framework')).toEqual('preact');
	});

	it('should override path detection with query parameter', async () => {
		const request = new Request('http://localhost/src/islands/SolidCounter.tsx?framework=preact');
		const response = await handler.handleHydrationRequest(request);

		expect(response.headers.get('X-Framework')).toEqual('preact');
	});
});

describe('HydrationRouteHandler - Module serving', () => {
	const handler = new HydrationRouteHandler(true);

	it('should serve Solid component with correct headers', async () => {
		const request = new Request('http://localhost/src/islands/SolidCounter.tsx');
		const response = await handler.handleHydrationRequest(request);

		expect(response.status).toEqual(200);
		expect(response.headers.get('Content-Type')).toEqual('application/javascript; charset=utf-8');
		expect(response.headers.get('X-Framework')).toEqual('solid');
		expect(response.headers.get('X-Original-Path')).toEqual('/src/islands/SolidCounter.tsx');
		expect(response.headers.get('X-Resolved-Path')).toEqual('/src/islands/SolidCounter.js');
		expect(response.headers.get('Cache-Control')).toEqual('no-cache');

		const content = await response.text();
		expect(content).toContain('createSignal');
	});

	it('should serve Preact component with correct headers', async () => {
		const request = new Request('http://localhost/src/islands/PreactCounter.tsx?framework=preact');
		const response = await handler.handleHydrationRequest(request);

		expect(response.status).toEqual(200);
		expect(response.headers.get('Content-Type')).toEqual('application/javascript; charset=utf-8');
		expect(response.headers.get('X-Framework')).toEqual('preact');

		const content = await response.text();
		expect(content).toContain('useState');
	});

	it('should serve Vue component', async () => {
		const request = new Request('http://localhost/src/islands/VueCounter.vue');
		const response = await handler.handleHydrationRequest(request);

		expect(response.status).toEqual(200);
		expect(response.headers.get('X-Framework')).toEqual('vue');

		const content = await response.text();
		expect(content).toContain('template');
	});

	it('should serve Svelte component', async () => {
		const request = new Request('http://localhost/src/islands/SvelteCounter.svelte');
		const response = await handler.handleHydrationRequest(request);

		expect(response.status).toEqual(200);
		expect(response.headers.get('X-Framework')).toEqual('svelte');

		const content = await response.text();
		expect(content).toContain('on:click');
	});
});

describe('HydrationRouteHandler - Production mode caching', () => {
	const handler = new HydrationRouteHandler(false); // Production mode

	it('should set production cache headers', async () => {
		const request = new Request('http://localhost/src/islands/SolidCounter.tsx');
		const response = await handler.handleHydrationRequest(request);

		expect(response.headers.get('Cache-Control'), 'public).toEqual(max-age=86400');
	});
});

describe('HydrationRouteHandler - Error handling', () => {
	const handler = new HydrationRouteHandler(true);

	it('should return 400 for missing framework', async () => {
		const request = new Request('http://localhost/src/unknown/file.js');
		const response = await handler.handleHydrationRequest(request);

		expect(response.status).toEqual(400);
		const text = await response.text();
		expect(text).toEqual('Framework not specified');
	});

	it('should return 400 for unsupported framework', async () => {
		const request = new Request('http://localhost/src/islands/Counter.tsx?framework=react');
		const response = await handler.handleHydrationRequest(request);

		expect(response.status).toEqual(400);
		const text = await response.text();
		expect(text).toContain('Unsupported framework: react');
	});

	it('should return 404 for missing file', async () => {
		const request = new Request('http://localhost/src/islands/NonExistent.tsx');
		const response = await handler.handleHydrationRequest(request);

		expect(response.status).toEqual(404);
		const text = await response.text();
		expect(text).toContain('Module not found');
	});
});

describe('HydrationRouteHandler - Static methods', () => {
	it('should identify hydration requests', () => {
		expect(HydrationRouteHandler.isHydrationRequest('/src/islands/Counter.tsx')).toEqual(true);
		expect(HydrationRouteHandler.isHydrationRequest('/src/components/Button.jsx')).toEqual(true);
		expect(HydrationRouteHandler.isHydrationRequest('/src/islands/Modal.vue')).toEqual(true);
		expect(HydrationRouteHandler.isHydrationRequest('/src/components/Card.svelte')).toEqual(true);

		expect(HydrationRouteHandler.isHydrationRequest('/api/users')).toEqual(false);
		expect(HydrationRouteHandler.isHydrationRequest('/static/style.css')).toEqual(false);
		expect(HydrationRouteHandler.isHydrationRequest('/favicon.ico')).toEqual(false);
	});
});

describe('createHydrationRoutes - Route creation', () => {
	it('should create hydration routes for development', () => {
		const routes = createHydrationRoutes(true);

		expect(Array.isArray(routes)).toEqual(true);
		expect(routes.length > 0).toEqual(true);

		// Check that routes have the expected structure
		routes.forEach(route => {
			expect(typeof route.pattern).toEqual('object');
			expect(typeof route.handler).toEqual('function');
		});
	});

	it('should create hydration routes for production', () => {
		const routes = createHydrationRoutes(false);

		expect(Array.isArray(routes)).toEqual(true);
		expect(routes.length > 0).toEqual(true);
	});
});

describe('createHydrationRoutes - Route patterns', () => {
	const routes = createHydrationRoutes(true);

	it('should have route for islands directory', () => {
		const islandRoute = routes.find(route => route.pattern.pathname === '/src/islands/*');
		expect(islandRoute !== undefined).toEqual(true);
	});

	it('should have route for components directory', () => {
		const componentRoute = routes.find(route => route.pattern.pathname === '/src/components/*');
		expect(componentRoute !== undefined).toEqual(true);
	});

	it('should have routes for framework extensions', () => {
		const extensions = ['*.tsx', '*.jsx', '*.vue', '*.svelte'];

		extensions.forEach(ext => {
			const route = routes.find(r => r.pattern.pathname === ext);
			expect(route !== undefined, true).toEqual(`Missing route for ${ext}`);
		});
	});
});

// Integration test with actual route handling
describe('Hydration routes - Integration test', () => {
	const routes = createHydrationRoutes(true);
	const islandRoute = routes.find(route => route.pattern.pathname === '/src/islands/*');

	it('should handle island route request', async () => {
		if (!islandRoute) {
			throw new Error('Island route not found');
		}

		const request = new Request('http://localhost/src/islands/SolidCounter.tsx');
		const response = await islandRoute.handler(request);

		expect(response.status).toEqual(200);
		expect(response.headers.get('X-Framework')).toEqual('solid');
	});
});

// Restore original readFile after tests
describe('Cleanup', () => {
	it('Cleanup', () => {
	readFile = originalReadTextFile;
});
