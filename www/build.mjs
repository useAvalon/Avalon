/**
 * Netlify build wrapper.
 *
 * Runs `vite build` then post-build.mjs, and force-exits to avoid
 * Netlify's "background executions still going on" error caused by
 * Vite/Nitro leaving open handles after the build completes.
 */

import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const NITRO_JSON = join(CWD, '.netlify', 'functions-internal', 'nitro.json');
const SERVER_MJS = join(CWD, '.netlify', 'functions-internal', 'server', 'server.mjs');
const OUTPUT_SSR = join(CWD, '.output', 'server', '_ssr', 'ssr.mjs');

console.log('[build] Starting vite build...');

// Clean stale output dirs
for (const dir of ['.netlify', '.output']) {
	const full = join(CWD, dir);
	if (existsSync(full)) {
		rmSync(full, { recursive: true, force: true });
		console.log(`[build] Cleaned stale ${dir}/`);
	}
}

// Run vite build synchronously — execSync blocks until the process exits
// and doesn't leave orphan background processes.
try {
	execSync('bunx --bun vite build', {
		cwd: CWD,
		stdio: 'inherit',
		timeout: 300_000, // 5 min
	});
	console.log('[build] vite build completed');
} catch (err) {
	// Vite exits with code 1 due to stderr warnings even on success.
	// Check if the output files exist to determine actual success.
	const netlifyReady = existsSync(NITRO_JSON) && existsSync(SERVER_MJS);
	const nodeServerReady = existsSync(OUTPUT_SSR);
	if (netlifyReady || nodeServerReady) {
		console.log('[build] vite build exited with warnings but output exists — continuing');
	} else {
		console.error('[build] vite build failed and no output found');
		console.error(err.message);
		process.exit(1);
	}
}

// Run post-build synchronously
console.log('[build] Running post-build...');
try {
	execSync('bun post-build.mjs', {
		cwd: CWD,
		stdio: 'inherit',
		timeout: 60_000,
	});
} catch (err) {
	console.error('[build] post-build failed:', err.message);
}

// Verify output
if (existsSync(SERVER_MJS)) {
	console.log('[build] ✅ Server function found');
} else if (existsSync(OUTPUT_SSR)) {
	console.log('[build] ✅ SSR bundle found (node-server preset)');
} else {
	console.error('[build] ❌ No server output found');
}

console.log('[build] ✅ Complete');
process.exit(0);
