#!/usr/bin/env bun
/**
 * Avalon Build Command - Batteries Included
 * Users can run: bun run build.ts
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { generateIslandManifest } from '../packages/avalon/src/build/island-manifest.ts';
import { detectUsedIntegrations, getRequiredIntegrations } from '../packages/avalon/src/build/integration-detection-plugin.ts';

const execFile = promisify(execFileCb);

async function runCommand(command: string, args: string[], description: string, silent = false): Promise<void> {
	try {
		await execFile(command, args, { stdio: silent ? 'pipe' : 'inherit' } as any);
	} catch {
		throw new Error(`${description} failed`);
	}
}

async function buildSSRBundles(): Promise<void> {
	const usedIntegrations = await detectUsedIntegrations();
	const requiredIntegrations = getRequiredIntegrations(usedIntegrations);

	if (requiredIntegrations.length === 0) {
		console.log('ℹ️ No integrations detected, skipping SSR build');
		return;
	}

	console.log(`📦 Building SSR bundles for: ${requiredIntegrations.join(', ')}`);
	await runCommand('bunx', ['vite', 'build', '--config', 'packages/avalon/vite.ssr.config.ts'], 'SSR build', true);
}

async function generateManifest(): Promise<void> {
	const manifest = await generateIslandManifest();
	const islandCount = Object.keys(manifest.islands).length;
	await mkdir('dist', { recursive: true });
	await writeFile('dist/island-manifest.json', JSON.stringify(manifest, null, 2));
	console.log(`✅ Island manifest: ${islandCount} islands`);
}

async function build(): Promise<void> {
	const start = performance.now();

	// 1. Detect integrations
	const usedIntegrations = await detectUsedIntegrations();
	const requiredIntegrations = getRequiredIntegrations(usedIntegrations);
	if (requiredIntegrations.length > 0) {
		console.log(`🔧 Detected integrations: ${requiredIntegrations.join(', ')}`);
	}

	// 2. Generate island manifest
	await generateManifest();

	// 3. Vite build
	console.log('⏳ Running Vite build...');
	await runCommand('bunx', ['vite', 'build', '--config', 'packages/avalon/vite.config.ts'], 'Vite build', true);
	console.log('✅ Vite build');

	// 4. SSR bundles
	await buildSSRBundles();

	const elapsed = ((performance.now() - start) / 1000).toFixed(1);
	console.log(`🎉 Build complete in ${elapsed}s`);
}

export { build };

if (import.meta.main) {
	try {
		await build();
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
}
