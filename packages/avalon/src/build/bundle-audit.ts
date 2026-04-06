/**
 * Bundle Audit Utility
 *
 * Lightweight utility for analyzing production build output:
 * - Lists all output chunks with their sizes
 * - Identifies which modules are included in each chunk
 * - Flags unexpected large modules or duplicated code
 * - Reports total JS size and per-island chunk sizes
 * - Provides a Vite plugin hook for post-build reporting
 *
 * @module build/bundle-audit
 */

import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { z } from "zod";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Represents a single chunk in the build output. */
export interface ChunkInfo {
	fileName: string;
	/** Raw code size in bytes. */
	size: number;
	/** Module IDs included in this chunk. */
	moduleIds: string[];
	/** Whether this is an island chunk. */
	isIsland: boolean;
	/** Whether this is an entry chunk. */
	isEntry: boolean;
}

/** Summary of the full bundle audit. */
export interface BundleAuditReport {
	/** All chunks in the build output. */
	chunks: ChunkInfo[];
	/** Total JS size in bytes (sum of all chunk code sizes). */
	totalJsBytes: number;
	/** Total island JS size in bytes. */
	islandJsBytes: number;
	/** Chunks that exceed the configured threshold. */
	oversizedChunks: ChunkInfo[];
	/** Module IDs that appear in more than one chunk. */
	duplicatedModules: DuplicatedModule[];
}

/** A module that appears in multiple chunks. */
export interface DuplicatedModule {
	moduleId: string;
	/** File names of chunks containing this module. */
	chunks: string[];
}

/** Per-framework size thresholds for island chunks (in bytes). */
export interface PerFrameworkThresholds {
	solid: number;
	preact: number;
	react: number;
	vue: number;
	svelte: number;
}

/** Options for the bundle audit Vite plugin. */
export interface BundleAuditOptions {
	/** Maximum allowed size (in bytes) for any single island chunk. Default: 20480 (20 KiB). */
	chunkSizeThreshold?: number;
	/** Maximum allowed total JS size (in bytes). Default: 20480 (20 KiB). */
	totalSizeThreshold?: number;
	/** Whether to log the report to console. Default: true. */
	logReport?: boolean;
	/** Whether to emit warnings for oversized chunks. Default: true. */
	warnOnOversized?: boolean;
	/** Per-framework size thresholds for island chunks. When provided, islands are also checked against their framework-specific limit. */
	perFrameworkThresholds?: Partial<PerFrameworkThresholds>;
	/** Path to the benchmark baseline JSON file. When set, enables benchmark comparison mode. */
	benchmarkBaseline?: string;
	/** Maximum allowed regression in bytes before flagging. Default: 500. */
	regressionThreshold?: number;
}

/** Zod schema for the benchmark baseline file used to track island bundle sizes over time. */
export const BenchmarkBaselineSchema = z.object({
	version: z.number(),
	timestamp: z.string(),
	islands: z.record(z.string(), z.object({
		size: z.number(),
		framework: z.string(),
	})),
	references: z.object({
		astroSolidCounter: z.number(),
	}),
});

/** Benchmark baseline data parsed from the baseline JSON file. */
export type BenchmarkBaseline = z.infer<typeof BenchmarkBaselineSchema>;

/** Result of comparing a single island's current size against the benchmark baseline. */
export interface BenchmarkResult {
	island: string;
	currentSize: number;
	baselineSize: number | null;
	deltaBytes: number;
	deltaPercent: number;
	framework: string;
	astroReferenceSize?: number;
}

// ─── Benchmark Comparison ────────────────────────────────────────────────────

/**
 * Compare current island sizes against a stored benchmark baseline.
 *
 * This is a pure function — the caller is responsible for loading and parsing
 * the baseline JSON file. For each island in `currentIslands`, the function
 * looks up the baseline entry by island name and computes the delta.
 *
 * @param currentIslands - Array of current island build results with name, size, and framework
 * @param baseline - Parsed benchmark baseline data
 * @param regressionThreshold - Maximum allowed regression in bytes before flagging (default: 500)
 * @returns Results per island and whether any regression was detected
 */
export function compareBenchmarkBaseline(
	currentIslands: Array<{ island: string; size: number; framework: string }>,
	baseline: BenchmarkBaseline,
	regressionThreshold = 500,
): { results: BenchmarkResult[]; hasRegression: boolean } {
	const astroReferenceSize = baseline.references.astroSolidCounter;

	const results: BenchmarkResult[] = currentIslands.map((current) => {
		const baselineEntry = baseline.islands[current.island];

		if (baselineEntry) {
			const deltaBytes = current.size - baselineEntry.size;
			const deltaPercent = (deltaBytes / baselineEntry.size) * 100;
			return {
				island: current.island,
				currentSize: current.size,
				baselineSize: baselineEntry.size,
				deltaBytes,
				deltaPercent,
				framework: current.framework,
				astroReferenceSize,
			};
		}

		return {
			island: current.island,
			currentSize: current.size,
			baselineSize: null,
			deltaBytes: 0,
			deltaPercent: 0,
			framework: current.framework,
			astroReferenceSize,
		};
	});

	const hasRegression = results.some((r) => r.deltaBytes > regressionThreshold);

	return { results, hasRegression };
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default per-chunk size threshold: 20 KiB */
export const DEFAULT_CHUNK_THRESHOLD = 20 * 1024;

/** Default total JS size threshold: 20 KiB (from requirements) */
export const DEFAULT_TOTAL_THRESHOLD = 20 * 1024;

/** Default per-framework island chunk thresholds. Solid: 6 KiB, others: 10 KiB. */
export const DEFAULT_PER_FRAMEWORK_THRESHOLDS: PerFrameworkThresholds = {
	solid: 6 * 1024,
	preact: 10 * 1024,
	react: 10 * 1024,
	vue: 10 * 1024,
	svelte: 10 * 1024,
};

/** Supported framework suffixes for detection from file names. */
const FRAMEWORK_SUFFIXES = [".solid.", ".preact.", ".react.", ".vue.", ".svelte."] as const;

/**
 * Detect the framework from an island chunk file name.
 * Looks for `.solid.`, `.preact.`, `.react.`, `.vue.`, `.svelte.` in the file name.
 * Returns the framework name or `null` if none is detected.
 */
export function detectFrameworkFromFileName(fileName: string): string | null {
	for (const suffix of FRAMEWORK_SUFFIXES) {
		if (fileName.includes(suffix)) {
			// Extract framework name between the dots: ".solid." → "solid"
			return suffix.slice(1, -1);
		}
	}
	return null;
}

/** Known dev-only module patterns that should not appear in production builds. */
const DEV_ONLY_PATTERNS = [
	/\/dev\.js$/,
	/\/dev\.mjs$/,
	/__DEV__/,
	/hot-reload/,
	/hmr-coordinator/,
	/hmr-error-overlay/,
	/solid-refresh/,
];

// ─── Core Analysis Functions ─────────────────────────────────────────────────

/** Shape of a bundle asset — loose enough to handle both Rollup and Rolldown. */
export type BundleAsset = Record<string, unknown> & { type: string };

/**
 * Extract chunk information from a Rollup/Vite output bundle.
 * Compatible with both Rollup and Rolldown bundle formats.
 */
export function extractChunks(bundle: Record<string, BundleAsset>): ChunkInfo[] {
	const chunks: ChunkInfo[] = [];

	for (const [key, asset] of Object.entries(bundle)) {
		if (asset.type !== "chunk") continue;

		const fileName = (asset.fileName as string | undefined) ?? key;
		const code = (asset.code as string | undefined) ?? "";
		const moduleIds =
			(asset.moduleIds as string[] | undefined) ??
			Object.keys((asset.modules as Record<string, unknown> | undefined) ?? {});

		chunks.push({
			fileName,
			size: Buffer.byteLength(code, "utf-8"),
			moduleIds,
			isIsland: fileName.startsWith("islands/") || fileName.includes("/islands/"),
			isEntry: (asset.isEntry as boolean | undefined) ?? false,
		});
	}

	return chunks.sort((a, b) => b.size - a.size);
}

/**
 * Find modules that are duplicated across multiple chunks.
 * Intentional duplication (e.g., framework runtime inlined per-island)
 * is expected — this helps identify *unintentional* duplication.
 */
export function findDuplicatedModules(chunks: ChunkInfo[]): DuplicatedModule[] {
	const moduleToChunks = new Map<string, string[]>();

	for (const chunk of chunks) {
		for (const moduleId of chunk.moduleIds) {
			// Skip virtual modules — they're expected to appear in multiple chunks
			if (moduleId.startsWith("\0")) continue;
			const existing = moduleToChunks.get(moduleId) ?? [];
			existing.push(chunk.fileName);
			moduleToChunks.set(moduleId, existing);
		}
	}

	const duplicated: DuplicatedModule[] = [];
	for (const [moduleId, chunkNames] of moduleToChunks) {
		if (chunkNames.length > 1) {
			duplicated.push({ moduleId, chunks: chunkNames });
		}
	}

	return duplicated.sort((a, b) => b.chunks.length - a.chunks.length);
}

/**
 * Check if any chunks contain dev-only modules that shouldn't be in production.
 * Returns the list of chunk/module pairs that are suspicious.
 */
export function findDevOnlyModules(
	chunks: ChunkInfo[],
): Array<{ chunkFileName: string; moduleId: string; pattern: string }> {
	const findings: Array<{ chunkFileName: string; moduleId: string; pattern: string }> = [];

	for (const chunk of chunks) {
		for (const moduleId of chunk.moduleIds) {
			for (const pattern of DEV_ONLY_PATTERNS) {
				if (pattern.test(moduleId)) {
					findings.push({
						chunkFileName: chunk.fileName,
						moduleId,
						pattern: pattern.source,
					});
				}
			}
		}
	}

	return findings;
}

/**
 * Generate a full bundle audit report from extracted chunks.
 */
export function generateAuditReport(
	chunks: ChunkInfo[],
	options: {
		chunkSizeThreshold?: number;
		totalSizeThreshold?: number;
		perFrameworkThresholds?: Partial<PerFrameworkThresholds>;
	} = {},
): BundleAuditReport {
	const chunkThreshold = options.chunkSizeThreshold ?? DEFAULT_CHUNK_THRESHOLD;

	const totalJsBytes = chunks.reduce((sum, c) => sum + c.size, 0);
	const islandJsBytes = chunks.filter((c) => c.isIsland).reduce((sum, c) => sum + c.size, 0);

	// Global threshold check (existing behavior)
	const globalOversized = new Set(
		chunks.filter((c) => c.isIsland && c.size > chunkThreshold).map((c) => c.fileName),
	);

	// Per-framework threshold check (only when option is provided)
	const frameworkOversized = new Set<string>();
	if (options.perFrameworkThresholds) {
		const thresholds = { ...DEFAULT_PER_FRAMEWORK_THRESHOLDS, ...options.perFrameworkThresholds };
		for (const chunk of chunks) {
			if (!chunk.isIsland) continue;
			const framework = detectFrameworkFromFileName(chunk.fileName);
			if (framework && framework in thresholds) {
				const limit = thresholds[framework as keyof PerFrameworkThresholds];
				if (chunk.size > limit) {
					frameworkOversized.add(chunk.fileName);
				}
			}
		}
	}

	// Merge: a chunk is oversized if flagged by EITHER the global OR per-framework threshold
	const allOversizedNames = new Set([...globalOversized, ...frameworkOversized]);
	const oversizedChunks = chunks.filter((c) => allOversizedNames.has(c.fileName));

	const duplicatedModules = findDuplicatedModules(chunks);

	return {
		chunks,
		totalJsBytes,
		islandJsBytes,
		oversizedChunks,
		duplicatedModules,
	};
}

/**
 * Format a byte count as a human-readable KiB string.
 */
export function formatKiB(bytes: number): string {
	return `${(bytes / 1024).toFixed(2)} KiB`;
}

/**
 * Get a display tag for a chunk based on its type.
 */
function chunkTag(chunk: ChunkInfo): string {
	if (chunk.isIsland) return " [island]";
	if (chunk.isEntry) return " [entry]";
	return "        ";
}

/**
 * Truncate a file name for display.
 */
function truncateName(name: string, maxLen: number): string {
	if (name.length <= maxLen) return name;
	return `...${name.slice(-(maxLen - 3))}`;
}

/**
 * Format the audit report as a human-readable string for console output.
 */
export function formatAuditReport(report: BundleAuditReport): string {
	const lines: string[] = [
		"┌─────────────────────────────────────────────────────┐",
		"│  Bundle Audit Report                                │",
		"├─────────────────────────────────────────────────────┤",
		`│  Total JS:    ${formatKiB(report.totalJsBytes).padStart(12)}                       │`,
		`│  Island JS:   ${formatKiB(report.islandJsBytes).padStart(12)}                       │`,
		`│  Chunks:      ${String(report.chunks.length).padStart(12)}                       │`,
		"├─────────────────────────────────────────────────────┤",
		"│  Chunks by size:                                    │",
	];

	for (const chunk of report.chunks) {
		const tag = chunkTag(chunk);
		const name = truncateName(chunk.fileName, 32);
		lines.push(`│  ${tag} ${name.padEnd(32)} ${formatKiB(chunk.size).padStart(10)} │`);
	}

	if (report.oversizedChunks.length > 0) {
		lines.push("├─────────────────────────────────────────────────────┤");
		lines.push("│  Oversized island chunks:                           │");
		for (const chunk of report.oversizedChunks) {
			lines.push(`│    ${chunk.fileName.padEnd(38)} ${formatKiB(chunk.size).padStart(10)} │`);
		}
	}

	if (report.duplicatedModules.length > 0) {
		lines.push("├─────────────────────────────────────────────────────┤");
		lines.push(
			`│  Duplicated modules: ${report.duplicatedModules.length}                            │`,
		);
		for (const dup of report.duplicatedModules.slice(0, 5)) {
			const shortId = truncateName(dup.moduleId, 40);
			lines.push(`│    ${shortId.padEnd(40)} x${dup.chunks.length}        │`);
		}
		if (report.duplicatedModules.length > 5) {
			lines.push(
				`│    ... and ${report.duplicatedModules.length - 5} more                              │`,
			);
		}
	}

	lines.push("└─────────────────────────────────────────────────────┘");
	return lines.join("\n");
}

// ─── Vite Build Configuration Audit ──────────────────────────────────────────

/** Result of auditing the Vite build configuration. */
export interface BuildConfigAudit {
	/** Whether build.minify is set to a production minifier. */
	hasMinify: boolean;
	/** The minify setting value. */
	minifyValue: string | boolean;
	/** Whether build.target is set for modern browsers. */
	hasModernTarget: boolean;
	/** The build target value. */
	targetValue: string | string[];
	/** Whether process.env.NODE_ENV is defined for dead code elimination. */
	hasNodeEnvDefine: boolean;
	/** Whether treeshake config is present in rollupOptions. */
	hasTreeshakeConfig: boolean;
	/** List of issues found. */
	issues: string[];
	/** List of optimizations already in place. */
	optimizations: string[];
}

/**
 * Audit a Vite resolved config for optimal production tree-shaking settings.
 */
export function auditBuildConfig(config: {
	build?: {
		minify?: string | boolean;
		target?: string | string[];
		rollupOptions?: {
			treeshake?: unknown;
		};
	};
	define?: Record<string, unknown>;
}): BuildConfigAudit {
	const issues: string[] = [];
	const optimizations: string[] = [];

	// Check minify
	const minifyValue = config.build?.minify ?? "esbuild";
	const hasMinify = minifyValue !== false;
	if (hasMinify) {
		optimizations.push(`Minification enabled: ${minifyValue}`);
	} else {
		issues.push("build.minify is disabled — production builds should be minified");
	}

	// Check target
	const targetValue = config.build?.target ?? "modules";
	const hasModernTarget = targetValue !== "es5" && targetValue !== "es3";
	if (hasModernTarget) {
		optimizations.push(`Modern build target: ${JSON.stringify(targetValue)}`);
	} else {
		issues.push(
			`build.target is "${targetValue}" — consider "es2020" or higher for smaller output`,
		);
	}

	// Check NODE_ENV define
	const define = config.define ?? {};
	const hasNodeEnvDefine =
		"process.env.NODE_ENV" in define || "__DEV__" in define || "__PROD__" in define;
	if (hasNodeEnvDefine) {
		optimizations.push(
			"process.env.NODE_ENV / __DEV__ / __PROD__ defined for dead code elimination",
		);
	} else {
		issues.push("No process.env.NODE_ENV define — dev-only code may leak into production");
	}

	// Check treeshake config
	const hasTreeshakeConfig = config.build?.rollupOptions?.treeshake != null;
	if (hasTreeshakeConfig) {
		optimizations.push("Custom treeshake.moduleSideEffects configured");
	} else {
		issues.push("No custom treeshake config — solid-js may not be fully tree-shaken");
	}

	return {
		hasMinify,
		minifyValue,
		hasModernTarget,
		targetValue,
		hasNodeEnvDefine,
		hasTreeshakeConfig,
		issues,
		optimizations,
	};
}

// ─── Vite Plugin ─────────────────────────────────────────────────────────────

/**
 * Creates a Vite plugin that reports bundle size after production builds.
 *
 * - Logs a summary of all chunks and their sizes
 * - Warns if any island chunk exceeds the configured threshold
 * - Reports total JS payload size
 * - Audits the resolved Vite config for optimal tree-shaking settings
 */
export function bundleAuditPlugin(options: BundleAuditOptions = {}): Plugin {
	const {
		chunkSizeThreshold = DEFAULT_CHUNK_THRESHOLD,
		totalSizeThreshold = DEFAULT_TOTAL_THRESHOLD,
		logReport = true,
		warnOnOversized = true,
		perFrameworkThresholds,
		benchmarkBaseline,
		regressionThreshold,
	} = options;

	let isBuild = false;

	return {
		name: "avalon:bundle-audit",
		enforce: "post",

		config(_config, { command }) {
			isBuild = command === "build";
		},

		configResolved(resolvedConfig) {
			if (!isBuild) return;

			if (logReport) {
				const buildConfig = resolvedConfig.build;
				// Use unknown cast to safely access rollupOptions which may be deprecated
				const buildAny = buildConfig as unknown as Record<string, unknown>;
				const rollupOpts = buildAny?.rollupOptions as Record<string, unknown> | undefined;
				const audit = auditBuildConfig({
					build: {
						minify: buildConfig?.minify as string | boolean | undefined,
						target: buildConfig?.target as string | string[] | undefined,
						rollupOptions: {
							treeshake: rollupOpts?.treeshake,
						},
					},
					define: resolvedConfig.define,
				});

				if (audit.issues.length > 0) {
					for (const issue of audit.issues) {
						console.warn(`⚠️  [bundle-audit] ${issue}`);
					}
				}
			}
		},

		generateBundle(_outputOptions, bundle) {
			if (!isBuild) return;

			const chunks = extractChunks(bundle as unknown as Record<string, BundleAsset>);

			const report = generateAuditReport(chunks, {
				chunkSizeThreshold,
				totalSizeThreshold,
				perFrameworkThresholds,
			});

			if (logReport) {
				console.log(formatAuditReport(report));
			}

			// Warn on oversized island chunks
			if (warnOnOversized && report.oversizedChunks.length > 0) {
				for (const chunk of report.oversizedChunks) {
					this.warn(
						`Island chunk "${chunk.fileName}" is ${formatKiB(chunk.size)} ` +
							`(threshold: ${formatKiB(chunkSizeThreshold)})`,
					);
				}
			}

			// Warn on total size exceeding threshold
			if (warnOnOversized && report.totalJsBytes > totalSizeThreshold) {
				this.warn(
					`Total JS size ${formatKiB(report.totalJsBytes)} exceeds ` +
						`threshold of ${formatKiB(totalSizeThreshold)}`,
				);
			}

			// Check for dev-only modules in production
			const devModules = findDevOnlyModules(chunks);
			if (devModules.length > 0) {
				for (const finding of devModules) {
					this.warn(
						`Dev-only module "${finding.moduleId}" found in chunk "${finding.chunkFileName}"`,
					);
				}
			}

			// Benchmark comparison mode
			if (benchmarkBaseline) {
				try {
					const baselineJson = readFileSync(benchmarkBaseline, "utf-8");
					const baseline = BenchmarkBaselineSchema.parse(JSON.parse(baselineJson));

					// Extract island chunks and map to benchmark input format
					const currentIslands = report.chunks
						.filter((c) => c.isIsland)
						.map((c) => ({
							island: c.fileName,
							size: c.size,
							framework: detectFrameworkFromFileName(c.fileName) ?? "unknown",
						}));

					const { results, hasRegression } = compareBenchmarkBaseline(
						currentIslands,
						baseline,
						regressionThreshold,
					);

					// Log benchmark results
					for (const r of results) {
						const baselineStr = r.baselineSize != null ? formatKiB(r.baselineSize) : "N/A";
						const deltaStr = r.baselineSize != null ? `${r.deltaBytes > 0 ? "+" : ""}${r.deltaBytes}B (${r.deltaPercent.toFixed(1)}%)` : "new";
						console.log(
							`📊 [benchmark] ${r.island}: ${formatKiB(r.currentSize)} (baseline: ${baselineStr}, delta: ${deltaStr})`,
						);
					}

					if (hasRegression) {
						this.error(
							"Bundle size regression detected — one or more islands exceed the baseline by more than the allowed threshold",
						);
					}
				} catch (err) {
					if ((err as NodeJS.ErrnoException).code === "ENOENT") {
						this.warn(`Benchmark baseline file not found: ${benchmarkBaseline}`);
					} else {
						throw err;
					}
				}
			}
		},
	};
}
