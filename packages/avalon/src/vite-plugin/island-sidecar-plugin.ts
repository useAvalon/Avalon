import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { EXTRACTOR_MAP } from "../build/prop-extractors/index.ts";
import {
	deleteSidecar,
	getSidecarPath,
	isSidecarFresh,
	writeSidecarIfChanged,
} from "../build/sidecar-file-manager.ts";
import { renderSidecarContent } from "../build/sidecar-renderer.ts";
import { detectFrameworkFromPath } from "../islands/integration-loader.ts";

export interface SidecarPluginOptions {
	/** Whether to log verbose output */
	verbose?: boolean;
}

/** Frameworks that should be skipped — they already work natively with Preact/React JSX */
const SKIP_FRAMEWORKS = new Set(["react", "preact"]);

/** File extensions that qualify as island source files for HMR */
const ISLAND_EXTENSIONS = [".vue", ".svelte", ".lit.ts", ".solid.tsx", ".qwik.tsx"];

/**
 * Check tsconfig.json for `allowArbitraryExtensions` and warn if missing.
 */
export async function checkTsConfigForArbitraryExtensions(projectRoot: string): Promise<void> {
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
		// tsconfig doesn't exist or can't be parsed - skip warning
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
 * Check if a file path looks like a supported component file that needs a sidecar.
 * Excludes files that are already sidecar declaration files.
 */
function needsSidecar(filePath: string): boolean {
	if (isSidecarFile(filePath)) {
		return false;
	}
	return ISLAND_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

/**
 * Generate a sidecar for a single component file.
 * Returns true if a sidecar was written/updated, false otherwise.
 */
async function generateSidecarForFile(filePath: string, verbose?: boolean): Promise<boolean> {
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
		if (verbose) {
			console.warn(
				`[avalon] Failed to generate sidecar for ${filePath}:`,
				err instanceof Error ? err.message : err,
			);
		}
		return false;
	}
}

/**
 * Vite plugin that auto-generates `.d.[ext].ts` sidecar declaration files
 * for non-React/Preact components when they are used as islands.
 *
 * Sidecars are generated on-demand when component files are loaded,
 * rather than scanning a fixed directory at startup.
 */
export function islandSidecarPlugin(options: SidecarPluginOptions = {}): Plugin {
	let projectRoot: string;
	const processedFiles = new Set<string>();

	return {
		name: "avalon:island-sidecar",

		configResolved(config) {
			projectRoot = config.root;
		},

		async buildStart() {
			await checkTsConfigForArbitraryExtensions(projectRoot);
			processedFiles.clear();
		},

		// Generate sidecar when a component file is loaded
		async load(id) {
			if (!needsSidecar(id) || processedFiles.has(id)) {
				return null;
			}

			processedFiles.add(id);

			// Check if sidecar needs regeneration
			const sidecarPath = getSidecarPath(id);
			if (await isSidecarFresh(id, sidecarPath)) {
				return null;
			}

			const wrote = await generateSidecarForFile(id, options.verbose);
			if (wrote && options.verbose) {
				console.log(`[avalon] Generated sidecar for: ${id}`);
			}

			return null; // Let Vite handle the actual file loading
		},

		async handleHotUpdate(ctx) {
			const filePath = ctx.file;

			if (!needsSidecar(filePath)) {
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
					console.log(`[avalon] Deleted sidecar for removed file: ${filePath}`);
				}
				processedFiles.delete(filePath);
				return;
			}

			// File was changed — regenerate sidecar
			processedFiles.delete(filePath); // Allow re-processing
			const wrote = await generateSidecarForFile(filePath, options.verbose);
			if (wrote && options.verbose) {
				console.log(`[avalon] Updated sidecar for: ${filePath}`);
			}
		},
	};
}
