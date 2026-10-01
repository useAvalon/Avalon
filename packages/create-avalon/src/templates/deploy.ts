import type { ProjectConfig } from "../types";

/** Cloudflare Pages project names: lowercase letters, digits, hyphens. */
export function cloudflareProjectName(projectName: string): string {
	const slug = projectName
		.toLowerCase()
		.replaceAll(/[^a-z0-9-]+/g, "-")
		.replaceAll(/-+/g, "-")
		.replaceAll(/^-|-$/g, "");
	return slug || "avalon-app";
}

export function generateNetlifyToml(_config: ProjectConfig): string {
	return `[build]
  base = "."
  command = "bun install && bun build.mjs"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"
  BUN_VERSION = "latest"
  NITRO_PRESET = "netlify"

[functions]
  directory = ".netlify/functions-internal"
  node_bundler = "none"

# SSR catch-all — Netlify checks for a matching static/prerendered file
# first (force=false is the default in netlify.toml). Only requests with
# no static file hit the server function.
[[redirects]]
  from = "/*"
  to = "/.netlify/functions/server"
  status = 200
`;
}

/**
 * Cloudflare Pages wrangler config.
 * compatibility_date must be >= 2025-09-15 so nodejs_compat includes `node:fs`.
 */
export function generateWranglerToml(config: ProjectConfig): string {
	const name = cloudflareProjectName(config.projectName);
	return `# Cloudflare Pages — production output is dist/_worker.js + static assets.
# Date must be >= 2025-09-15 so nodejs_compat includes \`node:fs\` (needed by the Nitro worker).
name = "${name}"
compatibility_date = "2026-09-04"
compatibility_flags = ["nodejs_compat", "enable_nodejs_fs_module"]
pages_build_output_dir = "./dist"
`;
}

/** Static cache headers copied into dist/ for Cloudflare Pages ASSETS. */
export function generateCloudflareHeaders(): string {
	return `# Cloudflare Pages static headers (Worker routeRules still apply to SSR).
/*.html
  Cache-Control: public, max-age=3600, s-maxage=31536000

/
  Cache-Control: public, max-age=3600, s-maxage=31536000

/islands/*
  Cache-Control: public, max-age=0, must-revalidate
`;
}

/**
 * Short deploy guide written next to the platform config files.
 * Keep factual — mirrors what Avalon's post-build expects.
 */
export function generateDeployReadme(config: ProjectConfig): string {
	if (config.deploy === "cloudflare") {
		const name = cloudflareProjectName(config.projectName);
		return `# Deploying to Cloudflare Pages

This project is set up for \`NITRO_PRESET=cloudflare_pages\`.

## Build

\`\`\`bash
bun run build
\`\`\`

\`build.mjs\` detects \`wrangler.toml\` and sets the Nitro preset when \`NITRO_PRESET\` is unset.
Avalon's post-build patches the Cloudflare worker (DOM stub, CSS manifest, \`_routes.json\`).

## Preview locally

\`\`\`bash
bun run preview
\`\`\`

## Deploy

1. Create an API token with **Account → Cloudflare Pages → Edit** and **Account Settings → Read**.
2. Set \`CLOUDFLARE_API_TOKEN\` and \`CLOUDFLARE_ACCOUNT_ID\` in your environment (or CI secrets).
3. Create the Pages project once (Wrangler 4 does not auto-create):

\`\`\`bash
bunx wrangler@4 pages project create ${name} \\
  --production-branch=main \\
  --compatibility-flags=nodejs_compat \\
  --compatibility-date=2026-09-04
\`\`\`

4. Deploy:

\`\`\`bash
bun run deploy
\`\`\`

Prefer **one** deployer (e.g. GitHub Actions with Wrangler). If you also connect the
GitHub repo in the Cloudflare dashboard, disable Cloudflare's own build to avoid
double deploys.

Do not rely on Cloudflare's Git integration to run \`vite build\` without Avalon's
\`post-build.mjs\` — prerendered CSS and worker patches will be missing.
`;
	}

	if (config.deploy === "netlify") {
		return `# Deploying to Netlify

This project is set up for \`NITRO_PRESET=netlify\` via \`netlify.toml\`.

## Build

\`\`\`bash
bun run build
\`\`\`

Or connect the repo in Netlify — \`netlify.toml\` runs \`bun install && bun build.mjs\`
and publishes \`dist/\`. Avalon's post-build copies the server function and prerenders routes.

## Preview locally

\`\`\`bash
bun run preview
\`\`\`

## Notes

- Functions live under \`.netlify/functions-internal\` (\`node_bundler = "none"\`).
- The \`/*\` → \`/.netlify/functions/server\` redirect is a soft SSR fallback: static
  prerendered HTML in \`dist/\` is served first when present.
`;
	}

	return `# Deploy

No platform config was generated. Build with:

\`\`\`bash
bun run build
\`\`\`

Default Nitro preset is \`node_server\` (\`.output/server\`). Set \`NITRO_PRESET\` for
other targets (\`netlify\`, \`cloudflare_pages\`, \`vercel\`, …) and add the matching
platform config — or re-run \`create-avalon\` with a deploy target.
`;
}

export function generateBuildMjs(): string {
	return `/**
 * Build wrapper.
 *
 * Vite/Nitro leaves open handles after the build completes, preventing
 * the Node process from exiting. This wrapper detects when the build
 * output is ready, kills the entire process group, then runs post-build.
 *
 * When NITRO_PRESET is unset, defaults from wrangler.toml / netlify.toml
 * so local \`bun run build\` matches the chosen create-avalon deploy target.
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CWD = process.cwd();
const NITRO_JSON = join(CWD, '.netlify', 'functions-internal', 'nitro.json');
const SERVER_MJS = join(CWD, '.netlify', 'functions-internal', 'server', 'server.mjs');
const OUTPUT_SSR = join(CWD, '.output', 'server', '_ssr', 'ssr.mjs');
const CF_WORKER = join(CWD, 'dist', '_worker.js');

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

console.log('[build] Starting vite build...');
if (process.env.NITRO_PRESET) {
  console.log(\`[build] NITRO_PRESET=\${process.env.NITRO_PRESET}\`);
}

for (const dir of ['.netlify', '.output', 'netlify', 'dist']) {
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
  env: process.env,
});

const childPid = child.pid;
let done = false;
let killedEarly = false;
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

  if (killedEarly) killTree();

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
    const ok =
      cloudflareReady ||
      existsSync(V1_SERVER) ||
      existsSync(SERVER_MJS) ||
      existsSync(OUTPUT_SSR);
    if (cloudflareReady) console.log('[build] ✅ Cloudflare worker found (dist/_worker.js)');
    else if (existsSync(V1_SERVER)) console.log('[build] ✅ Server function found (v1 API)');
    else if (existsSync(SERVER_MJS)) console.log('[build] ✅ Server function found (legacy)');
    else if (existsSync(OUTPUT_SSR)) console.log('[build] ✅ SSR bundle found');
    else console.error('[build] ❌ No server output found');

    if (!ok) process.exit(1);
    console.log('[build] ✅ Complete');
    process.exit(killedEarly || viteExitCode === 0 ? 0 : viteExitCode);
  }, 500);
}

child.on('exit', (code) => {
  console.log(\`[build] vite build exited with code \${code}\`);
  viteExitCode = code ?? (killedEarly ? 0 : 1);
  finish();
});

child.on('error', (err) => {
  console.error('[build] spawn error:', err);
  process.exit(1);
});

const poll = setInterval(() => {
  // Cloudflare \`_worker.js\` appears during the client build; killing then
  // aborts SSR. Only force-stop the Netlify/Node hang.
  const netlifyReady = existsSync(NITRO_JSON) && existsSync(SERVER_MJS);
  const nodeServerReady = existsSync(OUTPUT_SSR);
  if (netlifyReady || nodeServerReady) {
    killedEarly = true;
    const kind = netlifyReady ? 'netlify' : 'node-server';
    console.log(\`[build] Output detected (\${kind}), waiting 3s for final writes...\`);
    clearInterval(poll);
    setTimeout(finish, 3_000);
  }
}, 1_000);

const absoluteTimeout = setTimeout(() => {
  console.error('[build] Timeout — killing build');
  killedEarly = true;
  finish();
}, 240_000);
`;
}

export function generateRobotsTxt(sitemapUrl = "https://YOUR_DOMAIN/sitemap.xml"): string {
	return `# robots.txt

User-agent: *
Allow: /

# Sitemap
Sitemap: ${sitemapUrl}

# AI Crawlers — explicitly allowed
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Bytespider
Allow: /

User-agent: cohere-ai
Allow: /

User-agent: Diffbot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: CCBot
Allow: /

User-agent: AI2Bot
Allow: /
`;
}

/** Minimal .gitignore so Cloudflare/Netlify build dirs stay out of git. */
export function generateGitignore(_config: ProjectConfig): string {
	return [
		"node_modules/",
		"dist/",
		".output/",
		".tsbuild/",
		".netlify/",
		".wrangler/",
		"*.log",
		".DS_Store",
		".env",
		".env.*",
		"!.env.example",
		"",
	].join("\n");
}
