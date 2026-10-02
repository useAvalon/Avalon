import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

function preloadHintsForHtml(html: string, depsManifest: Record<string, string[]>): string | null {
	const preloadHints = new Set<string>();
	for (const [islandPath, deps] of Object.entries(depsManifest)) {
		if (!html.includes(islandPath)) continue;
		for (const dep of deps) {
			if (!html.includes(`href="${dep}"`)) {
				preloadHints.add(dep);
			}
		}
	}
	if (preloadHints.size === 0) return null;
	return Array.from(preloadHints)
		.map((href) => `<link rel="modulepreload" href="${href}">`)
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
			const hints = preloadHintsForHtml(html, depsManifest);
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
