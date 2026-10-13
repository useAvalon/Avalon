import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { SeoConfig } from "./config.ts";
import { SEO_ERROR_PAGE_PATH } from "./constants.ts";
import { transformSeoHtml } from "./transform.ts";

function walkHtmlFiles(dir: string, files: string[] = []): string[] {
	if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return files;
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		const stat = statSync(path);
		if (stat.isDirectory()) walkHtmlFiles(path, files);
		else if (name.endsWith(".html")) files.push(path);
	}
	return files;
}

/**
 * Map a prerendered file path under `dist/` to a URL pathname.
 * Returns {@link SEO_ERROR_PAGE_PATH} for `404.html` (skip canonical / breadcrumbs).
 */
export function htmlFileToPathname(distDir: string, filePath: string): string {
	const rel = relative(distDir, filePath).replaceAll("\\", "/");
	if (rel === "404.html" || rel.endsWith("/404.html")) return SEO_ERROR_PAGE_PATH;
	if (rel === "index.html") return "/";
	if (rel.endsWith("/index.html")) {
		const base = rel.slice(0, -"/index.html".length);
		return base ? `/${base}/` : "/";
	}
	const withoutExt = rel.replace(/\.html$/i, "");
	return `/${withoutExt}/`;
}

/** Apply SEO transforms to every HTML file under a build output directory. */
export function applySeoToDist(distDir: string, config: SeoConfig): number {
	let count = 0;
	for (const file of walkHtmlFiles(distDir)) {
		const pathname = htmlFileToPathname(distDir, file);
		const original = readFileSync(file, "utf-8");
		const next = transformSeoHtml(original, pathname, config);
		if (next !== original) {
			writeFileSync(file, next, "utf-8");
			count++;
		}
	}
	return count;
}
