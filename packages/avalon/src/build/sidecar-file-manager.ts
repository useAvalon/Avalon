import path from "node:path";
import { readFile, writeFile, unlink, stat } from "node:fs/promises";

/**
 * Supported compound extensions for island files, ordered longest-first
 * so that `.solid.tsx` matches before `.tsx`.
 */
const COMPOUND_EXTENSIONS = [".solid.tsx", ".lit.ts", ".svelte", ".vue"];

/**
 * Compute the sidecar declaration file path for a given island file path.
 *
 * For simple extensions like `.vue`, the sidecar is `Name.d.vue.ts`.
 * For compound extensions like `.lit.ts`, the sidecar is `Name.d.lit.ts`.
 * For `.solid.tsx`, the sidecar is `Name.d.solid.tsx.ts`.
 */
export function getSidecarPath(islandFilePath: string): string {
	const dir = path.dirname(islandFilePath);
	const basename = path.basename(islandFilePath);

	for (const ext of COMPOUND_EXTENSIONS) {
		if (basename.endsWith(ext)) {
			const name = basename.slice(0, -ext.length);
			// For .lit.ts the sidecar IS .d.lit.ts (replaces .lit.ts)
			// For .vue/.svelte we append .ts: .d.vue.ts, .d.svelte.ts
			// For .solid.tsx we append .ts: .d.solid.tsx.ts
			const sidecarSuffix = ext.endsWith(".ts")
				? `.d${ext}`
				: `.d${ext}.ts`;
			return path.join(dir, `${name}${sidecarSuffix}`);
		}
	}

	// Fallback for unknown extensions — shouldn't happen with supported islands
	const ext = path.extname(islandFilePath);
	const name = basename.slice(0, -ext.length);
	return path.join(dir, `${name}.d${ext}.ts`);
}

/**
 * Check if a sidecar file is up-to-date by comparing mtimes.
 * Returns `true` if the sidecar exists and is newer than the source file.
 */
export async function isSidecarFresh(sourcePath: string, sidecarPath: string): Promise<boolean> {
	try {
		const [sourceStat, sidecarStat] = await Promise.all([
			stat(sourcePath),
			stat(sidecarPath),
		]);
		return sidecarStat.mtimeMs >= sourceStat.mtimeMs;
	} catch {
		return false;
	}
}

/**
 * Write sidecar content only if it differs from the existing file.
 * Returns `true` if a write was performed, `false` if content was already up-to-date.
 */
export async function writeSidecarIfChanged(sidecarPath: string, content: string): Promise<boolean> {
	try {
		const existing = await readFile(sidecarPath, "utf-8");
		if (existing === content) {
			return false;
		}
	} catch {
		// File doesn't exist yet — that's fine, we'll write it
	}

	await writeFile(sidecarPath, content, "utf-8");
	return true;
}

/**
 * Delete a sidecar file if it exists.
 * Returns `true` if a file was deleted, `false` if it didn't exist.
 */
export async function deleteSidecar(sidecarPath: string): Promise<boolean> {
	try {
		await unlink(sidecarPath);
		return true;
	} catch {
		return false;
	}
}

