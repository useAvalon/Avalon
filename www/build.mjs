/**
 * Production build wrapper.
 *
 * Vite/Nitro leaves open handles after the build completes, preventing
 * the Node process from exiting. This wrapper detects when the build
 * output is ready, kills the entire process group, then runs post-build.
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const NITRO_JSON = join(CWD, '.netlify', 'functions-internal', 'nitro.json');
const SERVER_MJS = join(CWD, '.netlify', 'functions-internal', 'server', 'server.mjs');
const OUTPUT_SSR = join(CWD, '.output', 'server', '_ssr', 'ssr.mjs');
const CF_WORKER = join(CWD, 'dist', '_worker.js');

console.log('[build] Starting vite build...');

// Clean stale output dirs
for (const dir of ['.netlify', '.output', 'netlify', 'dist']) {
	const full = join(CWD, dir);
	if (existsSync(full)) {
		rmSync(full, { recursive: true, force: true });
		console.log(`[build] Cleaned stale ${dir}/`);
	}
}

// Spawn vite build in its own process group so we can kill the whole tree.
// On Linux (CI), { detached: true } puts it in a new process group.
const child = spawn('bunx', ['--bun', 'vite', 'build'], {
	cwd: CWD,
	stdio: 'inherit',
	detached: true,
});

const childPid = child.pid;
let done = false;
let killedEarly = false;
let viteExitCode = 0;

function killTree() {
	try {
		// Kill the entire process group (negative PID on Linux)
		process.kill(-childPid, 'SIGKILL');
	} catch {
		// Already dead or not a group leader
	}
	try {
		child.kill('SIGKILL');
	} catch {
		// Already dead
	}
}

function finish() {
	if (done) return;
	done = true;
	clearInterval(poll);
	clearTimeout(absoluteTimeout);

	if (killedEarly) killTree();

	setTimeout(() => {
		console.log('[build] Running post-build...');
		try {
			execSync('node post-build.mjs', { cwd: CWD, stdio: 'inherit', timeout: 120_000 });
		} catch (err) {
			console.error('[build] post-build failed:', err.message);
			process.exit(1);
		}

		const V1_SERVER = join(CWD, '.netlify', 'v1', 'functions', 'server', 'server.mjs');
		const ok =
			existsSync(CF_WORKER) ||
			existsSync(V1_SERVER) ||
			existsSync(SERVER_MJS) ||
			existsSync(OUTPUT_SSR);
		if (existsSync(CF_WORKER)) console.log('[build] ✅ Cloudflare worker found (dist/_worker.js)');
		else if (existsSync(V1_SERVER)) console.log('[build] ✅ Server function found (v1 API)');
		else if (existsSync(SERVER_MJS)) console.log('[build] ✅ Server function found (legacy)');
		else if (existsSync(OUTPUT_SSR)) console.log('[build] ✅ SSR bundle found');
		else console.error('[build] ❌ No server output found');

		if (!ok) process.exit(1);
		console.log('[build] ✅ Complete');
		process.exit(killedEarly || viteExitCode === 0 ? 0 : viteExitCode);
	}, 500);
}

child.on('exit', (code) => {
	console.log(`[build] vite build exited with code ${code}`);
	viteExitCode = code ?? (killedEarly ? 0 : 1);
	finish();
});

child.on('error', err => {
	console.error('[build] spawn error:', err);
	process.exit(1);
});

const poll = setInterval(() => {
	// Cloudflare `_worker.js` appears during the client build; killing then
	// aborts SSR. Only force-stop the Netlify/Node hang.
	const netlifyReady = existsSync(NITRO_JSON) && existsSync(SERVER_MJS);
	const nodeServerReady = existsSync(OUTPUT_SSR);
	if (netlifyReady || nodeServerReady) {
		killedEarly = true;
		const kind = netlifyReady ? "netlify" : "node-server";
		console.log(`[build] Output detected (${kind}), waiting 3s for final writes...`);
		clearInterval(poll);
		setTimeout(finish, 3_000);
	}
}, 1_000);

const absoluteTimeout = setTimeout(() => {
	console.error('[build] Timeout — killing build');
	killedEarly = true;
	finish();
}, 240_000);
