/**
 * Netlify build wrapper.
 *
 * When NITRO_PRESET=netlify_edge, does a two-pass build:
 *   1. node_server build → post-build (prerenders to dist/) → clean server output
 *   2. netlify_edge build → produces .netlify/edge-functions/
 *
 * For other presets, does a single build + post-build.
 *
 * Vite/Nitro leaves open handles after the build completes, preventing
 * the Node process from exiting. This wrapper detects when the build
 * output is ready, kills the entire process group, then runs post-build.
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const PRESET = process.env.NITRO_PRESET || 'node_server';
const IS_EDGE = PRESET.includes('edge');

// Detection paths
const EDGE_SERVER = join(CWD, '.netlify', 'edge-functions', 'server', 'server.js');
const EDGE_MANIFEST = join(CWD, '.netlify', 'edge-functions', 'manifest.json');
const NETLIFY_MAIN = join(CWD, '.netlify', 'functions-internal', 'main.mjs');
const NETLIFY_SERVER = join(CWD, '.netlify', 'functions-internal', 'server', 'server.mjs');
const OUTPUT_SSR = join(CWD, '.output', 'server', '_ssr', 'ssr.mjs');

// Clean stale output dirs
for (const dir of ['.netlify', '.output', 'netlify']) {
	const full = join(CWD, dir);
	if (existsSync(full)) {
		rmSync(full, { recursive: true, force: true });
		console.log(`[build] Cleaned stale ${dir}/`);
	}
}

/**
 * Run a vite build with the given preset, wait for output, kill the process.
 * Returns a promise that resolves when the build output is detected.
 */
function runBuild(preset) {
	return new Promise((resolve, reject) => {
		console.log(`[build] Starting vite build (preset: ${preset})...`);

		const child = spawn('bunx', ['--bun', 'vite', 'build'], {
			cwd: CWD,
			stdio: 'inherit',
			detached: true,
			env: { ...process.env, NITRO_PRESET: preset },
		});

		const childPid = child.pid;
		let done = false;

		function killTree() {
			try { process.kill(-childPid, 'SIGKILL'); } catch {}
			try { child.kill('SIGKILL'); } catch {}
		}

		function finish() {
			if (done) return;
			done = true;
			clearInterval(poll);
			clearTimeout(timeout);
			killTree();
			setTimeout(resolve, 500);
		}

		child.on('exit', () => finish());
		child.on('error', reject);

		const poll = setInterval(() => {
			const edgeReady = existsSync(EDGE_SERVER) && existsSync(EDGE_MANIFEST);
			const netlifyReady = existsSync(NETLIFY_MAIN) && existsSync(NETLIFY_SERVER);
			const nodeServerReady = existsSync(OUTPUT_SSR);
			if (edgeReady || netlifyReady || nodeServerReady) {
				const kind = edgeReady ? 'netlify-edge' : netlifyReady ? 'netlify' : 'node-server';
				console.log(`[build] Output detected (${kind}), waiting 3s...`);
				clearInterval(poll);
				setTimeout(finish, 3_000);
			}
		}, 1_000);

		const timeout = setTimeout(() => {
			console.error('[build] Timeout — killing build');
			finish();
		}, 240_000);
	});
}

function runPostBuild() {
	console.log('[build] Running post-build...');
	try {
		execSync('node post-build.mjs', { cwd: CWD, stdio: 'inherit', timeout: 120_000 });
	} catch (err) {
		console.error('[build] post-build warning:', err.message);
	}
}

function verify() {
	if (existsSync(EDGE_SERVER) && existsSync(EDGE_MANIFEST))
		console.log('[build] ✅ Edge function found');
	else if (existsSync(NETLIFY_SERVER))
		console.log('[build] ✅ Server function found (netlify v2)');
	else if (existsSync(NETLIFY_MAIN))
		console.log('[build] ✅ Netlify main.mjs found');
	else if (existsSync(OUTPUT_SSR))
		console.log('[build] ✅ SSR bundle found');
	else
		console.error('[build] ❌ No server output found');
}

async function main() {
	if (IS_EDGE) {
		// Pass 1: node_server build for prerendering
		await runBuild('node_server');
		runPostBuild();

		// Save prerendered HTML before pass 2 wipes dist/
		const tmpPrerender = join(CWD, '.prerendered');
		if (existsSync(tmpPrerender)) rmSync(tmpPrerender, { recursive: true, force: true });
		const { cpSync, readdirSync, statSync } = await import('node:fs');
		const distDir = join(CWD, 'dist');

		// Copy all HTML files and directories containing HTML from dist/
		if (existsSync(distDir)) {
			const entries = readdirSync(distDir);
			for (const entry of entries) {
				const src = join(distDir, entry);
				const st = statSync(src);
				// Copy directories (blog/, docs/, demo/, etc.) and HTML files
				if (st.isDirectory() && !['assets', 'islands', 'frameworks', 'chunks'].includes(entry)) {
					cpSync(src, join(tmpPrerender, entry), { recursive: true });
				} else if (entry.endsWith('.html')) {
					cpSync(src, join(tmpPrerender, entry));
				}
			}
			console.log('[build] Saved prerendered HTML to .prerendered/');
		}

		// Clean node_server output
		const outputDir = join(CWD, '.output');
		if (existsSync(outputDir)) {
			rmSync(outputDir, { recursive: true, force: true });
			console.log('[build] Cleaned .output/');
		}

		// Pass 2: edge build for the actual deployment function
		await runBuild(PRESET);

		// Restore prerendered HTML into dist/
		if (existsSync(tmpPrerender)) {
			cpSync(tmpPrerender, distDir, { recursive: true, force: true });
			rmSync(tmpPrerender, { recursive: true, force: true });
			console.log('[build] Restored prerendered HTML to dist/');
		}

		// Patch the edge bundle CSS (post-build already handled dist/)
		console.log('[build] Patching edge bundle...');
		try {
			const { runPostBuild: runPB } = await import('@useavalon/avalon/post-build');
			await runPB({ prerender: false });
		} catch {
			runPostBuild();
		}
	} else {
		// Single build for non-edge presets
		await runBuild(PRESET);
		runPostBuild();
	}

	verify();
	console.log('[build] ✅ Complete');
	process.exit(0);
}

main().catch(err => {
	console.error('[build] Fatal error:', err);
	process.exit(1);
});
