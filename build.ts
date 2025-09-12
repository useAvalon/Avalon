#!/usr/bin/env -S deno run --allow-all
/**
 * Avalon Build Command - Batteries Included
 * Users can run: deno run --allow-all -A jsr:@avalon/avalon/build
 */

import { generateIslandManifest } from './src/build/island-manifest.ts';
import { resolve } from '@std/path';

async function buildSSRBundles() {
	// Discover Vue islands
	const vueIslands: Record<string, string> = {};
	const cwd = Deno.cwd();

	try {
		const islandsPath = resolve(cwd, 'islands');
		for await (const dirEntry of Deno.readDir(islandsPath)) {
			if (dirEntry.isFile && dirEntry.name.endsWith('.vue')) {
				const name = dirEntry.name.replace(/\.vue$/, '');
				vueIslands[`islands/${name}`] = resolve(islandsPath, dirEntry.name);
			}
		}
	} catch (_error) {
		// Islands directory doesn't exist, that's fine
	}

	if (Object.keys(vueIslands).length === 0) {
		console.log('No Vue islands found, skipping SSR build');
		return;
	}

	// Build SSR bundles using Vite
	const ssrBuildProcess = new Deno.Command('deno', {
		args: ['run', '--allow-all', 'npm:vite', 'build', '--ssr', '--outDir', 'dist/ssr', ...Object.values(vueIslands)],
		stdout: 'inherit',
		stderr: 'inherit',
	});

	const { success } = await ssrBuildProcess.output();

	if (!success) {
		console.warn('⚠️ SSR build failed, Vue islands will use client-only rendering');
	} else {
		console.log(`✅ Built SSR bundles for ${Object.keys(vueIslands).length} Vue islands`);
	}
}

async function build() {
	console.log('🏗️  Building with Avalon + Vite...');

	try {
		// Generate island manifest
		console.log('📋 Generating island manifest...');
		const manifest = await generateIslandManifest();

		// Write manifest to dist directory
		await Deno.mkdir('dist', { recursive: true });
		await Deno.writeTextFile('dist/island-manifest.json', JSON.stringify(manifest, null, 2));

		console.log(`✅ Generated manifest for ${Object.keys(manifest.islands).length} islands`);

		// Run Vite build with Deno
		console.log('⚡ Running Vite build...');

		const viteProcess = new Deno.Command('deno', {
			args: ['run', '--allow-all', 'npm:vite', 'build'],
			stdout: 'inherit',
			stderr: 'inherit',
		});

		const { success } = await viteProcess.output();

		if (!success) {
			throw new Error('Vite build failed');
		}

		// Build SSR bundles for Vue islands
		console.log('🔄 Building SSR bundles...');
		await buildSSRBundles();

		console.log('✅ Build completed successfully!');
		console.log('📦 Built files are in the dist/ directory');
		console.log('🚀 Run `deno task preview` to test the production build');
	} catch (error) {
		console.error('❌ Build failed:', error);
		Deno.exit(1);
	}
}

// Export the build function for programmatic use
export { build };

if (import.meta.main) {
	await build();
}
