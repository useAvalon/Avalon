/**
 * Post-build script for local and Netlify deployment.
 *
 * - Removes stale index.html files that would shadow SSR routes
 * - Patches the SSR bundle to include ALL CSS files (not just entry-client's)
 * - Generates _redirects for island JS path mapping (clean → hashed)
 * - Copies island JS to clean paths for local vite preview
 *
 * On Netlify, build.mjs calls this logic directly. This script exists
 * for standalone use (e.g. after a local `vite build`).
 */

import {
	existsSync,
	unlinkSync,
	readFileSync,
	writeFileSync,
	readdirSync,
	copyFileSync,
	mkdirSync,
	cpSync,
} from 'node:fs';
import { join, dirname, relative } from 'node:path';

const CWD = process.cwd();
const DIST_DIR = join(CWD, 'dist');
const ASSETS_DIR = join(CWD, 'dist', 'assets');

// ─── Helpers ─────────────────────────────────────────────────────────

function collectFiles(dir, predicate, result = []) {
	if (!existsSync(dir)) return result;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			collectFiles(full, predicate, result);
		} else if (predicate(entry.name)) {
			result.push(full);
		}
	}
	return result;
}

function toServePath(absPath) {
	return '/' + relative(DIST_DIR, absPath).replaceAll('\\', '/');
}

// ─── Cleanup ─────────────────────────────────────────────────────────

for (const htmlPath of ['dist/index.html', '.netlify/functions-internal/server/public/index.html']) {
	const full = join(CWD, htmlPath);
	if (existsSync(full)) {
		unlinkSync(full);
		console.log(`[cleanup] Removed ${htmlPath}`);
	}
}

// ─── Patch SSR bundle CSS ────────────────────────────────────────────

function patchSSRBundleCSS(ssrBundlePath) {
	if (!existsSync(ssrBundlePath)) return;

	// Look for CSS in multiple possible asset directories
	const assetsDirs = [
		ASSETS_DIR,
		join(CWD, '.netlify', 'functions-internal', 'server', 'public', 'assets'),
		join(CWD, '.output', 'public', 'assets'),
	];
	const assetsDir = assetsDirs.find(d => existsSync(d));
	if (!assetsDir) return;

	const allCssPaths = collectFiles(assetsDir, n => n.endsWith('.css')).map(f => {
		// Normalize to /assets/... serve path regardless of source dir
		const rel = f.substring(assetsDir.length).replaceAll('\\', '/');
		return '/assets' + rel;
	});
	console.log(`[patch] Found ${allCssPaths.length} CSS files in ${assetsDir}`);
	for (const p of allCssPaths) console.log(`  ${p}`);

	let code = readFileSync(ssrBundlePath, 'utf-8');

	// The SSR bundle has a client assets object like:
	//   css:[{href:`/assets/entry-client-XXX.css`}]
	// or with double quotes. We find it and append all missing CSS files.
	const patterns = [
		{ re: /css:\[(\{href:`[^`]+`\}(?:,\{href:`[^`]+`\})*)\]/, hrefRe: /href:`([^`]+)`/g, q: '`' },
		{ re: /css:\[(\{href:"[^"]+"\}(?:,\{href:"[^"]+"\})*)\]/, hrefRe: /href:"([^"]+)"/g, q: '"' },
	];

	for (const { re, hrefRe, q } of patterns) {
		const match = re.exec(code);
		if (!match) continue;

		const existingSet = new Set([...match[1].matchAll(hrefRe)].map(m => m[1]));
		const newPaths = allCssPaths.filter(p => !existingSet.has(p));
		if (newPaths.length === 0) {
			console.log('[patch] All CSS already included');
			return;
		}

		const newEntries = newPaths.map(p => `{href:${q}${p}${q}}`).join(',');
		code = code.replace(match[0], `css:[${match[1]},${newEntries}]`);
		writeFileSync(ssrBundlePath, code);
		console.log(`[patch] ✅ Added ${newPaths.length} CSS files to SSR bundle`);
		return;
	}

	console.warn('[patch] Could not find CSS array in SSR bundle');
}

// ─── Generate island redirects + local copies ────────────────────────

function generateIslandRedirects() {
	const islandsDir = join(ASSETS_DIR, 'islands');
	if (!existsSync(islandsDir)) {
		console.log('[redirects] No dist/assets/islands/ directory found');
		return;
	}

	const islandFiles = collectFiles(islandsDir, n => n.endsWith('.js') && !n.endsWith('.js.map'));
	if (islandFiles.length === 0) {
		console.log('[redirects] No island JS files found');
		return;
	}

	const redirectLines = [];

	for (const absPath of islandFiles) {
		const servePath = toServePath(absPath);
		// Clean path: strip /assets/ prefix and remove hash
		// /assets/islands/app/.../LandingHero-CncG4te0.js → /islands/app/.../LandingHero.js
		const cleanPath = servePath.replace('/assets/', '/').replace(/-[A-Za-z0-9_-]{6,12}\.js$/, '.js');

		redirectLines.push(`${cleanPath}  ${servePath}  200`);

		// Copy to clean path for local vite preview (which doesn't process _redirects)
		const cleanAbsPath = join(DIST_DIR, cleanPath.slice(1));
		mkdirSync(dirname(cleanAbsPath), { recursive: true });
		copyFileSync(absPath, cleanAbsPath);
		console.log(`[islands] ${cleanPath} → ${servePath}`);
	}

	// Write _redirects for Netlify (replace any existing island rewrites)
	const redirectsPath = join(DIST_DIR, '_redirects');
	let existing = existsSync(redirectsPath) ? readFileSync(redirectsPath, 'utf-8') : '';
	// Remove any previous island rewrites
	existing = existing.replaceAll(/# Island JS path rewrites[^\n]*\n(?:\/islands\/[^\n]*\n)*/g, '').trim();
	const header = '# Island JS path rewrites (generated by post-build.mjs)\n';
	const content = existing
		? existing + '\n\n' + header + redirectLines.join('\n') + '\n'
		: header + redirectLines.join('\n') + '\n';
	writeFileSync(redirectsPath, content);
	console.log(`[redirects] ✅ Wrote ${redirectLines.length} island redirects + local copies`);
}

// ─── Copy framework adapters to dist/ ────────────────────────────────

function copyAdapters() {
	// Adapters are emitted to .output/public/_adapters/ by the client build.
	// Copy them to dist/_adapters/ so vite preview can serve them.
	const sources = [
		join(CWD, '.output', 'public', '_adapters'),
		join(CWD, 'dist', '_adapters'), // already there if netlify preset
	];

	for (const srcDir of sources) {
		if (!existsSync(srcDir)) continue;
		const files = readdirSync(srcDir).filter(f => f.endsWith('.js'));
		if (files.length === 0) continue;

		const destDir = join(DIST_DIR, '_adapters');
		mkdirSync(destDir, { recursive: true });

		for (const file of files) {
			const src = join(srcDir, file);
			const dest = join(destDir, file);
			if (src !== dest) {
				copyFileSync(src, dest);
				console.log(`[adapters] /_adapters/${file}`);
			}
		}
		console.log(`[adapters] ✅ Copied ${files.length} framework adapters`);
		return;
	}

	console.log('[adapters] No _adapters/ directory found');
}

// ─── Copy SSR CSS to client assets ───────────────────────────────────
// The SSR build produces a CSS file that contains ALL CSS modules
// (layouts, pages, components). The client build only includes CSS
// from entry-client.ts imports. We copy the SSR CSS to dist/assets/
// so it gets served alongside the client CSS, ensuring layout styles
// (nav, sidebar, docs layout, etc.) are available in the browser.

function copySSRCSSToClient() {
	const ssrAssetsDirs = [join(CWD, 'node_modules', '.nitro', 'vite', 'services', 'ssr', 'assets')];

	for (const ssrAssetsDir of ssrAssetsDirs) {
		if (!existsSync(ssrAssetsDir)) continue;
		const cssFiles = readdirSync(ssrAssetsDir).filter(f => f.endsWith('.css'));
		if (cssFiles.length === 0) continue;

		// Copy to dist/assets/, .output/public/assets/ (node-server), and .netlify public (netlify preset)
		const destDirs = [
			ASSETS_DIR,
			join(CWD, '.output', 'public', 'assets'),
			join(CWD, '.netlify', 'functions-internal', 'server', 'public', 'assets'),
		];
		for (const destDir of destDirs) {
			mkdirSync(destDir, { recursive: true });
			for (const file of cssFiles) {
				const src = join(ssrAssetsDir, file);
				const dest = join(destDir, `ssr-${file}`);
				copyFileSync(src, dest);
			}
		}
		const sampleFile = cssFiles[0];
		const srcPath = join(ssrAssetsDir, sampleFile);
		const size = readFileSync(srcPath).length;
		const destName = `ssr-${sampleFile}`;
		console.log(`[ssr-css] Copied SSR CSS → /assets/${destName} (${size} bytes) to dist + .output/public`);

		// Patch Nitro's index.mjs asset manifest so it knows about the new file.
		// Nitro has a hardcoded map of public assets built at build time;
		// files added after the build get 404 without this patch.
		const nitroIndexPaths = [
			join(CWD, '.output', 'server', 'index.mjs'),
			join(CWD, '.netlify', 'functions-internal', 'server', 'server.mjs'),
		];
		for (const indexPath of nitroIndexPaths) {
			if (!existsSync(indexPath)) continue;
			let code = readFileSync(indexPath, 'utf-8');
			const assetKey = `/assets/${destName}`;
			if (code.includes(assetKey)) {
				console.log(`[ssr-css] Asset manifest already has ${assetKey}`);
				continue;
			}
			// Find an existing CSS asset entry to insert our new entry after
			const existingCssRe = /"\/assets\/[^"]+\.css":\{type:`text\/css[^}]+\}/;
			const match = existingCssRe.exec(code);
			if (match) {
				const mtime = new Date().toISOString();
				const etag = `"${size.toString(16)}-ssr"`;
				const newEntry = `,"${assetKey}":{type:\`text/css; charset=utf-8\`,etag:\`${etag}\`,mtime:\`${mtime}\`,size:${size},path:\`../public/assets/${destName}\`}`;
				code = code.replace(match[0], match[0] + newEntry);
				writeFileSync(indexPath, code);
				console.log(`[ssr-css] ✅ Patched asset manifest in ${indexPath}`);
			} else {
				console.warn(`[ssr-css] Could not find CSS entry in ${indexPath} to patch`);
			}
		}
		return;
	}
	console.log('[ssr-css] No SSR CSS files found');
}

// ─── Run ─────────────────────────────────────────────────────────────

// Copy SSR CSS (layout modules) to client assets BEFORE patching
copySSRCSSToClient();

// Patch all SSR bundles we can find
for (const ssrPath of [
	join(CWD, '.netlify', 'functions-internal', 'server', '_ssr', 'ssr.mjs'),
	join(CWD, '.netlify', 'v1', 'functions', 'server', '_ssr', 'ssr.mjs'),
	join(CWD, '.output', 'server', '_ssr', 'ssr.mjs'),
]) {
	if (existsSync(ssrPath)) {
		console.log(`[patch] Patching ${ssrPath}`);
		patchSSRBundleCSS(ssrPath);
	}
}

generateIslandRedirects();
copyAdapters();

// ─── Copy function to ALL Netlify function paths ─────────────────────
// Nitro v3 beta writes to .netlify/functions-internal/ (framework path).
// Netlify may not detect Nitro as a framework with our custom build,
// so also copy to:
//   - .netlify/v1/functions/  (Frameworks API v1)
//   - netlify/functions/      (standard user-facing path)

function copyToNetlifyPaths() {
	const legacyDir = join(CWD, '.netlify', 'functions-internal', 'server');

	if (!existsSync(legacyDir)) {
		console.log('[netlify-fn] No .netlify/functions-internal/server/ found, skipping');
		return;
	}

	const targets = [join(CWD, '.netlify', 'v1', 'functions', 'server'), join(CWD, 'netlify', 'functions', 'server')];

	for (const target of targets) {
		cpSync(legacyDir, target, { recursive: true, force: true });
		const rel = target.substring(CWD.length).replaceAll('\\', '/');
		console.log(`[netlify-fn] ✅ Copied server function to ${rel}/`);
	}
}

copyToNetlifyPaths();

// ─── Ensure Netlify _redirects has SSR catch-all ─────────────────────
// Nitro v3 beta's netlify preset generates an empty _redirects file.
// We need a catch-all rule so all non-static requests hit the SSR function.

function ensureNetlifyRedirects() {
	const redirectsPath = join(DIST_DIR, '_redirects');
	let content = existsSync(redirectsPath) ? readFileSync(redirectsPath, 'utf-8') : '';

	// Check if there's already a catch-all to the server function
	if (content.includes('/.netlify/functions/server')) {
		console.log('[redirects] SSR catch-all already present');
		return;
	}

	// Append the catch-all — must be LAST so static files are served first
	const catchAll = '\n# SSR catch-all (Nitro server function)\n/*  /.netlify/functions/server  200\n';
	content = content.trimEnd() + '\n' + catchAll;
	writeFileSync(redirectsPath, content);
	console.log('[redirects] ✅ Added SSR catch-all to _redirects');
}

ensureNetlifyRedirects();

console.log('[post-build] ✅ Complete');
