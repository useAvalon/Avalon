#!/usr/bin/env bun
/**
 * Avalon Build Command - Batteries Included
 * Users can run: bun run build.ts
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { generateIslandManifest } from '../packages/avalon/src/build/island-manifest.ts';
import { BuildLogger } from '../packages/avalon/src/utils/build-logger.ts';
import { detectUsedIntegrations, getRequiredIntegrations } from '../packages/avalon/src/build/integration-detection-plugin.ts';

const execFile = promisify(execFileCb);

interface BuildStep {
	name: string;
	id: string;
	execute: (logger: BuildLogger) => Promise<void>;
}



async function runCommand(command: string, args: string[], description: string, silent = false): Promise<void> {
	try {
		const options = silent
			? { stdio: 'pipe' as const }
			: { stdio: 'inherit' as const };
		await execFile(command, args, options);
	} catch {
		throw new Error(`${description} failed`);
	}
}

async function buildSSRBundles(logger: BuildLogger): Promise<void> {
	// Detect which integrations are used
	const usedIntegrations = await detectUsedIntegrations();
	const requiredIntegrations = getRequiredIntegrations(usedIntegrations);
	
	if (requiredIntegrations.length === 0) {
		console.log('ℹ️ No integrations detected, skipping SSR build');
		return;
	}

	console.log(`📦 Building SSR bundles for: ${requiredIntegrations.join(', ')}`);

	try {
		// Use the SSR-specific Vite config
		await runCommand(
			'bunx',
			[
				'vite',
				'build',
				'--config',
				'packages/avalon/vite.ssr.config.ts',
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
	
	await mkdir('dist', { recursive: true });
	await writeFile('dist/island-manifest.json', JSON.stringify(manifest, null, 2));
	
	logger.updateProgress('manifest', islandCount, islandCount);
}

async function runViteBuild(_logger: BuildLogger): Promise<void> {
	await runCommand('bunx', ['vite', 'build', '--config', 'packages/avalon/vite.config.ts'], 'Vite build', true);
}

async function buildIntegrations(_logger: BuildLogger): Promise<void> {
	// Detect and log which integrations will be bundled
	const usedIntegrations = await detectUsedIntegrations();
	const requiredIntegrations = getRequiredIntegrations(usedIntegrations);
	
	if (requiredIntegrations.length > 0) {
		console.log(`🔧 Detected integrations: ${requiredIntegrations.join(', ')}`);
	} else {
		console.log('ℹ️ No framework integrations detected');
	}
}

async function buildWithLogger(): Promise<void> {
	const logger = new BuildLogger();

	const buildSteps: BuildStep[] = [
		{
			id: 'integrations',
			name: 'Detecting integrations',
			execute: buildIntegrations,
		},
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
		process.exit(1);
	}
}

export { buildWithLogger as build };

if (import.meta.main) {
	await buildWithLogger();
}
