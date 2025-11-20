#!/usr/bin/env -S deno run --allow-all
/**
 * Avalon Build Command - Batteries Included
 * Users can run: deno run --allow-all build.ts
 */

import { generateIslandManifest } from './src/build/island-manifest.ts';
import { resolve } from '@std/path';
import { BuildLogger } from './src/utils/build-logger.ts';

interface BuildStep {
	name: string;
	id: string;
	execute: (logger: BuildLogger) => Promise<void>;
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

async function runCommand(args: string[], description: string, silent = false): Promise<void> {
	const process = new Deno.Command('deno', {
		args,
		stdout: silent ? 'piped' : 'inherit',
		stderr: silent ? 'piped' : 'inherit',
	});

	const { success } = await process.output();
	if (!success) {
		throw new Error(`${description} failed`);
	}
}

async function buildSSRBundles(logger: BuildLogger): Promise<void> {
	const vueIslands = await discoverVueIslands();
	const islandCount = Object.keys(vueIslands).length;

	if (islandCount === 0) {
		return;
	}

	try {
		await runCommand(
			[
				'run',
				'--allow-all',
				'--unstable-detect-cjs',
				'npm:vite',
				'build',
				'--ssr',
				'--outDir',
				'dist/ssr',
				...Object.values(vueIslands),
			],
			'SSR build',
			true
		);
	} catch {
		logger.errorTask('ssr');
		throw new Error('SSR build failed');
	}
}

async function generateManifest(logger: BuildLogger): Promise<void> {
	const manifest = await generateIslandManifest();
	const islandCount = Object.keys(manifest.islands).length;
	
	await Deno.mkdir('dist', { recursive: true });
	await Deno.writeTextFile('dist/island-manifest.json', JSON.stringify(manifest, null, 2));
	
	logger.updateProgress('manifest', islandCount, islandCount);
}

async function runViteBuild(_logger: BuildLogger): Promise<void> {
	await runCommand(['run', '--allow-all', '--unstable-detect-cjs', 'npm:vite', 'build'], 'Vite build', true);
}

async function buildWithLogger(): Promise<void> {
	const logger = new BuildLogger();

	const buildSteps: BuildStep[] = [
		{
			id: 'manifest',
			name: 'Generating island manifest',
			execute: generateManifest,
		},
		{
			id: 'vite',
			name: 'Running Vite build',
			execute: runViteBuild,
		},
		{
			id: 'ssr',
			name: 'Building SSR bundles',
			execute: buildSSRBundles,
		},
	];

	// Add all tasks
	for (const step of buildSteps) {
		logger.addTask(step.id, step.name);
	}

	logger.startSpinner();

	try {
		for (const step of buildSteps) {
			logger.startTask(step.id);
			await step.execute(logger);
			logger.completeTask(step.id);
		}

		logger.finish(true);
	} catch (_error) {
		logger.finish(false);
		Deno.exit(1);
	}
}

export { buildWithLogger as build };

if (import.meta.main) {
	await buildWithLogger();
}
