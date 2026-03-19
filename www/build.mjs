/**
 * Build wrapper for Netlify deployment.
 *
 * Vite/Nitro leaves open handles after build that prevent the process
 * from exiting. This script runs vite build with a timeout — if it
 * hangs after completing, the timeout kills it and we continue to
 * post-build inspection.
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ── Step 1: Run vite build ──────────────────────────────────────
console.log('\n=== Running vite build ===\n');
try {
	// 3 minute timeout — build itself takes ~10s, but if it hangs
	// due to open handles, the timeout will kill it.
	execSync('bunx --bun vite build', {
		stdio: 'inherit',
		env: { ...process.env },
		timeout: 180_000,
	});
} catch (err) {
	// execSync throws on timeout too — check if build actually succeeded
	if (err.killed || err.signal === 'SIGTERM') {
		console.log('\n[build.mjs] vite build timed out (likely open handles), checking output...');
	} else if (err.status !== null && err.status !== 0) {
		console.error('vite build failed with exit code', err.status);
		process.exit(1);
	}
}

// ── Step 2: Post-build inspection ───────────────────────────────
function listDir(dir, prefix = '') {
	if (!existsSync(dir)) {
		console.log(`  ${prefix}(not found: ${dir})`);
		return;
	}
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			console.log(`  ${prefix}${entry}/`);
			listDir(full, prefix + '  ');
		} else {
			console.log(`  ${prefix}${entry} (${stat.size} bytes)`);
		}
	}
}

console.log('\n=== Post-build: Inspecting Nitro output ===\n');

const fiDir = '.netlify/functions-internal';
console.log(`[functions-internal] ${fiDir}:`);
listDir(fiDir);

// Check for server entry files
const serverDir = join(fiDir, 'server');
for (const name of ['server.mjs', 'main.mjs', 'index.mjs']) {
	const f = join(serverDir, name);
	if (existsSync(f)) {
		console.log(`\n[✓] Found ${name} (${statSync(f).size} bytes)`);
	}
}

console.log(`\n[dist] dist/:`);
listDir('dist');

console.log('\n=== Post-build complete ===\n');
