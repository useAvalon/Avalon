/**
 * Post-build script for Netlify deployment.
 *
 * Nitro's netlify preset outputs to .netlify/functions-internal/server/
 * but Netlify only auto-discovers functions there when a recognized
 * framework adapter is present. For custom frameworks, we need to copy
 * the function to .netlify/v1/functions/ (the documented Frameworks API).
 *
 * This script also logs the build output structure for debugging.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

function listDir(dir, prefix = '') {
	if (!existsSync(dir)) {
		console.log(`  ${prefix}(not found: ${dir})`);
		return;
	}
	const entries = readdirSync(dir);
	for (const entry of entries) {
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

// Check if the old placeholder text is still in the bundled server code
const serverDir = '.netlify/functions-internal/server';
if (existsSync(serverDir)) {
	const checkFiles = readdirSync(serverDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
	for (const f of checkFiles) {
		const content = readFileSync(join(serverDir, f), 'utf-8');
		if (content.includes('Page content rendered by Avalon SSR pipeline')) {
			console.log(`[WARNING] Old placeholder found in ${f} — renderer fix NOT applied`);
		} else {
			console.log(`[OK] ${f} does not contain old placeholder`);
		}
		if (content.includes('Component render fallback')) {
			console.log(`[INFO] ${f} contains new fallback text — renderer fix IS applied`);
		}
	}
}

// Check functions-internal
const fiDir = '.netlify/functions-internal';
console.log(`[functions-internal] ${fiDir}:`);
listDir(fiDir);

// Check if server.mjs exists (written by Nitro's compiled hook)
const serverMjs = join(fiDir, 'server', 'server.mjs');
if (existsSync(serverMjs)) {
	console.log(`\n[server.mjs] Found! Contents:\n`);
	console.log(readFileSync(serverMjs, 'utf-8'));
} else {
	console.log(`\n[server.mjs] NOT FOUND at ${serverMjs}`);
	console.log('  This means Nitro compiled hook did not run (likely killed by process.exit)');
}

// Remove index.html from dist — SSR handles all pages via the Netlify function.
// If index.html exists, Netlify serves it as a static file for "/" which gives
// a blank page (it only contains <!--ssr-outlet--> placeholder).
if (existsSync('dist/index.html')) {
	unlinkSync('dist/index.html');
	console.log('[cleanup] Removed dist/index.html (SSR handles all routes)');
}

// Check dist (publish dir)
console.log(`\n[dist] dist/:`);
listDir('dist');

// Copy to .netlify/v1/functions/
const v1Dir = '.netlify/v1/functions/server';
console.log(`\n[copy] Copying ${fiDir}/server/ -> ${v1Dir}/`);
mkdirSync(v1Dir, { recursive: true });
cpSync(join(fiDir, 'server'), v1Dir, { recursive: true });
console.log('[copy] Done');

// List v1 functions
console.log(`\n[v1/functions] .netlify/v1/functions/:`);
listDir('.netlify/v1/functions');

console.log('\n=== Post-build complete ===\n');
