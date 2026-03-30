/**
 * Post-build Island Inlining
 *
 * Re-bundles each island chunk with esbuild to inline shared dependencies
 * (framework runtimes) into a single self-contained file per island.
 * This eliminates the separate shared chunks, matching Astro's approach.
 *
 * Runs AFTER the main Vite build, operating on the compiled JS output.
 * No framework plugins needed — .vue/.svelte/.solid are already compiled to JS.
 */

import { readdir, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";

interface InlineResult {
	island: string;
	beforeSize: number;
	afterSize: number;
	success: boolean;
	error?: string;
}

/**
 * Inline shared chunk dependencies into each island file.
 *
 * @param distDir - The build output directory (e.g., "dist" or ".output/public")
 * @param options - Configuration options
 */
export async function inlineIslandChunks(
	distDir: string,
	options: { verbose?: boolean; skipQwik?: boolean } = {},
): Promise<InlineResult[]> {
	const { verbose = false, skipQwik = true } = options;
	const islandsDir = resolve(distDir, "islands");

	// Find all island JS files recursively
	const islandFiles = await findIslandFiles(islandsDir);
	if (islandFiles.length === 0) {
		if (verbose) console.log("🏝️  No island files found, skipping inlining");
		return [];
	}

	// Try to load a bundler (Bun's built-in or esbuild)
	let bundler: "bun" | "esbuild" | null = null;
	let esbuild: any;

	if (typeof globalThis.Bun !== "undefined") {
		bundler = "bun";
	} else {
		try {
			esbuild = await import("esbuild");
			bundler = "esbuild";
		} catch {
			// Neither available
		}
	}

	if (!bundler) {
		console.warn("🏝️  No bundler available (Bun or esbuild), skipping island inlining");
		return [];
	}

	const results: InlineResult[] = [];

	for (const islandFile of islandFiles) {
		const relPath = islandFile.replace(distDir + "/", "");

		// Skip Qwik islands — they use resumability, not hydration
		if (skipQwik && relPath.includes(".qwik.")) {
			results.push({ island: relPath, beforeSize: 0, afterSize: 0, success: true });
			continue;
		}

		try {
			const beforeCode = await readFile(islandFile, "utf-8");
			const beforeSize = Buffer.byteLength(beforeCode, "utf-8");

			// Check if the island has shared chunk imports
			if (!beforeCode.includes('from"../') && !beforeCode.includes("from'../")) {
				results.push({ island: relPath, beforeSize, afterSize: beforeSize, success: true });
				continue;
			}

			if (bundler === "bun") {
				const buildOpts: any = {
					entrypoints: [islandFile],
					outdir: resolve(islandFile, ".."),
					naming: "[name].[ext]",
					minify: true,
					target: "browser",
					format: "esm",
					treeshaking: true,
					// Keep the integration loader as an external import — it's a
					// multi-framework dispatcher that would pull in ALL frameworks.
					external: ["*integration-loader*"],
				};
				const result = await Bun.build(buildOpts);
				if (!result.success) {
					throw new Error(result.logs.map((l: any) => l.message).join("\n"));
				}
			} else {
				await esbuild.build({
					entryPoints: [islandFile],
					outfile: islandFile,
					bundle: true,
					format: "esm",
					minify: true,
					treeShaking: true,
					target: "es2020",
					allowOverwrite: true,
					// Keep the integration loader as an external import — it's a
					// multi-framework dispatcher that would pull in ALL frameworks.
					// Also keep rolldown-runtime external (tiny shared helper).
					plugins: [
						{
							name: "externalize-integration-loader",
							setup(build: any) {
								build.onResolve({ filter: /integration-loader|rolldown-runtime/ }, (args: any) => ({
									path: args.path,
									external: true,
								}));
							},
						},
					],
				});
			}

			const afterCode = await readFile(islandFile, "utf-8");
			const afterSize = Buffer.byteLength(afterCode, "utf-8");

			results.push({ island: relPath, beforeSize, afterSize, success: true });

			if (verbose) {
				const before = (beforeSize / 1024).toFixed(1);
				const after = (afterSize / 1024).toFixed(1);
				console.log(`  ✅ ${relPath}: ${before} KiB → ${after} KiB`);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  ❌ ${relPath}: ${msg}`);
			results.push({ island: relPath, beforeSize: 0, afterSize: 0, success: false, error: msg });
		}
	}

	const succeeded = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success).length;
	console.log(`🏝️  Done: ${succeeded} inlined${failed ? `, ${failed} failed` : ""}`);

	return results;
}

async function findIslandFiles(dir: string, files: string[] = []): Promise<string[]> {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				await findIslandFiles(fullPath, files);
			} else if (entry.name.endsWith(".js") && !entry.name.endsWith(".map")) {
				files.push(fullPath);
			}
		}
	} catch {
		// Directory doesn't exist
	}
	return files;
}
