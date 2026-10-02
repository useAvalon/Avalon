import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export function collectFiles(
	dir: string,
	predicate: (name: string) => boolean,
	result: string[] = [],
): string[] {
	if (!existsSync(dir)) return result;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			collectFiles(full, predicate, result);
		} else if (predicate(entry.name)) {
			result.push(full);
		}
	}
	return result;
}

export function isFile(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}
