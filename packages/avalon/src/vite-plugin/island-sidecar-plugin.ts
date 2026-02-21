import type { Plugin } from "vite";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { discoverAllIslands } from "../islands/discovery/scanner.ts";
import { detectFrameworkFromPath } from "../islands/integration-loader.ts";
import { EXTRACTOR_MAP } from "../build/prop-extractors/index.ts";
import { renderSidecarContent } from "../build/sidecar-renderer.ts";
import {
	getSidecarPath,
	writeSidecarIfChanged,
	deleteSidecar,
	isSidecarFresh,
} from "../build/sidecar-file-manager.ts";

export interface SidecarPluginOptions {
	/** Islands directory path (e.g., "src/islands") */
	islandsDir: string;
	/** Whether to log verbose output */
	verbose?: boolean;
}

/** Frameworks that should be skipped — they already work natively with Preact/React JSX */
const SKIP_FRAMEWORKS = new Set(["react", "preact"]);

/** File extensions that qualify as island source files for HMR */
const ISLAND_EXTENSIONS = [".vue", ".svelte", ".lit.ts", ".solid.tsx"];

/**
 * Check tsconfig.json for `allowArbitraryExtensions` and warn if missing.
 */
export async function checkTsConfigForArbitraryExtensions(
	projectRoot: string,
): Promise<void> {
	const tsconfigPath = path.join(projectRoot, "tsconfig.json");
	try {
		const raw = await readFile(tsconfigPath, "utf-8");
		const tsconfig = JSON.parse(raw);
		if (tsconfig?.compilerOptions?.allowArbitraryExtensions !== true) {
			console.warn(
				'[avalon] tsconfig.json is missing "allowArbitraryExtensions: true" — sidecar .d.[ext].ts files require this setting',
			);
		}
	} catch {
		console.warn(
			'[avalon] tsconfig.json is missing "allowArbitraryExtensions: true" — sidecar .d.[ext].ts files require this setting',
		);
	}
}

/**
 * Check if a file path is already a sidecar declaration file.
 * Sidecar files contain `.d.` before the framework extension.
 */
function isSidecarFile(filePath: string): boolean {
	const basename = path.basename(filePath);
	return /\.d\.(vue|svelte|lit|solid\.tsx)/.test(basename);
}

/**
 * Check if a file path looks like a supported island file (non-React/Preact).
 * Excludes files that are already sidecar declaration files.
 */
function isIslandFile(filePath: string): boolean {
	if (isSidecarFile(filePath)) {
		return false;
	}
	return ISLAND_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

/**
 * Generate a sidecar for a single island file.
 * Returns true if a sidecar was written/updated, false otherwise.
 */
async function generateSidecarForFile(filePath: string): Promise<boolean> {
	try {
		const framework = detectFrameworkFromPath(filePath);
		if (SKIP_FRAMEWORKS.has(framework)) {
			return false;
		}

		const extractor = EXTRACTOR_MAP[framework];
		if (!extractor) {
			return false;
		}

		const source = await readFile(filePath, "utf-8");
		const result = extractor(source);
		const content = renderSidecarContent(result.propsType);
		const sidecarPath = getSidecarPath(filePath);
		return await writeSidecarIfChanged(sidecarPath, content);
	} catch (err) {
		console.warn(
			`[avalon] Failed to generate sidecar for ${filePath}:`,
			err instanceof Error ? err.message : err,
		);
		return false;
	}
}

/**
 * Vite plugin that auto-generates `.d.[ext].ts` sidecar declaration files
 * for non-React/Preact island components.
 */
export function islandSidecarPlugin(options: SidecarPluginOptions): Plugin {
	let projectRoot: string;

	return {
		name: "avalon:island-sidecar",

		configResolved(config) {
			projectRoot = config.root;
		},

		async buildStart() {
			await checkTsConfigForArbitraryExtensions(projectRoot);

			let islands;
			try {
				islands = await discoverAllIslands(projectRoot);
			} catch (err) {
				console.warn(
					"[avalon] Failed to discover islands for sidecar generation:",
					err instanceof Error ? err.message : err,
				);
				return;
			}

			const qualifying = islands.filter(
				(island) => !SKIP_FRAMEWORKS.has(island.framework) && !isSidecarFile(island.filePath),
			);

			const results = await Promise.all(
				qualifying.map(async (island) => {
					try {
						const extractor = EXTRACTOR_MAP[island.framework];
						if (!extractor) {
							return "skipped" as const;
						}

						// Fast path: skip if sidecar is newer than source
						const sidecarPath = getSidecarPath(island.filePath);
						if (await isSidecarFresh(island.filePath, sidecarPath)) {
							return "skipped" as const;
						}

						const source = await readFile(island.filePath, "utf-8");
						const result = extractor(source);
						const content = renderSidecarContent(result.propsType);
						const wrote = await writeSidecarIfChanged(sidecarPath, content);
						return wrote ? ("generated" as const) : ("skipped" as const);
					} catch (err) {
						console.warn(
							`[avalon] Failed to generate sidecar for ${island.name}:`,
							err instanceof Error ? err.message : err,
						);
						return "skipped" as const;
					}
				}),
			);

			if (options.verbose) {
				const generated = results.filter((r) => r === "generated").length;
				const skipped = results.filter((r) => r === "skipped").length;
				console.log(
					`[avalon] Sidecar generation: ${generated} written, ${skipped} up-to-date, ${islands.length - qualifying.length} skipped (React/Preact)`,
				);
			}
		},

		async handleHotUpdate(ctx) {
			const filePath = ctx.file;

			if (!isIslandFile(filePath)) {
				return;
			}

			// Check if the file was deleted
			let fileExists = true;
			try {
				await access(filePath);
			} catch {
				fileExists = false;
			}

			if (!fileExists) {
				// File was deleted — remove the sidecar
				const sidecarPath = getSidecarPath(filePath);
				const deleted = await deleteSidecar(sidecarPath);
				if (deleted && options.verbose) {
					console.log(`[avalon] Deleted sidecar for removed island: ${filePath}`);
				}
				return;
			}

			// File was added or changed — regenerate sidecar
			const wrote = await generateSidecarForFile(filePath);
			if (wrote && options.verbose) {
				console.log(`[avalon] Updated sidecar for: ${filePath}`);
			}
		},
	};
}
