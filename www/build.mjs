/**
 * Build script for Netlify deployment.
 *
 * Runs `vite build` and watches stdout for Nitro's completion message,
 * then kills the process (Vite/Nitro leaves open handles that prevent
 * clean exit). Runs post-build afterward.
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();

// Clean stale output
for (const dir of ['.netlify', '.output']) {
	const full = join(CWD, dir);
	if (existsSync(full)) {
		rmSync(full, { recursive: true, force: true });
		console.log(`[build] Cleaned ${dir}/`);
	}
}

// Run vite build — resolve when Nitro prints its success message
console.log('[build] vite build');
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

	setTimeout(() => {
		if (!settled) {
			console.log('[build] Timeout — killing vite');
			finish();
		}
	}, 240_000);
});

// Post-build
console.log('[build] Running post-build...');
try {
	execSync('node post-build.mjs', { cwd: CWD, stdio: 'inherit', timeout: 120_000 });
} catch (err) {
	console.error('[build] post-build warning:', err.message);
}

console.log('[build] ✅ Complete');
process.exit(0);
