/**
 * Build script for Netlify deployment.
 *
 * Runs `vite build`, then post-build (CSS patching, island isolation,
 * compression). For edge presets, prerendering is skipped since edge
 * functions serve all routes with sub-50ms TTFB.
 *
 * The execSync timeout handles the known issue where Vite/Nitro leaves
 * open handles after the build completes.
 */

import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const PRESET = process.env.NITRO_PRESET || 'node_server';
const IS_EDGE = PRESET.includes('edge');

// Clean stale output
for (const dir of ['.netlify', '.output']) {
	const full = join(CWD, dir);
	if (existsSync(full)) {
		rmSync(full, { recursive: true, force: true });
		console.log(`[build] Cleaned ${dir}/`);
	}
}

// Build
console.log(`[build] vite build (preset: ${PRESET})`);
try {
	execSync('bunx --bun vite build', {
		cwd: CWD,
		stdio: 'inherit',
		timeout: 240_000,
	});
} catch (err) {
	// Vite/Nitro often leaves open handles causing a non-zero exit or timeout.
	// Check if the build actually produced output before treating it as fatal.
	const hasOutput =
		existsSync(join(CWD, '.netlify', 'edge-functions', 'server', 'server.js')) ||
		existsSync(join(CWD, '.netlify', 'functions-internal', 'main.mjs')) ||
		existsSync(join(CWD, '.output', 'server', '_ssr', 'ssr.mjs'));

	if (!hasOutput) {
		console.error('[build] Build failed with no output');
		process.exit(1);
	}
	console.log('[build] Build produced output (ignoring hanging process)');
}

// Post-build
console.log('[build] Running post-build...');
const env = IS_EDGE ? { ...process.env, AVALON_SKIP_PRERENDER: '1' } : process.env;
try {
	execSync('node post-build.mjs', { cwd: CWD, stdio: 'inherit', timeout: 120_000, env });
} catch (err) {
	console.error('[build] post-build warning:', err.message);
}

console.log('[build] ✅ Complete');
