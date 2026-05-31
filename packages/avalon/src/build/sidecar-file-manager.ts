import { readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Supported compound extensions for island files, ordered longest-first
 * so that `.solid.tsx` matches before `.tsx`.
 *
 * Sidecar naming strategy per extension type:
 * - `.vue`, `.svelte`  → `Name.d.vue.ts`, `Name.d.svelte.ts`
 *   (foreign extensions — allowArbitraryExtensions picks these up)
 * - `.lit.ts`          → `Name.lit.d.ts`
 *   (TypeScript declaration file lookup: for `Name.lit.ts` TS looks for `Name.lit.d.ts`)
 * - `.solid.tsx`       → `Name.solid.d.ts`
 *   (TypeScript declaration file lookup: for `Name.solid.tsx` TS looks for `Name.solid.d.ts`)
 * - `.qwik.tsx`        → `Name.qwik.d.ts`
 *   (same as solid.tsx)
 */
const COMPOUND_EXTENSIONS = [".solid.tsx", ".qwik.tsx", ".lit.ts", ".svelte", ".vue"];

/**
 * Extensions where TypeScript's native `.d.ts` declaration lookup applies.
 * For `Name.lit.ts`, TS looks for `Name.lit.d.ts`.
 * For `Name.solid.tsx` / `Name.qwik.tsx`, TS looks for `Name.solid.d.ts` / `Name.qwik.d.ts`.
 */
const NATIVE_DECL_EXTENSIONS = new Set([".lit.ts", ".solid.tsx", ".qwik.tsx"]);

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
			if (NATIVE_DECL_EXTENSIONS.has(ext)) {
				// For .lit.ts → Name.lit.d.ts  (TS declaration file lookup)
				// For .solid.tsx / .qwik.tsx → Name.solid.d.ts / Name.qwik.d.ts
				const innerExt = ext.endsWith(".ts") ? ext.slice(0, -3) : ext.slice(0, -4); // strip .ts or .tsx
				return path.join(dir, `${name}${innerExt}.d.ts`);
			}
			// For .vue/.svelte → Name.d.vue.ts / Name.d.svelte.ts (allowArbitraryExtensions)
			return path.join(dir, `${name}.d${ext}.ts`);
		}
	}

	// Fallback
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
		const [sourceStat, sidecarStat] = await Promise.all([stat(sourcePath), stat(sidecarPath)]);
		return sidecarStat.mtimeMs >= sourceStat.mtimeMs;
	} catch {
		return false;
	}
}

/**
 * Write sidecar content only if it differs from the existing file.
 * Returns `true` if a write was performed, `false` if content was already up-to-date.
 */
export async function writeSidecarIfChanged(
	sidecarPath: string,
	content: string,
): Promise<boolean> {
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
