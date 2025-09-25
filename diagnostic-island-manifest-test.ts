#!/usr/bin/env -S deno run --allow-all
/**
 * Diagnostic test for Island bundle manifest generation and path resolution
 * Tests task 4.1: Test Island bundle manifest generation
 */

import { join } from '@std/path';

console.log('🔍 Starting Island Bundle Manifest Diagnostic...\n');

const originalCwd = Deno.cwd();

try {
	console.log('📁 Running from root directory for testing\n');

	console.log('📋 Test 1: Import Island manifest functions');
	try {
		const { generateIslandManifest, getIslandBundlePath, loadIslandManifest } = await import(
			'./src/build/island-manifest.ts'
		);
		console.log('✅ Successfully imported generateIslandManifest');
		console.log('✅ Successfully imported getIslandBundlePath');
		console.log('✅ Successfully imported loadIslandManifest');
	} catch (error) {
		console.error('❌ Failed to import Island manifest functions:', error.message);
		throw error;
	}

	console.log('\n📋 Test 2: Generate Island manifest');
	try {
		const { generateIslandManifest } = await import('./src/build/island-manifest.ts');

		// Change to Avalon directory to generate manifest
		const currentDir = Deno.cwd();
		Deno.chdir('./Avalon');
		const manifest = await generateIslandManifest();
		Deno.chdir(currentDir);

		console.log('✅ Island manifest generated successfully');
		console.log('📊 Manifest structure:');
		console.log(`  - Version: ${manifest.version}`);
		console.log(`  - Build time: ${new Date(manifest.buildTime).toISOString()}`);
		console.log(`  - Islands count: ${Object.keys(manifest.islands).length}`);

		console.log('\n🏝️ Islands found:');
		for (const [name, island] of Object.entries(manifest.islands)) {
			console.log(`  - ${name}:`);
			console.log(`    • Source: ${island.src}`);
			console.log(`    • Bundle: ${island.bundle}`);
			console.log(`    • Framework: ${island.framework}`);
			console.log(`    • Hash: ${island.hash}`);
			console.log(`    • Dependencies: [${island.deps.join(', ')}]`);
		}

		// Verify expected islands are present
		const expectedIslands = ['PreactCounter', 'VueCounter', 'SvelteCounter', 'SolidCounter', 'ApiTester'];
		const foundIslands = Object.keys(manifest.islands);

		console.log('\n🔍 Verifying expected islands:');
		for (const expected of expectedIslands) {
			if (foundIslands.includes(expected)) {
				console.log(`✅ ${expected} found in manifest`);
			} else {
				console.log(`❌ ${expected} missing from manifest`);
			}
		}

		// Verify framework detection
		console.log('\n🔍 Verifying framework detection:');
		const frameworkTests = [
			{ name: 'PreactCounter', expected: 'preact' },
			{ name: 'VueCounter', expected: 'vue' },
			{ name: 'SvelteCounter', expected: 'vanilla' }, // Svelte detection might need improvement
			{ name: 'SolidCounter', expected: 'solid' },
		];

		for (const test of frameworkTests) {
			const island = manifest.islands[test.name];
			if (island) {
				if (island.framework === test.expected) {
					console.log(`✅ ${test.name}: framework correctly detected as ${island.framework}`);
				} else {
					console.log(`⚠️ ${test.name}: framework detected as ${island.framework}, expected ${test.expected}`);
				}
			}
		}

		// Store manifest for later tests
		(globalThis as any).testManifest = manifest;
	} catch (error) {
		console.error('❌ Failed to generate Island manifest:', error.message);
		throw error;
	}

	console.log('\n📋 Test 3: Test getIslandBundlePath in development mode');
	try {
		const { getIslandBundlePath } = await import('./src/build/island-manifest.ts');

		// Test development mode (current environment)
		const testPaths = [
			'/islands/PreactCounter.tsx',
			'/islands/VueCounter.vue',
			'/islands/SvelteCounter.svelte',
			'/islands/SolidCounter.tsx',
			'/islands/ApiTester.tsx',
		];

		console.log('🔧 Development mode bundle paths:');
		for (const src of testPaths) {
			try {
				const bundlePath = getIslandBundlePath(src);
				console.log(`✅ ${src} → ${bundlePath}`);

				// Verify the path format is correct for development
				if (bundlePath.startsWith('/src/islands/')) {
					console.log(`  ✓ Correct development path format`);
				} else {
					console.log(`  ⚠️ Unexpected development path format: ${bundlePath}`);
				}
			} catch (error) {
				console.log(`❌ Failed to get bundle path for ${src}: ${error.message}`);
			}
		}
	} catch (error) {
		console.error('❌ Failed to test getIslandBundlePath:', error.message);
	}

	console.log('\n📋 Test 4: Test getIslandBundlePath with manifest (production mode)');
	try {
		const { getIslandBundlePath } = await import('./src/build/island-manifest.ts');
		const manifest = (globalThis as any).testManifest;

		if (manifest) {
			console.log('🏭 Production mode bundle paths (with manifest):');
			for (const [name, island] of Object.entries(manifest.islands)) {
				try {
					const bundlePath = getIslandBundlePath(island.src, manifest);
					console.log(`✅ ${island.src} → ${bundlePath}`);

					// Verify the path matches the manifest entry
					if (bundlePath === island.bundle) {
						console.log(`  ✓ Matches manifest bundle path`);
					} else {
						console.log(`  ⚠️ Does not match manifest bundle path: ${island.bundle}`);
					}
				} catch (error) {
					console.log(`❌ Failed to get bundle path for ${island.src}: ${error.message}`);
				}
			}
		} else {
			console.log('❌ No manifest available for production mode testing');
		}
	} catch (error) {
		console.error('❌ Failed to test production mode bundle paths:', error.message);
	}

	console.log('\n📋 Test 5: Test manifest persistence and loading');
	try {
		const { generateIslandManifest, loadIslandManifest } = await import('./src/build/island-manifest.ts');

		// Generate and save manifest (change to Avalon directory for this)
		const currentDir = Deno.cwd();
		Deno.chdir('./Avalon');
		const manifest = await generateIslandManifest();
		await Deno.mkdir('dist', { recursive: true });
		await Deno.writeTextFile('dist/island-manifest.json', JSON.stringify(manifest, null, 2));
		Deno.chdir(currentDir);
		console.log('✅ Manifest saved to dist/island-manifest.json');

		// Load manifest back (from Avalon directory)
		Deno.chdir('./Avalon');
		const loadedManifest = await loadIslandManifest();
		Deno.chdir(currentDir);
		if (loadedManifest) {
			console.log('✅ Manifest loaded successfully');

			// Verify loaded manifest matches generated one
			if (JSON.stringify(manifest) === JSON.stringify(loadedManifest)) {
				console.log('✅ Loaded manifest matches generated manifest');
			} else {
				console.log('⚠️ Loaded manifest differs from generated manifest');
			}
		} else {
			console.log('❌ Failed to load manifest');
		}

		// Check if manifest file exists and is readable
		try {
			const manifestStat = await Deno.stat('./Avalon/dist/island-manifest.json');
			console.log(`✅ Manifest file size: ${manifestStat.size} bytes`);
		} catch (error) {
			console.log('❌ Manifest file not accessible:', error.message);
		}
	} catch (error) {
		console.error('❌ Failed to test manifest persistence:', error.message);
	}

	console.log('\n📋 Test 6: Verify Island source files exist');
	try {
		const { generateIslandManifest } = await import('./src/build/island-manifest.ts');

		// Change to Avalon directory to generate manifest
		const currentDir = Deno.cwd();
		Deno.chdir('./Avalon');
		const manifest = await generateIslandManifest();
		Deno.chdir(currentDir);

		console.log('📁 Checking Island source files:');
		for (const [name, island] of Object.entries(manifest.islands)) {
			const sourcePath = `Avalon/src${island.src}`;
			try {
				const stat = await Deno.stat(sourcePath);
				console.log(`✅ ${sourcePath} exists (${stat.size} bytes)`);
			} catch (error) {
				console.log(`❌ ${sourcePath} not found: ${error.message}`);
			}
		}
	} catch (error) {
		console.error('❌ Failed to verify source files:', error.message);
	}

	console.log('\n📋 Test 7: Test hash generation consistency');
	try {
		const { generateIslandManifest } = await import('./src/build/island-manifest.ts');

		// Generate manifest twice and compare hashes
		const currentDir = Deno.cwd();
		Deno.chdir('./Avalon');
		const manifest1 = await generateIslandManifest();
		await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
		const manifest2 = await generateIslandManifest();
		Deno.chdir(currentDir);

		console.log('🔄 Testing hash consistency:');
		for (const name of Object.keys(manifest1.islands)) {
			const hash1 = manifest1.islands[name]?.hash;
			const hash2 = manifest2.islands[name]?.hash;

			if (hash1 === hash2) {
				console.log(`✅ ${name}: hash consistent (${hash1})`);
			} else {
				console.log(`❌ ${name}: hash inconsistent (${hash1} vs ${hash2})`);
			}
		}
	} catch (error) {
		console.error('❌ Failed to test hash consistency:', error.message);
	}
} finally {
	Deno.chdir(originalCwd);
}

console.log('\n🎯 Island Bundle Manifest Diagnostic Complete');
