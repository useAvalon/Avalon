import type { ProjectConfig } from '../types';

export function generateNetlifyToml(config: ProjectConfig): string {
	return `[build]
  base = "."
  command = "bun install && bun build.mjs"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"
  BUN_VERSION = "latest"
  NITRO_PRESET = "netlify"

[functions]
  directory = "netlify/functions"
`;
}

export function generateBuildMjs(): string {
	return `/**
 * Netlify build wrapper.
 *
 * Vite/Nitro leaves open handles after the build completes, preventing
 * the Node process from exiting. This wrapper detects when the build
 * output is ready, kills the entire process group, then runs post-build.
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const NITRO_JSON = join(CWD, '.netlify', 'functions-internal', 'nitro.json');
const SERVER_MJS = join(CWD, '.netlify', 'functions-internal', 'server', 'server.mjs');
const OUTPUT_SSR = join(CWD, '.output', 'server', '_ssr', 'ssr.mjs');

console.log('[build] Starting vite build...');

for (const dir of ['.netlify', '.output', 'netlify']) {
  const full = join(CWD, dir);
  if (existsSync(full)) {
    rmSync(full, { recursive: true, force: true });
    console.log(\`[build] Cleaned stale \${dir}/\`);
  }
}

const child = spawn('bunx', ['--bun', 'vite', 'build'], {
  cwd: CWD,
  stdio: 'inherit',
  detached: true,
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
  clearTimeout(absoluteTimeout);
  killTree();

  setTimeout(() => {
    console.log('[build] Running post-build...');
    try {
      execSync('node post-build.mjs', { cwd: CWD, stdio: 'inherit', timeout: 60_000 });
    } catch (err) {
      console.error('[build] post-build warning:', err.message);
    }

    const V1_SERVER = join(CWD, '.netlify', 'v1', 'functions', 'server', 'server.mjs');
    if (existsSync(V1_SERVER)) console.log('[build] ✅ Server function found (v1 API)');
    else if (existsSync(SERVER_MJS)) console.log('[build] ✅ Server function found (legacy)');
    else if (existsSync(OUTPUT_SSR)) console.log('[build] ✅ SSR bundle found');
    else console.error('[build] ❌ No server output found');

    console.log('[build] ✅ Complete');
    process.exit(0);
  }, 500);
}

child.on('exit', (code) => {
  console.log(\`[build] vite build exited with code \${code}\`);
  finish();
});

child.on('error', (err) => {
  console.error('[build] spawn error:', err);
  process.exit(1);
});

const poll = setInterval(() => {
  const netlifyReady = existsSync(NITRO_JSON) && existsSync(SERVER_MJS);
  const nodeServerReady = existsSync(OUTPUT_SSR);
  if (netlifyReady || nodeServerReady) {
    console.log(\`[build] Output detected (\${netlifyReady ? 'netlify' : 'node-server'}), waiting 3s for final writes...\`);
    clearInterval(poll);
    setTimeout(finish, 3_000);
  }
}, 1_000);

const absoluteTimeout = setTimeout(() => {
  console.error('[build] Timeout — killing build');
  finish();
}, 240_000);
`;
}
