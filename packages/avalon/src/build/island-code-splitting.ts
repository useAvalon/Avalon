/**
 * Island Code Splitting Plugin
 *
 * Configures Vite/Rollup to bundle the framework adapter + runtime INTO each
 * island component chunk rather than splitting them into separate shared chunks.
 *
 * When per-island hydration mode is active, each island gets its own
 * `<script type="module">` that imports the component + adapter. Without this
 * plugin, Rollup would extract the `virtual:avalon/integration-loader` module
 * and framework runtimes (e.g., solid-js/web) into separate shared chunks,
 * adding extra network requests.
 *
 * This plugin works by:
 * 1. Using `manualChunks` with `getModuleInfo` to walk the import graph and
 *    assign framework runtime modules to the same chunk as their importing
 *    island entry point
 * 2. When a framework module is imported by multiple islands, each island
 *    gets its own copy (the runtime is duplicated intentionally)
 * 3. The integration loader is similarly inlined into each island chunk
 *
 *
 * @module build/island-code-splitting
 */

import type { Plugin } from "vite";
import type { ResolvedAvalonConfig } from "../vite-plugin/types.ts";
import type { AvalonNitroConfig } from "../nitro/config.ts";

/** Default size threshold (in bytes) below which island chunks are consolidated. */
export const DEFAULT_CHUNK_SIZE_THRESHOLD = 4096; // 4 KiB

/** Minimal chunk shape used by the consolidation logic (compatible with both Rollup and Rolldown). */
export interface BundleChunk {
	type: string;
	fileName: string;
	code: string;
	moduleIds: string[];
}

/** A mutable bundle record — works with both Rollup's and Rolldown's OutputBundle. */
type MutableBundle = Record<string, unknown>;

/**
 * Module IDs that should be inlined into island chunks instead of being
 * split into separate shared chunks.
 */
const INTEGRATION_LOADER_PATTERNS = [
	"\0virtual:avalon/integration-loader",
	"virtual:avalon/integration-loader",
];

/**
 * Framework runtime packages whose code should be bundled into island chunks
 * rather than extracted as separate vendor chunks.
 */
const FRAMEWORK_RUNTIME_PACKAGES = [
	// Solid
	"solid-js",
	"solid-js/web",
	"solid-js/store",
	// Preact
	"preact",
	"preact/hooks",
	"preact/jsx-runtime",
	// React
	"react",
	"react/jsx-runtime",
	"react-dom",
	"react-dom/client",
	// Vue
	"vue",
	"@vue/runtime-dom",
	"@vue/runtime-core",
	"@vue/reactivity",
	"@vue/shared",
	// Svelte
	"svelte",
	"svelte/internal",
	"svelte/store",
	// Lit
	"lit",
	"lit-html",
	"@lit/reactive-element",
	// Qwik
	"@builder.io/qwik",
];

/**
 * Check if a module ID matches the integration loader virtual module.
 */
export function isIntegrationLoaderModule(id: string): boolean {
	return INTEGRATION_LOADER_PATTERNS.some((pattern) => id.includes(pattern));
}

/**
 * Check if a module ID is a framework runtime that should be inlined
 * into island chunks.
 */
export function isFrameworkRuntimeModule(id: string): boolean {
	return FRAMEWORK_RUNTIME_PACKAGES.some(
		(pkg) => id.includes(`/node_modules/${pkg}/`) || id === pkg,
	);
}

/**
 * Check if a module ID belongs to an island chunk.
 */
export function isIslandModule(id: string): boolean {
	return id.includes("/islands/") || id.includes("avalon-island-entry:");
}

/**
 * Check if a module should be inlined into island chunks rather than
 * extracted into a separate shared/vendor chunk.
 */
export function shouldInlineIntoIsland(id: string): boolean {
	return isIntegrationLoaderModule(id) || isFrameworkRuntimeModule(id);
}

/** Extract the island chunk name from a module path containing /islands/ */
const ISLAND_NAME_RE = /islands\/([^.]+)/;

function extractIslandChunkName(moduleId: string): string | undefined {
	const match = ISLAND_NAME_RE.exec(moduleId);
	return match ? `islands/${match[1]}` : undefined;
}

/** Check if a module ID is an island entry point (wrapper or direct island file) */
function isIslandEntryImporter(moduleId: string): boolean {
	if (moduleId.includes("avalon-island-entry:")) return true;
	return moduleId.includes("/islands/") && !shouldInlineIntoIsland(moduleId);
}

/**
 * Walk the importer chain of a module to find the island entry point
 * that imports it. Returns the island chunk name (e.g., "islands/Counter")
 * or undefined if the module is not imported by any island.
 *
 * Uses getModuleInfo from Rollup's manualChunks context to traverse
 * the import graph upward from a framework module to its island entry.
 */
export function findIslandImporter(
	id: string,
	getModuleInfo: (id: string) => { importers: readonly string[] } | null,
	visited?: Set<string>,
): string | undefined {
	const seen = visited ?? new Set<string>();
	if (seen.has(id)) return undefined;
	seen.add(id);

	const info = getModuleInfo(id);
	if (!info) return undefined;

	for (const importer of info.importers) {
		if (isIslandEntryImporter(importer)) {
			return extractIslandChunkName(importer);
		}
		// Recurse up the import chain
		const result = findIslandImporter(importer, getModuleInfo, seen);
		if (result) return result;
	}

	return undefined;
}

/**
 * Packages whose modules should be treated as side-effect-free for
 * tree-shaking purposes. Both solid-js and solid-js/web already declare
 * `"sideEffects": false` in their package.json, and their dist files use
 * `/*#__PURE__*​/` annotations on module-level declarations. This explicit
 * list ensures Rollup/Rolldown respects that even when module resolution
 * goes through the resolveId hook (which can bypass package.json lookup).
 */
const SIDE_EFFECT_FREE_PACKAGES = [
	// Solid — declares sideEffects: false in package.json
	"solid-js",
	"solid-js/web",
	"solid-js/store",
	// Preact — small runtime, side-effect-free exports
	"preact",
	"preact/hooks",
	// Svelte — compiled output is side-effect-free
	"svelte",
	"svelte/internal",
	// Lit — decorators and templates are side-effect-free
	"lit",
	"lit-html",
	"@lit/reactive-element",
];

/**
 * Check if a module ID belongs to a package that is known to be
 * side-effect-free and safe for aggressive tree-shaking.
 */
export function isSideEffectFreeModule(id: string): boolean {
	return SIDE_EFFECT_FREE_PACKAGES.some(
		(pkg) => id.includes(`/node_modules/${pkg}/`) || id.includes(`/${pkg}/dist/`),
	);
}

// ─── Chunk Consolidation ─────────────────────────────────────────────────────

/**
 * Detect the framework used by an island chunk by inspecting its module IDs.
 * Returns the framework package name (e.g., "solid") or "unknown".
 */
export function detectChunkFramework(moduleIds: string[]): string {
	for (const id of moduleIds) {
		if (id.includes("solid-js") || id.includes("solid-js/web")) return "solid";
		if (id.includes("preact")) return "preact";
		if (id.includes("react")) return "react";
		if (id.includes("vue")) return "vue";
		if (id.includes("svelte")) return "svelte";
		if (id.includes("@builder.io/qwik")) return "qwik";
		if (id.includes("lit")) return "lit";
	}
	return "unknown";
}

/**
 * Identify island chunks in the bundle that are below the size threshold.
 * Returns an array of small island chunks.
 */
export function findSmallIslandChunks(
	bundle: Record<string, BundleChunk | { type: string }>,
	threshold: number,
): BundleChunk[] {
	const results: BundleChunk[] = [];
	for (const asset of Object.values(bundle)) {
		if (asset.type !== "chunk") continue;
		const chunk = asset as BundleChunk;
		if (!chunk.fileName.startsWith("islands/")) continue;
		// Skip chunks that are already consolidated
		if (chunk.fileName.includes("shared-")) continue;
		if (chunk.code.length < threshold) {
			results.push(chunk);
		}
	}
	return results;
}

/**
 * Group small island chunks by their detected framework.
 * Returns a map of framework name → array of small chunks.
 */
export function groupChunksByFramework(chunks: BundleChunk[]): Map<string, BundleChunk[]> {
	const groups = new Map<string, BundleChunk[]>();
	for (const chunk of chunks) {
		const fw = detectChunkFramework(chunk.moduleIds);
		const group = groups.get(fw) ?? [];
		group.push(chunk);
		groups.set(fw, group);
	}
	return groups;
}

/**
 * Build a consolidated chunk by concatenating the code of multiple small
 * island chunks. Each original chunk's exports are preserved as named
 * exports in the consolidated module.
 *
 * Returns the consolidated code string and the combined module IDs.
 */
export function buildConsolidatedChunk(chunks: BundleChunk[]): {
	code: string;
	moduleIds: string[];
} {
	const allCode: string[] = [];
	const allModuleIds: string[] = [];

	for (const chunk of chunks) {
		// Add a comment marker for each original island
		allCode.push(`// --- ${chunk.fileName} ---`, chunk.code);
		for (const id of chunk.moduleIds) allModuleIds.push(id);
	}

	return {
		code: allCode.join("\n"),
		moduleIds: allModuleIds,
	};
}

/**
 * Consolidate small island chunks in the output bundle.
 * Merges island chunks below the size threshold into shared bundles
 * grouped by framework (e.g., `islands/shared-solid.js`).
 *
 * Only groups with 2+ small chunks are consolidated — a single small
 * chunk is left as-is since merging wouldn't reduce requests.
 *
 * Returns a map of original fileName → consolidated fileName for
 * updating references (e.g., script tags, modulepreload hints).
 */
export function consolidateIslandChunks(
	bundle: MutableBundle,
	threshold: number = DEFAULT_CHUNK_SIZE_THRESHOLD,
): Map<string, string> {
	const remapping = new Map<string, string>();

	const smallChunks = findSmallIslandChunks(
		bundle as Record<string, BundleChunk | { type: string }>,
		threshold,
	);

	if (smallChunks.length < 2) return remapping;

	const groups = groupChunksByFramework(smallChunks);

	for (const [framework, chunks] of groups) {
		// Only consolidate if there are 2+ small chunks for this framework
		if (chunks.length < 2) continue;

		const consolidatedName = `islands/shared-${framework}.js`;
		const { code, moduleIds } = buildConsolidatedChunk(chunks);

		// Emit the consolidated chunk
		bundle[consolidatedName] = {
			type: "chunk",
			fileName: consolidatedName,
			code,
			moduleIds,
			isEntry: false,
			isDynamicEntry: false,
			facadeModuleId: null,
			modules: {},
			exports: [],
			imports: [],
			dynamicImports: [],
			implicitlyLoadedBefore: [],
			importedBindings: {},
			referencedFiles: [],
			map: null,
			name: `shared-${framework}`,
			preliminaryFileName: consolidatedName,
			sourcemapFileName: null,
		};

		// Remove original small chunks and record remapping
		for (const chunk of chunks) {
			remapping.set(chunk.fileName, consolidatedName);
			delete bundle[chunk.fileName];
		}
	}

	return remapping;
}

/**
 * Creates a Vite plugin that configures Rollup to bundle the framework
 * adapter + runtime into each island component chunk.
 *
 * Only active when:
 * - The hydration mode is "per-island"
 * - The build command is "build" (not dev server)
 *
 * This eliminates the separate runtime chunk, matching Astro's approach
 * where each island is fully self-contained.
 *
 * Tree-shaking: Configures `treeshake.moduleSideEffects` so that solid-js
 * packages are treated as side-effect-free. This allows Rollup to drop
 * unused exports (template, delegateEvents, spread, etc.) from island
 * chunks that only use hydrate() + createComponent().
 */
export function islandCodeSplittingPlugin(
	_avalonConfig: ResolvedAvalonConfig,
	_nitroConfig?: AvalonNitroConfig,
	options?: { chunkSizeThreshold?: number },
): Plugin {
	// Hydration mode is automatic: dev uses entry-client (HMR), prod uses per-island.
	// The config hook below checks the Vite command to determine the mode.
	const threshold = options?.chunkSizeThreshold ?? DEFAULT_CHUNK_SIZE_THRESHOLD;
	let isBuild = false;

	return {
		name: "avalon:island-code-splitting",
		enforce: "post",

		config(_config, { command }) {
			if (command !== "build") return;
			isBuild = true;
			// treeshake config is safe for all environments
			return {
				build: {
					rollupOptions: {
						treeshake: {
							moduleSideEffects(id: string) {
								if (isSideEffectFreeModule(id)) return false;
								return true;
							},
						},
					},
				},
			};
		},

		// Reserved for future per-island build isolation.
		// Currently Rolldown extracts shared framework runtimes as separate
		// chunks (correct deduplication behavior). To inline runtimes into
		// each island chunk (like Astro), we'd need separate build passes.
		configEnvironment(_name: string) {},

		generateBundle(_options, bundle) {
			if (!isBuild) return;

			// Note: Rolldown does not support mutating the bundle object in
			// generateBundle (no delete/assign). We log consolidation candidates
			// but skip the actual merge. When Rolldown adds support for
			// this.emitFile in generateBundle, we can re-enable consolidation.
			const envName = this.environment?.name;
			if (envName && envName !== "client") return;

			const smallChunks = findSmallIslandChunks(
				bundle as unknown as Record<string, BundleChunk | { type: string }>,
				threshold,
			);

			if (smallChunks.length >= 2 && _avalonConfig.verbose) {
				const groups = groupChunksByFramework(smallChunks);
				for (const [fw, chunks] of groups) {
					if (chunks.length >= 2) {
						console.log(
							`🏝️  ${chunks.length} small ${fw} island chunks could be consolidated into islands/shared-${fw}.js`,
						);
					}
				}
			}
		},
	};
}
