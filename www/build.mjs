/**
 * Netlify build wrapper.
 *
 * Runs `vite build` as a child process. Vite/Nitro leaves open handles after
 * the build completes, which prevents the process from exiting. This wrapper
 * detects when the Nitro output files are fully written and kills the child
 * process so the Netlify build pipeline can continue.
 *
 * After the build, it runs post-build.mjs for cleanup and patching.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const NITRO_JSON = join(CWD, '.netlify', 'functions-internal', 'nitro.json');
const SERVER_MJS = join(CWD, '.netlify', 'functions-internal', 'server', 'server.mjs');
const OUTPUT_SSR = join(CWD, '.output', 'server', '_ssr', 'ssr.mjs');
const MAX_WAIT = 300_000; // 5 minutes absolute timeout

console.log('[build] Starting vite build...');

// Clean stale output dirs so the poll doesn't trigger on old files
import { rmSync } from 'node:fs';
for (const dir of ['.netlify', '.output']) {
	const full = join(CWD, dir);
	if (existsSync(full)) {
		rmSync(full, { recursive: true, force: true });
		console.log(`[build] Cleaned stale ${dir}/`);
	}
}

const child = spawn('bunx', ['--bun', 'vite', 'build'], {
	cwd: CWD,
	stdio: 'inherit',
	shell: true,
});

let exited = false;

child.on('exit', code => {
	if (exited) return;
	exited = true;
	console.log(`[build] vite build exited with code ${code}`);
	runPostBuild();
});

child.on('error', err => {
	console.error('[build] Failed to start vite build:', err);
	process.exit(1);
});

// Poll for Nitro output files — once the SSR bundle exists, the build is done
// even if the process hasn't exited yet. Check both netlify and node-server presets.
const pollInterval = setInterval(() => {
	if (exited) {
		clearInterval(pollInterval);
		return;
	}
	const netlifyReady = existsSync(NITRO_JSON) && existsSync(SERVER_MJS);
	const nodeServerReady = existsSync(OUTPUT_SSR);
	if (netlifyReady || nodeServerReady) {
		console.log(
			`[build] Nitro output detected (${netlifyReady ? 'netlify' : 'node-server'}), waiting 5s for final writes...`,
		);
		clearInterval(pollInterval);
		setTimeout(() => {
			if (!exited) {
				console.log('[build] Killing hanging vite process...');
				exited = true;
				child.kill('SIGTERM');
				setTimeout(() => {
					child.kill('SIGKILL');
					runPostBuild();
				}, 2_000);
			}
		}, 5_000);
	}
}, 2_000);

// Absolute timeout — if nothing happens in 5 minutes, bail
setTimeout(() => {
	if (!exited) {
		console.error('[build] Absolute timeout reached, killing process.');
		exited = true;
		child.kill('SIGKILL');
		runPostBuild();
	}
}, MAX_WAIT);

function runPostBuild() {
	clearInterval(pollInterval);

	console.log('[build] Running post-build...');
	const postBuild = spawn('bun', ['post-build.mjs'], {
		cwd: CWD,
		stdio: 'inherit',
		shell: true,
	});

	postBuild.on('exit', code => {
		if (code !== 0) {
			console.error(`[build] post-build.mjs exited with code ${code}`);
		}

		// Final verification
		if (existsSync(SERVER_MJS)) {
			console.log('[build] ✅ Server function found');
		} else {
			console.error('[build] ❌ Server function NOT found — deployment will fail');
		}

		if (existsSync(NITRO_JSON)) {
			console.log('[build] ✅ nitro.json found');
		} else {
			console.error('[build] ❌ nitro.json NOT found');
		}

		console.log('[build] Complete');
		process.exit(0);
	});

	postBuild.on('error', err => {
		console.error('[build] Failed to run post-build:', err);
		process.exit(0); // Still exit so Netlify can continue
	});
}
