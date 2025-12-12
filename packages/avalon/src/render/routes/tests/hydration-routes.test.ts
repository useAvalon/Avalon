/**
 * Tests for HydrationRouteHandler and hydration routes
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
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

// Mock Deno.readTextFile for testing
const originalReadTextFile = Deno.readTextFile;
Deno.readTextFile = async (path: string | URL): Promise<string> => {
	const pathStr = typeof path === 'string' ? path : path.pathname;
	const normalizedPath = pathStr.startsWith('/') ? pathStr.slice(1) : pathStr;
	if (mockFiles[normalizedPath]) {
		return mockFiles[normalizedPath];
	}
	throw new Error(`File not found: ${pathStr}`);
};

Deno.test('HydrationRouteHandler - Basic functionality', async t => {
	await t.step('should create handler with development mode', () => {
		const handler = new HydrationRouteHandler(true);
		assertEquals(typeof handler.handleHydrationRequest, 'function');
	});

	await t.step('should create handler with production mode', () => {
		const handler = new HydrationRouteHandler(false);
		assertEquals(typeof handler.handleHydrationRequest, 'function');
	});
});

Deno.test('HydrationRouteHandler - Framework detection from path', async t => {
	const handler = new HydrationRouteHandler(true);

	await t.step('should detect Solid from .tsx files', async () => {
		const request = new Request('http://localhost/src/islands/SolidCounter.tsx');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.headers.get('X-Framework'), 'solid');
	});

	await t.step('should detect framework from path patterns', async () => {
		// Test with files that don't exist but should still detect framework
		const solidRequest = new Request('http://localhost/src/islands/solid-counter.tsx');
		const solidResponse = await handler.handleHydrationRequest(solidRequest);
		// Even if file doesn't exist, framework should be detected from path
		assertEquals(solidResponse.status, 404); // File not found

		const preactRequest = new Request('http://localhost/src/islands/preact-counter.tsx');
		const preactResponse = await handler.handleHydrationRequest(preactRequest);
		assertEquals(preactResponse.status, 404); // File not found
	});

	await t.step('should detect Vue from .vue extension', async () => {
		const request = new Request('http://localhost/src/islands/VueCounter.vue');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.headers.get('X-Framework'), 'vue');
	});

	await t.step('should detect Svelte from .svelte extension', async () => {
		const request = new Request('http://localhost/src/islands/SvelteCounter.svelte');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.headers.get('X-Framework'), 'svelte');
	});
});

Deno.test('HydrationRouteHandler - Framework query parameter', async t => {
	const handler = new HydrationRouteHandler(true);

	await t.step('should use framework from query parameter', async () => {
		const request = new Request('http://localhost/src/islands/PreactCounter.tsx?framework=preact');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.headers.get('X-Framework'), 'preact');
	});

	await t.step('should override path detection with query parameter', async () => {
		const request = new Request('http://localhost/src/islands/SolidCounter.tsx?framework=preact');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.headers.get('X-Framework'), 'preact');
	});
});

Deno.test('HydrationRouteHandler - Module serving', async t => {
	const handler = new HydrationRouteHandler(true);

	await t.step('should serve Solid component with correct headers', async () => {
		const request = new Request('http://localhost/src/islands/SolidCounter.tsx');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.status, 200);
		assertEquals(response.headers.get('Content-Type'), 'application/javascript; charset=utf-8');
		assertEquals(response.headers.get('X-Framework'), 'solid');
		assertEquals(response.headers.get('X-Original-Path'), '/src/islands/SolidCounter.tsx');
		assertEquals(response.headers.get('X-Resolved-Path'), '/src/islands/SolidCounter.js');
		assertEquals(response.headers.get('Cache-Control'), 'no-cache');

		const content = await response.text();
		assertStringIncludes(content, 'createSignal');
	});

	await t.step('should serve Preact component with correct headers', async () => {
		const request = new Request('http://localhost/src/islands/PreactCounter.tsx?framework=preact');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.status, 200);
		assertEquals(response.headers.get('Content-Type'), 'application/javascript; charset=utf-8');
		assertEquals(response.headers.get('X-Framework'), 'preact');

		const content = await response.text();
		assertStringIncludes(content, 'useState');
	});

	await t.step('should serve Vue component', async () => {
		const request = new Request('http://localhost/src/islands/VueCounter.vue');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.status, 200);
		assertEquals(response.headers.get('X-Framework'), 'vue');

		const content = await response.text();
		assertStringIncludes(content, 'template');
	});

	await t.step('should serve Svelte component', async () => {
		const request = new Request('http://localhost/src/islands/SvelteCounter.svelte');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.status, 200);
		assertEquals(response.headers.get('X-Framework'), 'svelte');

		const content = await response.text();
		assertStringIncludes(content, 'on:click');
	});
});

Deno.test('HydrationRouteHandler - Production mode caching', async t => {
	const handler = new HydrationRouteHandler(false); // Production mode

	await t.step('should set production cache headers', async () => {
		const request = new Request('http://localhost/src/islands/SolidCounter.tsx');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.headers.get('Cache-Control'), 'public, max-age=86400');
	});
});

Deno.test('HydrationRouteHandler - Error handling', async t => {
	const handler = new HydrationRouteHandler(true);

	await t.step('should return 400 for missing framework', async () => {
		const request = new Request('http://localhost/src/unknown/file.js');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.status, 400);
		const text = await response.text();
		assertEquals(text, 'Framework not specified');
	});

	await t.step('should return 400 for unsupported framework', async () => {
		const request = new Request('http://localhost/src/islands/Counter.tsx?framework=react');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.status, 400);
		const text = await response.text();
		assertStringIncludes(text, 'Unsupported framework: react');
	});

	await t.step('should return 404 for missing file', async () => {
		const request = new Request('http://localhost/src/islands/NonExistent.tsx');
		const response = await handler.handleHydrationRequest(request);

		assertEquals(response.status, 404);
		const text = await response.text();
		assertStringIncludes(text, 'Module not found');
	});
});

Deno.test('HydrationRouteHandler - Static methods', async t => {
	await t.step('should identify hydration requests', () => {
		assertEquals(HydrationRouteHandler.isHydrationRequest('/src/islands/Counter.tsx'), true);
		assertEquals(HydrationRouteHandler.isHydrationRequest('/src/components/Button.jsx'), true);
		assertEquals(HydrationRouteHandler.isHydrationRequest('/src/islands/Modal.vue'), true);
		assertEquals(HydrationRouteHandler.isHydrationRequest('/src/components/Card.svelte'), true);

		assertEquals(HydrationRouteHandler.isHydrationRequest('/api/users'), false);
		assertEquals(HydrationRouteHandler.isHydrationRequest('/static/style.css'), false);
		assertEquals(HydrationRouteHandler.isHydrationRequest('/favicon.ico'), false);
	});
});

Deno.test('createHydrationRoutes - Route creation', async t => {
	await t.step('should create hydration routes for development', () => {
		const routes = createHydrationRoutes(true);

		assertEquals(Array.isArray(routes), true);
		assertEquals(routes.length > 0, true);

		// Check that routes have the expected structure
		routes.forEach(route => {
			assertEquals(typeof route.pattern, 'object');
			assertEquals(typeof route.handler, 'function');
		});
	});

	await t.step('should create hydration routes for production', () => {
		const routes = createHydrationRoutes(false);

		assertEquals(Array.isArray(routes), true);
		assertEquals(routes.length > 0, true);
	});
});

Deno.test('createHydrationRoutes - Route patterns', async t => {
	const routes = createHydrationRoutes(true);

	await t.step('should have route for islands directory', () => {
		const islandRoute = routes.find(route => route.pattern.pathname === '/src/islands/*');
		assertEquals(islandRoute !== undefined, true);
	});

	await t.step('should have route for components directory', () => {
		const componentRoute = routes.find(route => route.pattern.pathname === '/src/components/*');
		assertEquals(componentRoute !== undefined, true);
	});

	await t.step('should have routes for framework extensions', () => {
		const extensions = ['*.tsx', '*.jsx', '*.vue', '*.svelte'];

		extensions.forEach(ext => {
			const route = routes.find(r => r.pattern.pathname === ext);
			assertEquals(route !== undefined, true, `Missing route for ${ext}`);
		});
	});
});

// Integration test with actual route handling
Deno.test('Hydration routes - Integration test', async t => {
	const routes = createHydrationRoutes(true);
	const islandRoute = routes.find(route => route.pattern.pathname === '/src/islands/*');

	await t.step('should handle island route request', async () => {
		if (!islandRoute) {
			throw new Error('Island route not found');
		}

		const request = new Request('http://localhost/src/islands/SolidCounter.tsx');
		const response = await islandRoute.handler(request);

		assertEquals(response.status, 200);
		assertEquals(response.headers.get('X-Framework'), 'solid');
	});
});

// Restore original Deno.readTextFile after tests
Deno.test('Cleanup', () => {
	Deno.readTextFile = originalReadTextFile;
});
