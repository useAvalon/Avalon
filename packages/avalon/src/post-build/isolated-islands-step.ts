import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { collectFiles } from "./fs-utils.ts";

function detectIslandFramework(bundleKey: string): string {
	if (bundleKey.includes(".solid")) return "solid";
	if (bundleKey.includes(".vue") || bundleKey.endsWith(".vue")) return "vue";
	if (bundleKey.includes(".svelte") || bundleKey.endsWith(".svelte")) return "svelte";
	if (bundleKey.includes(".lit")) return "lit";
	if (bundleKey.includes(".qwik")) return "qwik";
	if (bundleKey.includes(".react")) return "react";
	return "preact";
}

function resolveIslandSourcePath(cwd: string, bundleKey: string, code: string): string {
	const srcMatch = /from["']((?:\/|\.\/)[^"']+\.(tsx|ts|jsx|js|vue|svelte))["']/i.exec(code);
	let srcPath: string;
	if (srcMatch && !srcMatch[1].includes("/assets/") && !srcMatch[1].startsWith("../")) {
		srcPath = srcMatch[1];
	} else {
		const candidates = [
			`${bundleKey}.tsx`,
			`${bundleKey}.ts`,
			`${bundleKey}.jsx`,
			`${bundleKey}.js`,
			bundleKey,
		];
		const found = candidates.find((c) => existsSync(join(cwd, c)));
		srcPath = found ?? `${bundleKey}.tsx`;
	}

	if (srcPath.startsWith("src/islands/")) {
		srcPath = srcPath.slice("src/islands/".length);
	}
	if (!srcPath.startsWith("/")) {
		srcPath = `/${srcPath}`;
	}
	return srcPath;
}

export async function ensureIsolatedIslands(cwd: string, distDir: string): Promise<void> {
	const islandsDir = join(distDir, "islands");
	if (!existsSync(islandsDir)) {
		console.log("[islands] No islands directory found, skipping isolation");
		return;
	}

	const islandFiles = collectFiles(islandsDir, (n) => n.endsWith(".js") && !n.endsWith(".js.map"));
	const needsRebuild = islandFiles.some((f) => {
		const code = readFileSync(f, "utf-8");
		return code.includes('from"../') || code.includes("from'../");
	});

	if (!needsRebuild) {
		console.log("[islands] All islands are self-contained");
		return;
	}

	try {
		const { buildIsolatedIslands } = await import("./isolated-island-builder.ts");
		const islands = new Map<string, { filePath: string; bundleKey: string; framework: string }>();

		for (const islandFile of islandFiles) {
			const relPath = relative(distDir, islandFile).replaceAll("\\", "/");
			const bundleKey = relPath.replace(/^islands\//, "").replace(/\.js$/, "");
			const code = readFileSync(islandFile, "utf-8");
			const framework = detectIslandFramework(bundleKey);
			const srcPath = resolveIslandSourcePath(cwd, bundleKey, code);
			islands.set(bundleKey, { filePath: srcPath, bundleKey, framework });
		}

		await buildIsolatedIslands(cwd, distDir, islands, [], {});
	} catch (err) {
		console.warn("[islands] Isolated rebuild failed, falling back to inline-islands:", err);
		try {
			const { inlineIslandChunks } = await import("./inline-islands.ts");
			await inlineIslandChunks(distDir, { verbose: true });
		} catch (inlineErr) {
			console.error("[islands] Inline fallback also failed:", inlineErr);
		}
	}
}
