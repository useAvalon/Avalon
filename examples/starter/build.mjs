/**
 * Build wrapper.
 *
 * Vite/Nitro leaves open handles after the build completes, preventing
 * the Node process from exiting. This wrapper detects when the build
 * output is ready, kills the entire process group, then runs post-build.
 *
 * When NITRO_PRESET is unset, defaults from wrangler.toml / netlify.toml
 * so local `bun run build` matches the chosen create-avalon deploy target.
 */

import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

const CWD = process.cwd();
const NITRO_JSON = join(CWD, '.netlify', 'functions-internal', 'nitro.json');
const SERVER_MJS = join(CWD, '.netlify', 'functions-internal', 'server', 'server.mjs');
const OUTPUT_SSR = join(CWD, '.output', 'server', '_ssr', 'ssr.mjs');
const OUTPUT_NITRO_JSON = join(CWD, '.output', 'nitro.json');
const OUTPUT_SERVER_ENTRY = join(CWD, '.output', 'server', 'index.mjs');
const CF_WORKER = join(CWD, 'dist', '_worker.js');
// Nitro writes nitro.json last, so it marks a finished build.
const CF_PAGES_NITRO_JSON = join(CWD, 'dist', 'nitro.json');

if (!process.env.NITRO_PRESET) {
  if (existsSync(join(CWD, 'wrangler.toml'))) {
    process.env.NITRO_PRESET = 'cloudflare_pages';
  } else if (existsSync(join(CWD, 'netlify.toml'))) {
    process.env.NITRO_PRESET = 'netlify';
  }
}

/** True when Nitro finished a Cloudflare worker file, not an empty client-build directory. */
function isCloudflareWorkerReady() {
  try {
    const st = statSync(CF_WORKER);
    if (st.isFile()) return true;
    if (st.isDirectory()) {
      return existsSync(join(CF_WORKER, 'index.js')) || existsSync(join(CF_WORKER, 'index.mjs'));
    }
  } catch {
    return false;
  }
  return false;
}

/** Nitro preset in underscore form; Nitro itself writes `cloudflare-module`. */
function normalizePreset(preset) {
  return typeof preset === 'string' ? preset.trim().toLowerCase().replaceAll('-', '_') : '';
}

/** Preset Nitro recorded in .output/nitro.json, once the build has written it. */
function outputPreset() {
  try {
    return normalizePreset(JSON.parse(readFileSync(OUTPUT_NITRO_JSON, 'utf-8')).preset);
  } catch {
    return '';
  }
}

/** Cloudflare Workers (module) output: .output/server/index.mjs + nitro.json. */
function isCloudflareModuleReady() {
  const preset = outputPreset();
  return (
    preset.startsWith('cloudflare') &&
    preset !== 'cloudflare_pages' &&
    existsSync(OUTPUT_SERVER_ENTRY)
  );
}

/** Which finished output is on disk, or null while the build is still running. */
function detectReadyOutput() {
  if (existsSync(CF_PAGES_NITRO_JSON) && isCloudflareWorkerReady()) return 'cloudflare-pages';
  if (isCloudflareModuleReady()) return 'cloudflare-module';
  if (existsSync(NITRO_JSON) && existsSync(SERVER_MJS)) return 'netlify';
  // .output/server/_ssr/ssr.mjs is written before a build finishes, for
  // Cloudflare presets too (which vite.config can select without NITRO_PRESET).
  // Count it as Node output only once nitro.json names a non-Cloudflare preset.
  const preset = outputPreset();
  if (preset && !preset.startsWith('cloudflare') && existsSync(OUTPUT_SSR)) return 'node-server';
  return null;
}

console.log('[build] Starting vite build...');
if (process.env.NITRO_PRESET) {
  console.log(`[build] NITRO_PRESET=${process.env.NITRO_PRESET}`);
}

for (const dir of ['.netlify', '.output', 'netlify', 'dist']) {
  const full = join(CWD, dir);
  if (existsSync(full)) {
    rmSync(full, { recursive: true, force: true });
    console.log(`[build] Cleaned stale ${dir}/`);
  }
}

const viteCli = join(dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
const child = spawn(process.execPath, [viteCli, 'build'], {
  cwd: CWD,
  stdio: 'inherit',
  detached: true,
  env: process.env,
});

const childPid = child.pid;
let done = false;
// Set only when the wrapper kills Vite (open handles after a finished build, or
// the timeout). A natural exit keeps Vite's own exit code.
let killedByWrapper = false;
let viteExited = false;
let viteExitCode = 0;

function killTree() {
  try { process.kill(-childPid, 'SIGKILL'); } catch {}
  try { child.kill('SIGKILL'); } catch {}
}

function finish() {
  if (done) return;
  done = true;
  clearInterval(poll);
  clearTimeout(absoluteTimeout);

  if (!viteExited) killedByWrapper = true;
  killTree();

  setTimeout(() => {
    console.log('[build] Running post-build...');
    try {
      execSync('node post-build.mjs', { cwd: CWD, stdio: 'inherit', timeout: 120_000, env: process.env });
    } catch (err) {
      console.error('[build] post-build failed:', err.message);
      process.exit(1);
    }

    const V1_SERVER = join(CWD, '.netlify', 'v1', 'functions', 'server', 'server.mjs');
    const cloudflareReady = isCloudflareWorkerReady();
    const cloudflareModuleReady = isCloudflareModuleReady();
    const ok =
      cloudflareReady ||
      cloudflareModuleReady ||
      existsSync(V1_SERVER) ||
      existsSync(SERVER_MJS) ||
      existsSync(OUTPUT_SSR);
    if (cloudflareReady) console.log('[build] ✅ Cloudflare worker found (dist/_worker.js)');
    else if (cloudflareModuleReady) console.log('[build] ✅ Cloudflare worker found (.output/server/index.mjs)');
    else if (existsSync(V1_SERVER)) console.log('[build] ✅ Server function found (v1 API)');
    else if (existsSync(SERVER_MJS)) console.log('[build] ✅ Server function found (legacy)');
    else if (existsSync(OUTPUT_SSR)) console.log('[build] ✅ SSR bundle found');
    else console.error('[build] ❌ No server output found');

    if (!ok) process.exit(1);
    console.log('[build] ✅ Complete');
    process.exit(killedByWrapper || viteExitCode === 0 ? 0 : viteExitCode);
  }, 500);
}

child.on('exit', (code) => {
  console.log(`[build] vite build exited with code ${code}`);
  viteExited = true;
  viteExitCode = code ?? (killedByWrapper ? 0 : 1);
  finish();
});

child.on('error', (err) => {
  console.error('[build] spawn error:', err);
  process.exit(1);
});

const poll = setInterval(() => {
  // Cloudflare `dist/_worker.js` appears during the client build, so a Pages
  // build counts as done only once Nitro has written dist/nitro.json.
  const kind = detectReadyOutput();
  if (kind) {
    console.log(`[build] Output detected (${kind}), waiting 3s for final writes...`);
    clearInterval(poll);
    setTimeout(finish, 3_000);
  }
}, 1_000);

const absoluteTimeout = setTimeout(() => {
  console.error('[build] Timeout — killing build');
  finish();
}, 240_000);
