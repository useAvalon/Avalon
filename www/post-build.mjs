/**
 * Post-build script for Netlify deployment.
 *
 * Removes stale index.html files that would shadow SSR routes.
 * If index.html exists, Netlify serves it as a static file for "/"
 * which gives a blank page instead of the SSR-rendered content.
 */

import { existsSync, unlinkSync } from 'node:fs';

for (const htmlPath of ['dist/index.html', '.netlify/functions-internal/server/public/index.html']) {
	if (existsSync(htmlPath)) {
		unlinkSync(htmlPath);
		console.log(`[cleanup] Removed ${htmlPath}`);
	}
}

console.log('[post-build] Complete');
