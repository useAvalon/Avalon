/**
 * Build script for Netlify deployment.
 *
 * Runs `vite build` and watches stdout for Nitro's completion message,
 * then kills the process (Vite/Nitro leaves open handles that prevent
 * clean exit). Runs post-build afterward.
 *
 * For edge presets, prerendering is skipped since edge functions serve
 * all routes with sub-50ms TTFB.
 */

import { spawn, execSync } from 'node:child_process';
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

// Run vite build — resolve when Nitro prints its success message
console.log(`[build] vite build (preset: ${PRESET})`);
await new Promise((resolve, reject) => {
	const child = spawn('bunx', ['--bun', 'vite', 'build'], {
		cwd: CWD,
		stdio: ['inherit', 'pipe', 'pipe'],
	});

	let settled = false;
	const finish = () => {
		if (settled) return;
		settled = true;
		child.kill();
		resolve();
	};

	// Pipe output, watch for Nitro's completion marker
	child.stdout.on('data', (chunk) => {
		process.stdout.write(chunk);
		if (chunk.toString().includes('nitro.json')) finish();
	});
	child.stderr.on('data', (chunk) => {
		process.stderr.write(chunk);
	});

	child.on('exit', (code) => {
		if (!settled) {
			if (code && code !== 0) reject(new Error(`vite build exited with code ${code}`));
			else resolve();
		}
	});

	// Safety timeout
	setTimeout(() => {
		if (!settled) {
			console.log('[build] Timeout — killing vite');
			finish();
		}
	}, 240_000);
});

// Post-build
console.log('[build] Running post-build...');
const env = IS_EDGE ? { ...process.env, AVALON_SKIP_PRERENDER: '1' } : process.env;
try {
	execSync('node post-build.mjs', { cwd: CWD, stdio: 'inherit', timeout: 120_000, env });
} catch (err) {
	console.error('[build] post-build warning:', err.message);
}

console.log('[build] ✅ Complete');
process.exit(0);
