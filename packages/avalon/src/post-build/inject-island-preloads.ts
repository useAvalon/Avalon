import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	formatModulepreloadLink,
	type ModulePreloadFetchPriority,
	mergeModulePreloadWithDefaultRank,
} from "../islands/modulepreload-collector.ts";
import { collectFiles } from "./fs-utils.ts";

function normalizeImportPath(relPath: string, importPath: string): string {
	if (!importPath.startsWith(".")) return importPath;
	const resolved = `/${join(dirname(relPath.slice(1)), importPath)
		.replaceAll("\\", "/")
		.replace(/^\/+/, "")}`;
	const parts = resolved.split("/").filter(Boolean);
	const normalized: string[] = [];
	for (const part of parts) {
		if (part === "..") normalized.pop();
		else if (part !== ".") normalized.push(part);
	}
	return `/${normalized.join("/")}`;
}

function collectDepsFromIslandCode(relPath: string, code: string): string[] {
	const importRegex = /\bfrom\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g;
	const deps: string[] = [];
	for (let m = importRegex.exec(code); m !== null; m = importRegex.exec(code)) {
		const importPath = m[1] || m[2];
		if (!importPath) continue;
		if (!importPath.includes("/assets/") && !importPath.startsWith(".")) continue;
		deps.push(normalizeImportPath(relPath, importPath));
	}
	return deps;
}

function buildDepsManifestFromOutput(cwd: string): Record<string, string[]> {
	const outputDir = join(cwd, ".output", "public");
	const depsManifest: Record<string, string[]> = {};
	const islandFiles = collectFiles(
		join(outputDir, "islands"),
		(n) => n.endsWith(".js") && !n.endsWith(".js.map"),
	);
	for (const islandFile of islandFiles) {
		const relPath = `/${islandFile.substring(outputDir.length + 1).replaceAll("\\", "/")}`;
		const code = readFileSync(islandFile, "utf-8");
		const deps = collectDepsFromIslandCode(relPath, code);
		if (deps.length > 0) {
			depsManifest[relPath] = deps;
		}
	}
	return depsManifest;
}

type IslandDepPreloadPolicy = {
	skip: boolean;
	fetchPriority?: ModulePreloadFetchPriority;
};

const AVALON_ISLAND_TAG = /<avalon-island\b[^>]*>/gi;
const DATA_SRC_ATTR = /\bdata-src="([^"]+)"/;
const DATA_CONDITION_ATTR = /\bdata-condition="([^"]+)"/;
const DATA_ISLAND_PRELOAD_FALSE = /\bdata-island-preload="false"/;
const DATA_ISLAND_FETCHPRIORITY = /\bdata-island-fetchpriority="(high|low|auto)"/;

/**
 * Aggregate preload policy for every `<avalon-island>` using `islandBundlePath`.
 * Only `on:client` instances contribute; dependency hints skip when all opt out.
 */
export function islandDepPreloadPolicyFromHtml(
	html: string,
	islandBundlePath: string,
): IslandDepPreloadPolicy {
	let sawOnClient = false;
	let allOnClientOptOut = true;
	let fetchPriority: ModulePreloadFetchPriority | undefined;
	let enabledPriorityStarted = false;

	for (const match of html.matchAll(AVALON_ISLAND_TAG)) {
		const tag = match[0];
		const srcMatch = DATA_SRC_ATTR.exec(tag);
		if (srcMatch?.[1] !== islandBundlePath) continue;

		const condition = DATA_CONDITION_ATTR.exec(tag)?.[1];
		if (condition !== undefined && condition !== "on:client") continue;

		sawOnClient = true;
		const optOut = DATA_ISLAND_PRELOAD_FALSE.test(tag);
		if (!optOut) {
			allOnClientOptOut = false;
		} else {
			continue;
		}

		const priorityMatch = DATA_ISLAND_FETCHPRIORITY.exec(tag);
		if (priorityMatch?.[1]) {
			const tagPriority = priorityMatch[1] as ModulePreloadFetchPriority;
			if (!enabledPriorityStarted) {
				fetchPriority = tagPriority;
				enabledPriorityStarted = true;
			} else {
				fetchPriority = mergeModulePreloadWithDefaultRank(fetchPriority, tagPriority);
			}
		} else if (!enabledPriorityStarted) {
			enabledPriorityStarted = true;
		} else {
			fetchPriority = mergeModulePreloadWithDefaultRank(fetchPriority, undefined);
		}
	}

	if (!sawOnClient || allOnClientOptOut) {
		return { skip: true, fetchPriority };
	}
	return { skip: false, fetchPriority };
}

export function depPreloadHintsForHtml(
	html: string,
	depsManifest: Record<string, string[]>,
): string | null {
	const preloadHints = new Map<string, ModulePreloadFetchPriority | undefined>();
	for (const [islandPath, deps] of Object.entries(depsManifest)) {
		if (!html.includes(islandPath)) continue;
		const policy = islandDepPreloadPolicyFromHtml(html, islandPath);
		if (policy.skip) continue;

		for (const dep of deps) {
			if (html.includes(`href="${dep}"`)) continue;
			if (!preloadHints.has(dep)) {
				preloadHints.set(dep, policy.fetchPriority);
				continue;
			}
			preloadHints.set(
				dep,
				mergeModulePreloadWithDefaultRank(preloadHints.get(dep), policy.fetchPriority),
			);
		}
	}
	if (preloadHints.size === 0) return null;
	return Array.from(preloadHints.entries())
		.map(([href, fetchPriority]) => formatModulepreloadLink(href, fetchPriority))
		.join("\n");
}

export function injectIslandDepsPreloads(cwd: string, distDir: string): void {
	let depsManifest: Record<string, string[]> = {};
	const depsPath = join(distDir, "island-deps.json");
	if (existsSync(depsPath)) {
		try {
			depsManifest = JSON.parse(readFileSync(depsPath, "utf-8"));
		} catch {
			// Malformed manifest — rebuild from island bundles below when possible.
		}
	}

	if (Object.keys(depsManifest).length === 0 && existsSync(join(cwd, ".output", "public"))) {
		depsManifest = buildDepsManifestFromOutput(cwd);
	}

	if (Object.keys(depsManifest).length === 0) return;

	const htmlDirs = [join(cwd, ".output", "public"), distDir];
	let patchedCount = 0;
	for (const htmlDir of htmlDirs) {
		if (!existsSync(htmlDir)) continue;
		const htmlFiles = collectFiles(htmlDir, (n) => n === "index.html");
		for (const htmlFile of htmlFiles) {
			let html = readFileSync(htmlFile, "utf-8");
			const hints = depPreloadHintsForHtml(html, depsManifest);
			if (!hints || !html.includes("</head>")) continue;
			html = html.replace("</head>", `${hints}\n</head>`);
			writeFileSync(htmlFile, html);
			patchedCount++;
		}
	}

	if (patchedCount > 0) {
		console.log(
			`[modulepreload] ✅ Injected dependency preloads into ${patchedCount} HTML file(s)`,
		);
	}
}
