#!/usr/bin/env -S deno run --allow-all

/**
 * Diagnostic script to test @avalon/avalon import resolution
 * This script verifies that renderIsland function is accessible from pages
 */

console.log('🔍 Starting import path resolution diagnostic...\n');

// Test 1: Direct import from mod.ts
console.log('📋 Test 1: Direct import from mod.ts');
try {
	const { renderIsland: directRenderIsland } = await import('./mod.ts');
	console.log('✅ Direct import successful');
	console.log('✅ renderIsland function type:', typeof directRenderIsland);
	console.log('✅ renderIsland function name:', directRenderIsland.name);
} catch (error) {
	console.error('❌ Direct import failed:', error);
}

console.log('\n📋 Test 2: Import via @avalon/avalon alias (from Avalon directory)');
try {
	// Change to Avalon directory to test the import mapping
	const originalCwd = Deno.cwd();
	Deno.chdir('./Avalon');

	try {
		const { renderIsland: aliasRenderIsland } = await import('@avalon/avalon');
		console.log('✅ @avalon/avalon import successful');
		console.log('✅ renderIsland function type:', typeof aliasRenderIsland);
		console.log('✅ renderIsland function name:', aliasRenderIsland.name);

		// Test calling the function with minimal parameters
		console.log('\n📋 Test 2a: Testing renderIsland function call');
		try {
			const result = await aliasRenderIsland({
				src: '/test/component.tsx',
				condition: 'on:client',
				ssr: false,
			});
			console.log('✅ renderIsland function call successful');
			console.log('✅ Result type:', typeof result);
			console.log('✅ Result has props:', 'props' in result);
		} catch (callError) {
			console.log('⚠️ renderIsland function call failed (expected for non-existent component):', callError.message);
		}
	} finally {
		Deno.chdir(originalCwd);
	}
} catch (error) {
	console.error('❌ @avalon/avalon import failed:', error);
}

console.log('\n📋 Test 3: Check if mod.ts exports are complete');
try {
	const modExports = await import('./mod.ts');
	const exportNames = Object.keys(modExports);
	console.log('✅ Available exports from mod.ts:');
	exportNames.forEach(name => {
		console.log(`  - ${name}: ${typeof modExports[name]}`);
	});

	// Check specifically for renderIsland
	if ('renderIsland' in modExports) {
		console.log('✅ renderIsland is properly exported');
	} else {
		console.error('❌ renderIsland is NOT exported from mod.ts');
	}
} catch (error) {
	console.error('❌ Failed to check mod.ts exports:', error);
}

console.log('\n📋 Test 4: Check island.tsx exports');
try {
	const islandExports = await import('./src/islands/island.tsx');
	const islandExportNames = Object.keys(islandExports);
	console.log('✅ Available exports from island.tsx:');
	islandExportNames.forEach(name => {
		console.log(`  - ${name}: ${typeof islandExports[name]}`);
	});

	if ('renderIsland' in islandExports) {
		console.log('✅ renderIsland is exported from island.tsx');
	} else {
		console.error('❌ renderIsland is NOT exported from island.tsx');
	}
} catch (error) {
	console.error('❌ Failed to check island.tsx exports:', error);
}

console.log('\n📋 Test 5: Test from a simulated page context');
try {
	// Simulate being in the Avalon directory like a page would be
	const originalCwd = Deno.cwd();
	Deno.chdir('./Avalon');

	try {
		// This is exactly how pages import renderIsland
		const { renderIsland } = await import('@avalon/avalon');

		console.log('✅ Page-like import successful');
		console.log('✅ Function available for page use');

		// Test with a real island component that exists
		console.log('\n📋 Test 5a: Testing with real PreactCounter component');
		try {
			const result = await renderIsland({
				src: '/islands/PreactCounter.tsx',
				condition: 'on:client',
				ssr: false,
			});
			console.log('✅ Real component test successful');
			console.log('✅ Result type:', typeof result);
		} catch (realComponentError) {
			console.log('⚠️ Real component test failed:', realComponentError.message);
		}
	} finally {
		Deno.chdir(originalCwd);
	}
} catch (error) {
	console.error('❌ Page-like import failed:', error);
}

console.log('\n📋 Test 6: Check Vite server availability');
try {
	// Check if global Vite server is available (needed for SSR)
	console.log('Checking global.__viteDevServer:', typeof globalThis.__viteDevServer);
	if (globalThis.__viteDevServer) {
		console.log('✅ Vite dev server is available globally');
		console.log('✅ ssrLoadModule available:', typeof globalThis.__viteDevServer.ssrLoadModule);
	} else {
		console.log('⚠️ Vite dev server not available (expected in diagnostic mode)');
	}
} catch (error) {
	console.error('❌ Failed to check Vite server:', error);
}

console.log('\n🎯 Import Resolution Diagnostic Complete');
console.log('If all tests passed, the import path resolution is working correctly.');
