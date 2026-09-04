/**
 * Cloudflare Pages worker post-build patches.
 *
 * Rolldown emits `createRequire(import.meta.url)` for CJS interop. On the
 * Workers runtime `import.meta.url` is undefined, so createRequire throws at
 * startup (same guard as nitrojs/nitro#4133). Nitro's emitted wrangler.json
 * may also lag behind the project's root compatibility date / flags.
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CREATE_REQUIRE_RE = /createRequire\(\s*import\.meta\.url\s*\)/g;
const CREATE_REQUIRE_SAFE = 'createRequire(import.meta.url || "file:///")';

function collectJsFiles(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			collectJsFiles(full, out);
			continue;
		}
		if (entry.isFile() && /\.(?:m?js)$/.test(entry.name)) out.push(full);
	}
	return out;
}

/** Rewrite createRequire(import.meta.url) so workerd can boot the worker. */
export function patchCloudflareCreateRequire(workerDir: string): number {
	let patched = 0;
	for (const file of collectJsFiles(workerDir)) {
		const before = readFileSync(file, "utf-8");
		if (!CREATE_REQUIRE_RE.test(before)) continue;
		CREATE_REQUIRE_RE.lastIndex = 0;
		const after = before.replaceAll(CREATE_REQUIRE_RE, CREATE_REQUIRE_SAFE);
		if (after === before) continue;
		writeFileSync(file, after);
		patched += 1;
	}
	return patched;
}

export interface CloudflareWranglerPatch {
	compatibilityDate: string;
	compatibilityFlags: string[];
}

/** Merge compatibility_date / flags into Nitro's emitted wrangler.json. */
export function patchCloudflareWranglerJson(
	workerDir: string,
	patch: CloudflareWranglerPatch,
): boolean {
	const path = join(workerDir, "wrangler.json");
	if (!existsSync(path) || !statSync(path).isFile()) return false;

	const config = JSON.parse(readFileSync(path, "utf-8")) as {
		compatibility_date?: string;
		compatibility_flags?: string[];
		[key: string]: unknown;
	};

	config.compatibility_date = patch.compatibilityDate;
	const flags = new Set(config.compatibility_flags ?? []);
	for (const flag of patch.compatibilityFlags) flags.add(flag);
	config.compatibility_flags = [...flags];

	writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
	return true;
}

/**
 * Apply Cloudflare worker fixes under `dist/_worker.js` (file or directory).
 * Returns false when no Cloudflare worker output is present.
 */
export function patchCloudflareWorkerOutput(
	cwd: string,
	wrangler: CloudflareWranglerPatch = {
		compatibilityDate: "2026-09-04",
		compatibilityFlags: ["nodejs_compat", "enable_nodejs_fs_module"],
	},
): boolean {
	const root = join(cwd, "dist", "_worker.js");
	if (!existsSync(root)) return false;

	const workerDir = statSync(root).isDirectory() ? root : null;
	if (!workerDir) return false;

	const requirePatched = patchCloudflareCreateRequire(workerDir);
	const wranglerPatched = patchCloudflareWranglerJson(workerDir, wrangler);

	if (requirePatched > 0) {
		console.log(
			`[cloudflare] Patched createRequire(import.meta.url) in ${requirePatched} worker file(s)`,
		);
	}
	if (wranglerPatched) {
		console.log(
			`[cloudflare] Synced wrangler.json compatibility_date=${wrangler.compatibilityDate}`,
		);
	}
	return requirePatched > 0 || wranglerPatched;
}
