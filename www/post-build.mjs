/**
 * Post-build script for Netlify deployment.
 *
 * 1. Removes stale index.html files that would shadow SSR routes
 * 2. Copies the Nitro function to .netlify/v1/functions/ (Frameworks API)
 */

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

// Remove index.html from all output dirs — SSR handles all pages via the Netlify function.
// If index.html exists, Netlify serves it as a static file for "/" which gives
// a blank page instead of the SSR-rendered content.
for (const htmlPath of [
	'dist/index.html',
	'.netlify/functions-internal/server/public/index.html',
	'.netlify/v1/functions/server/public/index.html',
]) {
	if (existsSync(htmlPath)) {
		unlinkSync(htmlPath);
		console.log(`[cleanup] Removed ${htmlPath} (SSR handles all routes)`);
	}
}

// Copy to .netlify/v1/functions/
const fiDir = '.netlify/functions-internal';
const v1Dir = '.netlify/v1/functions/server';
if (existsSync(join(fiDir, 'server'))) {
	console.log(`[copy] Copying ${fiDir}/server/ -> ${v1Dir}/`);
	mkdirSync(v1Dir, { recursive: true });
	cpSync(join(fiDir, 'server'), v1Dir, { recursive: true });
	console.log('[copy] Done');
} else {
	console.error('[error] No server output found at', join(fiDir, 'server'));
	process.exit(1);
}

console.log('[post-build] Complete');
