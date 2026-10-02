import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { collectFiles, isFile } from "./fs-utils.ts";

type CssManifestFormat = {
	inner: string;
	fullMatch: string;
	hrefRe: RegExp;
	formatEntry: (href: string) => string;
	rebuild: (inner: string, entries: string[]) => string;
};

function findBracketedSlice(code: string, openIdx: number): { inner: string; end: number } | null {
	let depth = 0;
	for (let i = openIdx; i < code.length; i++) {
		const ch = code[i];
		if (ch === "[") depth++;
		else if (ch === "]") {
			depth--;
			if (depth === 0) {
				return { inner: code.slice(openIdx + 1, i), end: i + 1 };
			}
		}
	}
	return null;
}

function detectCssManifestFormat(code: string): CssManifestFormat | null {
	const jsonStart = /"css"\s*:\s*\[/.exec(code);
	if (jsonStart) {
		const openBracket = jsonStart.index + jsonStart[0].length - 1;
		const slice = findBracketedSlice(code, openBracket);
		if (!slice) return null;
		return {
			inner: slice.inner,
			fullMatch: code.slice(jsonStart.index, slice.end),
			hrefRe: /"href"\s*:\s*"([^"]+)"/g,
			formatEntry: (href) => `{ "href": "${href}" }`,
			rebuild: (inner, entries) => {
				const base = inner.trim().replace(/,\s*$/, "");
				const joined = [...(base ? [base] : []), ...entries].join(", ");
				return `"css": [${joined}]`;
			},
		};
	}

	const backtickStart = /css:\[/.exec(code);
	if (backtickStart) {
		const openBracket = backtickStart.index + backtickStart[0].length - 1;
		const slice = findBracketedSlice(code, openBracket);
		if (!slice) return null;
		if (slice.inner.includes("href:`")) {
			return {
				inner: slice.inner,
				fullMatch: code.slice(backtickStart.index, slice.end),
				hrefRe: /href:`([^`]+)`/g,
				formatEntry: (href) => `{href:\`${href}\`}`,
				rebuild: (inner, entries) => `css:[${inner},${entries.join(",")}]`,
			};
		}
		if (slice.inner.includes('href:"')) {
			return {
				inner: slice.inner,
				fullMatch: code.slice(backtickStart.index, slice.end),
				hrefRe: /href:"([^"]+)"/g,
				formatEntry: (href) => `{href:"${href}"}`,
				rebuild: (inner, entries) => `css:[${inner},${entries.join(",")}]`,
			};
		}
	}

	return null;
}

function collectGlobalCssPaths(foundAssetsDir: string): string[] {
	const allCssPaths = collectFiles(foundAssetsDir, (n) => n.endsWith(".css"))
		.filter((f) => {
			const name = (f.split("/").pop() || "").toLowerCase();
			if (name.includes("_isolated-island-entry")) return false;
			if (name.startsWith("entry-client")) return true;
			if (name.startsWith("index-")) return true;
			return false;
		})
		.map((f) => {
			const rel = f.substring(foundAssetsDir.length).replaceAll("\\", "/");
			return `/assets${rel}`;
		});

	if (!allCssPaths.some((p) => /\/index-[^/]+\.css$/.test(p))) {
		const ssrPaths = collectFiles(foundAssetsDir, (n) => n.endsWith(".css"))
			.filter((f) => (f.split("/").pop() || "").toLowerCase().startsWith("ssr-index"))
			.map((f) => `/assets${f.substring(foundAssetsDir.length).replaceAll("\\", "/")}`);
		allCssPaths.push(...ssrPaths);
	}

	return allCssPaths;
}

/**
 * Ensure the SSR client-assets `css` array lists global stylesheets (`index-*.css`
 * / `entry-client-*.css`). Prerender strips `entry-client` CSS for per-island
 * hydration, so without `index-*.css` in this array pages ship with no styles.
 */
export function patchSSRBundleCSS(ssrBundlePath: string, distDir: string, cwd: string): boolean {
	if (!isFile(ssrBundlePath)) return false;

	const assetsDirs = [
		join(distDir, "assets"),
		join(cwd, ".netlify", "functions-internal", "server", "public", "assets"),
		join(cwd, ".output", "public", "assets"),
	];
	const foundAssetsDir = assetsDirs.find((d) => existsSync(d));
	if (!foundAssetsDir) return false;

	const allCssPaths = collectGlobalCssPaths(foundAssetsDir);
	console.log(`[patch] Found ${allCssPaths.length} CSS files in ${foundAssetsDir}`);

	let code = readFileSync(ssrBundlePath, "utf-8");
	const format = detectCssManifestFormat(code);
	if (!format) {
		console.warn("[patch] Could not find CSS array in SSR bundle");
		return false;
	}

	const existingSet = new Set([...format.inner.matchAll(format.hrefRe)].map((m) => m[1]));
	const newPaths = allCssPaths.filter((p) => !existingSet.has(p));
	if (newPaths.length === 0) {
		console.log("[patch] All CSS already included");
		return true;
	}

	const newEntries = newPaths.map(format.formatEntry);
	code = code.replace(format.fullMatch, format.rebuild(format.inner, newEntries));
	writeFileSync(ssrBundlePath, code);
	console.log(`[patch] ✅ Added ${newPaths.length} CSS files to SSR bundle`);
	return true;
}
