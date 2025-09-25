#!/usr/bin/env -S deno run --allow-all

/**
 * Diagnostic script to test renderIsland SSR functionality
 * This script tests the complete SSR pipeline for Island components
 */

console.log('🔍 Starting SSR functionality diagnostic...\n');

// Change to Avalon directory to use the correct import mapping
const originalCwd = Deno.cwd();
Deno.chdir('./Avalon');

try {
	console.log('📋 Test 1: Import renderIsland from page context');
	const { renderIsland } = await import('@avalon/avalon');
	console.log('✅ renderIsland imported successfully');

	console.log('\n📋 Test 2: Test renderIsland with SSR enabled (PreactCounter)');
	try {
		const result = await renderIsland({
			src: '/islands/PreactCounter.tsx',
			condition: 'on:client',
			ssr: true, // Enable SSR
			props: { initialCount: 5 },
		});

		console.log('✅ PreactCounter SSR test completed');
		console.log('✅ Result type:', typeof result);
		console.log('✅ Result has props:', 'props' in result);

		// Check if the result has the expected structure
		if (result && typeof result === 'object' && 'props' in result) {
			console.log('✅ Result structure looks correct');
			console.log('✅ Result props keys:', Object.keys(result.props || {}));
		}
	} catch (error) {
		console.error('❌ PreactCounter SSR test failed:', error.message);
		console.error('Full error:', error);
	}

	console.log('\n📋 Test 3: Test renderIsland with SSR enabled (VueCounter)');
	try {
		const result = await renderIsland({
			src: '/islands/VueCounter.vue',
			condition: 'on:client',
			ssr: true,
			props: { initialCount: 10 },
		});

		console.log('✅ VueCounter SSR test completed');
		console.log('✅ Result type:', typeof result);
	} catch (error) {
		console.error('❌ VueCounter SSR test failed:', error.message);
	}

	console.log('\n📋 Test 4: Test renderIsland with SSR enabled (SvelteCounter)');
	try {
		const result = await renderIsland({
			src: '/islands/SvelteCounter.svelte',
			condition: 'on:client',
			ssr: true,
			props: { initialCount: 15 },
		});

		console.log('✅ SvelteCounter SSR test completed');
		console.log('✅ Result type:', typeof result);
	} catch (error) {
		console.error('❌ SvelteCounter SSR test failed:', error.message);
	}

	console.log('\n📋 Test 5: Test renderIsland with client-only rendering');
	try {
		const result = await renderIsland({
			src: '/islands/PreactCounter.tsx',
			condition: 'on:client',
			ssr: false, // Disable SSR
			props: { initialCount: 20 },
		});

		console.log('✅ Client-only test completed');
		console.log('✅ Result type:', typeof result);
	} catch (error) {
		console.error('❌ Client-only test failed:', error.message);
	}

	console.log('\n📋 Test 6: Check if Island components exist');
	const islandPaths = [
		'./src/islands/PreactCounter.tsx',
		'./src/islands/VueCounter.vue',
		'./src/islands/SvelteCounter.svelte',
		'./src/islands/SolidCounter.tsx',
	];

	for (const path of islandPaths) {
		try {
			const stat = await Deno.stat(path);
			console.log(`✅ ${path} exists (${stat.size} bytes)`);
		} catch {
			console.log(`❌ ${path} does not exist`);
		}
	}

	console.log('\n📋 Test 7: Test bundle path resolution');
	try {
		const { getIslandBundlePath } = await import('@avalon/avalon');

		const bundlePaths = ['/islands/PreactCounter.tsx', '/islands/VueCounter.vue', '/islands/SvelteCounter.svelte'];

		for (const src of bundlePaths) {
			try {
				const bundlePath = getIslandBundlePath(src);
				console.log(`✅ Bundle path for ${src}: ${bundlePath}`);
			} catch (error) {
				console.log(`❌ Bundle path resolution failed for ${src}: ${error.message}`);
			}
		}
	} catch (error) {
		console.error('❌ Failed to test bundle path resolution:', error.message);
	}
} finally {
	Deno.chdir(originalCwd);
}

console.log('\n🎯 SSR Functionality Diagnostic Complete');
