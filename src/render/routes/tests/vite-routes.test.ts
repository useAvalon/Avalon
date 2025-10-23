/**
 * Tests for Vite route proxying functionality
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { createViteRoutes } from '../vite-routes.ts';
import { DEFAULT_SERVER_PORT, VITE_DEV_PORT } from '../../constants.ts';

Deno.test('createViteRoutes - Development mode', async t => {
	const viteServerUrl = `http://localhost:${VITE_DEV_PORT}`;
	const routes = createViteRoutes(true, viteServerUrl);

	await t.step('should create routes in development mode', () => {
		assertEquals(Array.isArray(routes), true);
		assertEquals(routes.length > 0, true);
	});

	await t.step('should include .vite/deps/* route pattern', () => {
		const viteDepRoute = routes.find(route => 
			route.pattern.pathname === '/.vite/deps/*'
		);
		assertEquals(viteDepRoute !== undefined, true, 'Missing .vite/deps/* route pattern');
		assertEquals(typeof viteDepRoute?.handler, 'function');
	});

	await t.step('should include all required Vite route patterns', () => {
		const expectedPatterns = [
			'/.vite/deps/*',
			'/@vite/*',
			'/@fs/*',
			'/@id/*',
			'/node_modules/*',
			'/@solid-refresh',
			'/islands/*',
			'/src/*'
		];

		expectedPatterns.forEach(pattern => {
			const route = routes.find(r => r.pattern.pathname === pattern);
			assertEquals(route !== undefined, true, `Missing route pattern: ${pattern}`);
		});
	});
});

Deno.test('createViteRoutes - Production mode', async t => {
	await t.step('should return empty array in production mode', () => {
		const routes = createViteRoutes(false, '');
		assertEquals(routes.length, 0);
	});

	await t.step('should return empty array when viteServerUrl is empty', () => {
		const routes = createViteRoutes(true, '');
		assertEquals(routes.length, 0);
	});
});

Deno.test('Vite route patterns - URL matching', async t => {
	const viteServerUrl = `http://localhost:${VITE_DEV_PORT}`;
	const routes = createViteRoutes(true, viteServerUrl);

	await t.step('should match .vite/deps/ URLs', () => {
		const viteDepRoute = routes.find(route => 
			route.pattern.pathname === '/.vite/deps/*'
		);
		
		if (!viteDepRoute) {
			throw new Error('.vite/deps/* route not found');
		}

		// Test various dependency URLs
		const testUrls = [
			`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/preact.js`,
			`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/solid-js_web.js`,
			`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/vue.js`,
			`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/svelte.js`,
			`http://localhost:${DEFAULT_SERVER_PORT}/.vite/deps/chunk-ABC123.js`
		];

		testUrls.forEach(url => {
			const urlPattern = viteDepRoute.pattern;
			const match = urlPattern.test(url);
			assertEquals(match, true, `URL should match pattern: ${url}`);
		});
	});

	await t.step('should not match non-vite URLs', () => {
		const viteDepRoute = routes.find(route => 
			route.pattern.pathname === '/.vite/deps/*'
		);
		
		if (!viteDepRoute) {
			throw new Error('.vite/deps/* route not found');
		}

		const nonMatchingUrls = [
			`http://localhost:${DEFAULT_SERVER_PORT}/api/users`,
			`http://localhost:${DEFAULT_SERVER_PORT}/static/style.css`,
			`http://localhost:${DEFAULT_SERVER_PORT}/favicon.ico`,
			`http://localhost:${DEFAULT_SERVER_PORT}/vite/deps/preact.js`, // Missing leading dot
		];

		nonMatchingUrls.forEach(url => {
			const urlPattern = viteDepRoute.pattern;
			const match = urlPattern.test(url);
			assertEquals(match, false, `URL should not match pattern: ${url}`);
		});
	});
});