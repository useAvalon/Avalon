/**
 * Restores package.json from the backup created by the build script.
 * This runs after `bun publish` to revert exports back to source .ts paths
 * for workspace development.
 */

import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const bakPath = join(ROOT, 'package.json.bak');
const pkgPath = join(ROOT, 'package.json');

try {
	const original = await readFile(bakPath, 'utf-8');
	await writeFile(pkgPath, original, 'utf-8');
	await rm(bakPath);
	console.log('✓ Restored package.json from backup');
} catch (err) {
	console.error('Failed to restore package.json:', err);
	process.exit(1);
}
