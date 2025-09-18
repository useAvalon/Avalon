#!/usr/bin/env -S deno run --allow-all
/**
 * Avalon Build Command - Batteries Included
 * Users can run: deno run --allow-all build.ts
 */

import { generateIslandManifest } from './src/build/island-manifest.ts';
import { resolve } from '@std/path';

interface BuildStep {
	name: string;
	icon: string;
	execute: () => Promise<void>;
}

async function discoverVueIslands(): Promise<Record<string, string>> {
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
	} catch {
		// Islands directory doesn't exist, that's fine
	}

	return vueIslands;
}

async function runCommand(args: string[], description: string): Promise<void> {
	const process = new Deno.Command('deno', {
		args,
		stdout: 'inherit',
		stderr: 'inherit',
	});

	const { success } = await process.output();
	if (!success) {
		throw new Error(`${description} failed`);
	}
}

async function buildSSRBundles(): Promise<void> {
	const vueIslands = await discoverVueIslands();
	const islandCount = Object.keys(vueIslands).length;

	if (islandCount === 0) {
		console.log('No Vue islands found, skipping SSR build');
		return;
	}

	try {
		await runCommand(
			['run', '--allow-all', 'npm:vite', 'build', '--ssr', '--outDir', 'dist/ssr', ...Object.values(vueIslands)],
			'SSR build'
		);
		console.log(`✅ Built SSR bundles for ${islandCount} Vue islands`);
	} catch {
		console.warn('⚠️ SSR build failed, Vue islands will use client-only rendering');
	}
}

async function generateManifest(): Promise<void> {
	const manifest = await generateIslandManifest();
	await Deno.mkdir('dist', { recursive: true });
	await Deno.writeTextFile('dist/island-manifest.json', JSON.stringify(manifest, null, 2));
	console.log(`✅ Generated manifest for ${Object.keys(manifest.islands).length} islands`);
}

async function runViteBuild(): Promise<void> {
	await runCommand(['run', '--allow-all', 'npm:vite', 'build'], 'Vite build');
}

async function build(): Promise<void> {
	console.log('🏗️  Building with Avalon + Vite...');

	const buildSteps: BuildStep[] = [
		{
			name: 'Generating island manifest',
			icon: '📋',
			execute: generateManifest,
		},
		{
			name: 'Running Vite build',
			icon: '⚡',
			execute: runViteBuild,
		},
		{
			name: 'Building SSR bundles',
			icon: '🔄',
			execute: buildSSRBundles,
		},
	];

	try {
		for (const step of buildSteps) {
			console.log(`${step.icon} ${step.name}...`);
			await step.execute();
		}

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
