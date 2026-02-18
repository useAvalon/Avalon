/**
 * Tests for Vite route proxying functionality
 */

import { describe, it, expect } from 'vitest';
import { createViteRoutes } from '../vite-routes.ts';
import { DEFAULT_SERVER_PORT, VITE_DEV_PORT } from '../../constants.ts';

describe('createViteRoutes - Development mode', () => {
	const viteServerUrl = `http://localhost:${VITE_DEV_PORT}`;
	const routes = createViteRoutes(true, viteServerUrl);

	it('should create routes in development mode', () => {
		expect(Array.isArray(routes)).toEqual(true);
		expect(routes.length > 0).toEqual(true);
	});

	it('should include .vite/deps/* route pattern', () => {
		const viteDepRoute = routes.find(route =>
			route.pattern.pathname === '/.vite/deps/*'
		);
		expect(viteDepRoute !== undefined).toEqual(true);
		expect(typeof viteDepRoute?.handler).toEqual('function');
	});

	it('should include all required Vite route patterns', () => {
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
			expect(route !== undefined).toEqual(true);
		});
	});
});

describe('createViteRoutes - Production mode', () => {
	it('should return empty array in production mode', () => {
		const routes = createViteRoutes(false, '');
		expect(routes.length).toEqual(0);
	});

	it('should return empty array when viteServerUrl is empty', () => {
		const routes = createViteRoutes(true, '');
		expect(routes.length).toEqual(0);
	});
});

describe('Vite route patterns - URL matching', () => {
	const viteServerUrl = `http://localhost:${VITE_DEV_PORT}`;
	const routes = createViteRoutes(true, viteServerUrl);

	it('should match .vite/deps/ URLs', () => {
		const viteDepRoute = routes.find(route =>
			route.pattern.pathname === '/.vite/deps/*'
		);

		if (!viteDepRoute) {
			throw new Error('.vite/deps/* route not found');
		}

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
			expect(match).toEqual(true);
		});
	});

	it('should not match non-vite URLs', () => {
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
			expect(match).toEqual(false);
		});
	});
});
