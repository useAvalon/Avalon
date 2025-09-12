#!/usr/bin/env -S deno run --allow-all

/**
 * Build script for generating SSR bundles of Vue islands
 * This creates server-side renderable versions of Vue components
 */

import { build } from 'vite';
import { resolve } from '@std/path';

async function discoverVueIslands() {
	const entries: Record<string, string> = {};
	const cwd = Deno.cwd();

	// Check user's islands directory for Vue files
	try {
		const islandsPath = resolve(cwd, 'islands');
		for await (const dirEntry of Deno.readDir(islandsPath)) {
			if (dirEntry.isFile && dirEntry.name.endsWith('.vue')) {
				const name = dirEntry.name.replace(/\.vue$/, '');
				entries[`islands/${name}`] = resolve(islandsPath, dirEntry.name);
			}
		}
	} catch (_error) {
		// Islands directory doesn't exist, that's fine
	}

	return entries;
}

async function buildSSR() {
	const vueIslands = await discoverVueIslands();

	if (Object.keys(vueIslands).length === 0) {
		console.log('No Vue islands found, skipping SSR build');
		return;
	}

	console.log('Building SSR bundles for Vue islands...');

	// Build SSR versions of Vue islands
	await build({
		configFile: 'vite.config.ts',
		build: {
			ssr: true,
			outDir: 'dist/ssr',
			emptyOutDir: false,
			rollupOptions: {
				input: vueIslands,
				output: {
					format: 'esm',
					entryFileNames: '[name].js',
				},
			},
		},
	});

	console.log('✅ SSR build complete');
}

if (import.meta.main) {
	await buildSSR();
}
