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

// Check .nitro/vite intermediate build for SSR service
const nitroViteDir = 'node_modules/.nitro/vite';
console.log(`[nitro-vite] ${nitroViteDir}:`);
listDir(nitroViteDir);

// Check for SSR service bundle in the server output
for (const ssrDir of [
	'.netlify/functions-internal/server/_ssr',
	'.netlify/functions-internal/server/_services',
	'node_modules/.nitro/vite/services',
]) {
	if (existsSync(ssrDir)) {
		console.log(`\n[ssr-service] ${ssrDir}:`);
		listDir(ssrDir);
		// Read first 500 chars of any .mjs files to see what's in them
		const ssrFiles = readdirSync(ssrDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
		for (const f of ssrFiles) {
			const content = readFileSync(join(ssrDir, f), 'utf-8');
			console.log(`[ssr-service] ${f}: ${content.length} chars, first 500: ${content.slice(0, 500)}`);
		}
	} else {
		console.log(`[ssr-service] ${ssrDir}: NOT FOUND`);
	}
}

// Check if index.html still exists in .nitro cache (stale from previous build)
const nitroIndexHtml = 'node_modules/.nitro/vite/index.html';
if (existsSync(nitroIndexHtml)) {
	const content = readFileSync(nitroIndexHtml, 'utf-8');
	console.log(`[nitro-cache] ${nitroIndexHtml} EXISTS (${content.length} chars):`);
	console.log(content);
} else {
	console.log(`[nitro-cache] ${nitroIndexHtml}: NOT FOUND (good — no template mode)`);
}

// Check if the old placeholder text is still in the bundled server code
const serverDir = '.netlify/functions-internal/server';
if (existsSync(serverDir)) {
	// Check top-level files
	const checkFiles = readdirSync(serverDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
	for (const f of checkFiles) {
		const content = readFileSync(join(serverDir, f), 'utf-8');
		if (content.includes('Page content rendered by Avalon SSR pipeline')) {
			console.log(`[WARNING] Old placeholder found in ${f}`);
		}
		if (content.includes('Component render fallback')) {
			console.log(`[INFO] New fallback in ${f}`);
		}
	}
	// Check _chunks/ directory
	const chunksDir = join(serverDir, '_chunks');
	if (existsSync(chunksDir)) {
		const chunkFiles = readdirSync(chunksDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
		console.log(`[chunks] Found ${chunkFiles.length} chunk files`);
		let oldCount = 0;
		let newCount = 0;
		for (const f of chunkFiles) {
			const content = readFileSync(join(chunksDir, f), 'utf-8');
			if (content.includes('Page content rendered by Avalon SSR pipeline')) {
				console.log(`[WARNING] Old placeholder in _chunks/${f}`);
				oldCount++;
			}
			if (content.includes('Component render fallback')) {
				newCount++;
			}
		}
		console.log(`[chunks] Old placeholder: ${oldCount}, New fallback: ${newCount}`);
	}
	// Search main.mjs for key HTML fragments
	const mainMjs = join(serverDir, 'main.mjs');
	if (existsSync(mainMjs)) {
		const content = readFileSync(mainMjs, 'utf-8');
		console.log(`[main.mjs] ${content.length} chars`);

		// Search for the compiled routing — the findRoute function
		const findRouteIdx = content.indexOf('findRoute');
		if (findRouteIdx !== -1) {
			// Show context around findRoute to see what routes are compiled
			console.log(`[ROUTING] findRoute at ${findRouteIdx}: ...${content.slice(findRouteIdx, findRouteIdx + 500)}...`);
		}

		// Search for lazy handler imports (renderer would be lazy)
		const lazyIdx = content.indexOf('defineLazyEventHandler');
		if (lazyIdx !== -1) {
			console.log(
				`[LAZY] defineLazyEventHandler at ${lazyIdx}: ...${content.slice(Math.max(0, lazyIdx - 100), lazyIdx + 200)}...`,
			);
		}

		// Search for the renderer template virtual module output
		const rendererTemplateIdx = content.indexOf('renderer.template is not set');
		if (rendererTemplateIdx !== -1) {
			console.log(`[RENDERER-TEMPLATE] Found "renderer.template is not set" — no template configured`);
		}

		// Search for key strings that would appear in the rendered output
		const searches = [
			'SSR Error',
			'entry-server',
			'loadPage',
			'preactRenderToString',
			'ssr-outlet',
			'__nitro_vite_envs__',
			'fetchViteEnv',
			'Not found:',
			'<div id="app">',
			'_ssr/',
			'ssr.mjs',
			'renderer',
			'ssrRenderer',
			'fetchViteEnv',
			'internal/vite/ssr-renderer',
			'nitro/vite/runtime',
			'vite_envs',
			'__renderer',
			'rendererHandler',
			'catch-all',
		];
		for (const s of searches) {
			const idx = content.indexOf(s);
			if (idx !== -1) {
				const context = content.slice(Math.max(0, idx - 50), idx + s.length + 50);
				console.log(`[FOUND] "${s}" at ${idx}: ...${context}...`);
			} else {
				console.log(`[NOT FOUND] "${s}"`);
			}
		}
	}
}

// Check functions-internal
const fiDir = '.netlify/functions-internal';
console.log(`[functions-internal] ${fiDir}:`);
listDir(fiDir);

// Check for _ssr directory inside server output and read its contents
const ssrBundleDir = join(fiDir, 'server', '_ssr');
if (existsSync(ssrBundleDir)) {
	console.log(`\n[_ssr bundle] Found ${ssrBundleDir}:`);
	const ssrFiles = readdirSync(ssrBundleDir);
	for (const f of ssrFiles) {
		const full = join(ssrBundleDir, f);
		const stat = statSync(full);
		if (stat.isFile()) {
			const content = readFileSync(full, 'utf-8');
			console.log(`[_ssr] ${f}: ${content.length} chars`);
			// Search for key strings
			for (const s of ['loadPage', 'preactRenderToString', 'SSR Error', 'fetch', 'Response']) {
				if (content.includes(s)) {
					const idx = content.indexOf(s);
					console.log(`[_ssr] ${f} CONTAINS "${s}" at ${idx}`);
				}
			}
			// Show first 1000 chars
			console.log(`[_ssr] ${f} first 1000 chars:\n${content.slice(0, 1000)}`);
		}
	}
} else {
	console.log(`\n[_ssr bundle] NOT FOUND at ${ssrBundleDir}`);
}

// Check if server.mjs exists (written by Nitro's compiled hook)
const serverMjs = join(fiDir, 'server', 'server.mjs');
if (existsSync(serverMjs)) {
	console.log(`\n[server.mjs] Found! Contents:\n`);
	console.log(readFileSync(serverMjs, 'utf-8'));
} else {
	console.log(`\n[server.mjs] NOT FOUND at ${serverMjs}`);
	console.log('  This means Nitro compiled hook did not run (likely killed by process.exit)');
}

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
