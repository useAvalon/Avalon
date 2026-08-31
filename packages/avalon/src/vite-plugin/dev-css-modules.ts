/**
 * Vite's default CSS-module hash includes file contents. After a save, the
 * Nitro page still exports the previous class names while `?direct` CSS uses
 * new hashes — the document looks unstyled. Dev hashes only the file path
 * and local name so a value edit keeps the same selectors.
 */

import { createHash } from "node:crypto";
import { basename } from "node:path";

export function stableDevScopedName(name: string, filename: string): string {
	const file = (filename.split("?")[0] ?? filename).replaceAll("\\", "/");
	const hash = createHash("sha1").update(`${file}\0${name}`).digest("hex").slice(0, 5);
	const base = basename(file)
		.replace(/\.module\.\w+$/, "")
		.replace(/[^\w-]/g, "_");
	const local = name.replace(/[^\w-]/g, "_");
	return `_${base}_${local}_${hash}`;
}

export function shouldSetDevScopedName(modules: unknown): boolean {
	if (modules === false) return false;
	if (modules && typeof modules === "object" && "generateScopedName" in modules) {
		return (modules as { generateScopedName?: unknown }).generateScopedName == null;
	}
	return true;
}
