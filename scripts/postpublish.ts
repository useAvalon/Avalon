/**
 * Shared postpublish script — restores package.json from backup,
 * but preserves the current (bumped) version number.
 * Run from any package dir: bun run ../../scripts/postpublish.ts
 */

import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const bakPath = join(ROOT, "package.json.bak");
const pkgPath = join(ROOT, "package.json");

try {
	// Read the current (published) package.json to get the version
	const current = JSON.parse(await readFile(pkgPath, "utf-8"));
	const version = current.version;

	// Restore the backup (source exports)
	const original = JSON.parse(await readFile(bakPath, "utf-8"));

	// Preserve the bumped version
	original.version = version;

	await writeFile(pkgPath, JSON.stringify(original, null, "\t") + "\n", "utf-8");
	await rm(bakPath);
	console.log(`✓ Restored package.json from backup (version: ${version})`);
} catch (err) {
	console.error("Failed to restore package.json:", err);
	process.exit(1);
}
