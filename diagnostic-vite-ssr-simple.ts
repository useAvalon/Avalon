#!/usr/bin/env -S deno run --allow-all --unstable-detect-cjs

/**
 * Simple diagnostic script to test Vite SSR module loading path resolution
 */

import { createServer, type ViteDevServer } from 'vite';

async function testViteSSRPaths() {
	console.log('🔍 Testing Vite SSR module loading path resolution...\n');

	let viteServer: ViteDevServer | null = null;

	try {
		// Create Vite server
		viteServer = await createServer({
			configFile: 'Avalon/vite.config.ts',
			server: {
				middlewareMode: false,
				port: 5175,
				strictPort: false,
			},
			root: 'Avalon',
			logLevel: 'warn',
		});

		await viteServer.listen();
		console.log('✅ Vite server started\n');

		// Test different path variations for Solid component
		const pathsToTest = [
			'/islands/SolidCounter.tsx', // Current (incorrect) path
			'/src/islands/SolidCounter.tsx', // Correct path
			'src/islands/SolidCounter.tsx', // Without leading slash
			'./src/islands/SolidCounter.tsx', // Relative path
		];

		for (const testPath of pathsToTest) {
			console.log(`🔍 Testing path: ${testPath}`);

			try {
				const startTime = performance.now();
				const module = await viteServer.ssrLoadModule(testPath);
				const loadTime = performance.now() - startTime;

				console.log(`  ✅ SUCCESS - Loaded in ${loadTime.toFixed(2)}ms`);
				console.log(`  📦 Module info:`, {
					hasDefault: !!module.default,
					defaultType: typeof module.default,
					exportKeys: Object.keys(module),
				});

				// Test if it's a valid Solid component
				if (module.default && typeof module.default === 'function') {
					console.log(`  ✅ Valid Solid component function`);
				}
			} catch (error) {
				console.log(`  ❌ FAILED:`, error.message);
			}
			console.log('');
		}

		// Test all framework components with correct paths
		console.log('🧪 Testing all framework components with correct paths:\n');

		const components = [
			{ name: 'Preact', path: '/src/islands/PreactCounter.tsx' },
			{ name: 'Vue', path: '/src/islands/VueCounter.vue' },
			{ name: 'Svelte', path: '/src/islands/SvelteCounter.svelte' },
			{ name: 'Solid', path: '/src/islands/SolidCounter.tsx' },
		];

		for (const component of components) {
			console.log(`🔍 Testing ${component.name}: ${component.path}`);

			try {
				const startTime = performance.now();
				const module = await viteServer.ssrLoadModule(component.path);
				const loadTime = performance.now() - startTime;

				console.log(`  ✅ SUCCESS - ${component.name} loaded in ${loadTime.toFixed(2)}ms`);
				console.log(`  📦 Has default export: ${!!module.default}`);
			} catch (error) {
				console.log(`  ❌ FAILED: ${error.message}`);
			}
			console.log('');
		}
	} catch (error) {
		console.error('💥 Test failed:', error);
	} finally {
		if (viteServer) {
			await viteServer.close();
			console.log('🧹 Vite server closed');
		}
	}
}

if (import.meta.main) {
	testViteSSRPaths();
}
