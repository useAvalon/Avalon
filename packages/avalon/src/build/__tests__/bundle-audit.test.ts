import { describe, expect, it, vi } from "vitest";
import {
	auditBuildConfig,
	type BenchmarkBaseline,
	type BundleAsset,
	bundleAuditPlugin,
	type ChunkInfo,
	compareBenchmarkBaseline,
	DEFAULT_CHUNK_THRESHOLD,
	DEFAULT_TOTAL_THRESHOLD,
	extractChunks,
	findDevOnlyModules,
	findDuplicatedModules,
	formatAuditReport,
	formatKiB,
	generateAuditReport,
} from "../bundle-audit.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeChunk(
	fileName: string,
	code: string,
	moduleIds: string[] = [],
	isEntry = false,
): BundleAsset {
	return {
		type: "chunk",
		fileName,
		code,
		moduleIds,
		isEntry,
	};
}

function makeBundle(
	entries: Array<{ fileName: string; code: string; moduleIds?: string[]; isEntry?: boolean }>,
): Record<string, BundleAsset> {
	const bundle: Record<string, BundleAsset> = {};
	for (const entry of entries) {
		bundle[entry.fileName] = makeChunk(
			entry.fileName,
			entry.code,
			entry.moduleIds ?? [],
			entry.isEntry ?? false,
		);
	}
	return bundle;
}

// ─── extractChunks ───────────────────────────────────────────────────────────

describe("extractChunks", () => {
	it("extracts chunk info from a bundle", () => {
		const bundle = makeBundle([
			{
				fileName: "islands/Counter.js",
				code: "const a = 1;",
				moduleIds: ["/src/islands/Counter.tsx"],
			},
			{ fileName: "entry-client.js", code: "import './islands/Counter.js';", isEntry: true },
		]);

		const chunks = extractChunks(bundle);
		expect(chunks).toHaveLength(2);
		expect(chunks[0].fileName).toBeDefined();
		expect(chunks[0].size).toBeGreaterThan(0);
	});

	it("marks island chunks correctly", () => {
		const bundle = makeBundle([
			{ fileName: "islands/Counter.js", code: "x" },
			{ fileName: "vendor/lib.js", code: "y" },
		]);

		const chunks = extractChunks(bundle);
		const islandChunk = chunks.find((c) => c.fileName === "islands/Counter.js");
		const vendorChunk = chunks.find((c) => c.fileName === "vendor/lib.js");

		expect(islandChunk?.isIsland).toBe(true);
		expect(vendorChunk?.isIsland).toBe(false);
	});

	it("marks entry chunks correctly", () => {
		const bundle = makeBundle([
			{ fileName: "entry.js", code: "x", isEntry: true },
			{ fileName: "chunk.js", code: "y", isEntry: false },
		]);

		const chunks = extractChunks(bundle);
		const entry = chunks.find((c) => c.fileName === "entry.js");
		const chunk = chunks.find((c) => c.fileName === "chunk.js");

		expect(entry?.isEntry).toBe(true);
		expect(chunk?.isEntry).toBe(false);
	});

	it("sorts chunks by size descending", () => {
		const bundle = makeBundle([
			{ fileName: "small.js", code: "a" },
			{ fileName: "large.js", code: "a".repeat(1000) },
			{ fileName: "medium.js", code: "a".repeat(100) },
		]);

		const chunks = extractChunks(bundle);
		expect(chunks[0].fileName).toBe("large.js");
		expect(chunks[1].fileName).toBe("medium.js");
		expect(chunks[2].fileName).toBe("small.js");
	});

	it("skips non-chunk assets", () => {
		const bundle: Record<string, BundleAsset> = {
			"style.css": { type: "asset", fileName: "style.css" },
			"app.js": makeChunk("app.js", "const x = 1;"),
		};

		const chunks = extractChunks(bundle);
		expect(chunks).toHaveLength(1);
		expect(chunks[0].fileName).toBe("app.js");
	});

	it("falls back to modules keys when moduleIds is absent", () => {
		const bundle: Record<string, BundleAsset> = {
			"app.js": {
				type: "chunk",
				fileName: "app.js",
				code: "x",
				modules: { "/src/app.ts": {}, "/src/utils.ts": {} },
			},
		};

		const chunks = extractChunks(bundle);
		expect(chunks[0].moduleIds).toEqual(["/src/app.ts", "/src/utils.ts"]);
	});

	it("returns empty array for empty bundle", () => {
		expect(extractChunks({})).toEqual([]);
	});
});

// ─── findDuplicatedModules ───────────────────────────────────────────────────

describe("findDuplicatedModules", () => {
	it("finds modules present in multiple chunks", () => {
		const chunks: ChunkInfo[] = [
			{
				fileName: "a.js",
				size: 100,
				moduleIds: ["/src/shared.ts", "/src/a.ts"],
				isIsland: false,
				isEntry: false,
			},
			{
				fileName: "b.js",
				size: 100,
				moduleIds: ["/src/shared.ts", "/src/b.ts"],
				isIsland: false,
				isEntry: false,
			},
		];

		const dups = findDuplicatedModules(chunks);
		expect(dups).toHaveLength(1);
		expect(dups[0].moduleId).toBe("/src/shared.ts");
		expect(dups[0].chunks).toEqual(["a.js", "b.js"]);
	});

	it(String.raw`skips virtual modules (prefixed with \0)`, () => {
		const virtualPrefix = "\0";
		const chunks: ChunkInfo[] = [
			{
				fileName: "a.js",
				size: 100,
				moduleIds: [`${virtualPrefix}virtual:loader`],
				isIsland: false,
				isEntry: false,
			},
			{
				fileName: "b.js",
				size: 100,
				moduleIds: [`${virtualPrefix}virtual:loader`],
				isIsland: false,
				isEntry: false,
			},
		];

		const dups = findDuplicatedModules(chunks);
		expect(dups).toHaveLength(0);
	});

	it("returns empty array when no duplicates", () => {
		const chunks: ChunkInfo[] = [
			{ fileName: "a.js", size: 100, moduleIds: ["/src/a.ts"], isIsland: false, isEntry: false },
			{ fileName: "b.js", size: 100, moduleIds: ["/src/b.ts"], isIsland: false, isEntry: false },
		];

		expect(findDuplicatedModules(chunks)).toHaveLength(0);
	});

	it("sorts by number of chunks descending", () => {
		const chunks: ChunkInfo[] = [
			{
				fileName: "a.js",
				size: 100,
				moduleIds: ["/src/x.ts", "/src/y.ts"],
				isIsland: false,
				isEntry: false,
			},
			{
				fileName: "b.js",
				size: 100,
				moduleIds: ["/src/x.ts", "/src/y.ts"],
				isIsland: false,
				isEntry: false,
			},
			{ fileName: "c.js", size: 100, moduleIds: ["/src/x.ts"], isIsland: false, isEntry: false },
		];

		const dups = findDuplicatedModules(chunks);
		expect(dups[0].moduleId).toBe("/src/x.ts");
		expect(dups[0].chunks).toHaveLength(3);
	});
});

// ─── findDevOnlyModules ──────────────────────────────────────────────────────

describe("findDevOnlyModules", () => {
	it("flags dev.js modules in production chunks", () => {
		const chunks: ChunkInfo[] = [
			{
				fileName: "islands/Counter.js",
				size: 100,
				moduleIds: ["/node_modules/solid-js/dist/dev.js"],
				isIsland: true,
				isEntry: false,
			},
		];

		const findings = findDevOnlyModules(chunks);
		expect(findings).toHaveLength(1);
		expect(findings[0].moduleId).toContain("dev.js");
	});

	it("flags HMR-related modules", () => {
		const chunks: ChunkInfo[] = [
			{
				fileName: "app.js",
				size: 100,
				moduleIds: ["/src/client/hmr-coordinator.ts"],
				isIsland: false,
				isEntry: false,
			},
		];

		const findings = findDevOnlyModules(chunks);
		expect(findings).toHaveLength(1);
	});

	it("returns empty for clean production modules", () => {
		const chunks: ChunkInfo[] = [
			{
				fileName: "islands/Counter.js",
				size: 100,
				moduleIds: ["/node_modules/solid-js/dist/solid.js", "/src/islands/Counter.tsx"],
				isIsland: true,
				isEntry: false,
			},
		];

		expect(findDevOnlyModules(chunks)).toHaveLength(0);
	});
});

// ─── generateAuditReport ────────────────────────────────────────────────────

describe("generateAuditReport", () => {
	it("calculates total and island JS bytes", () => {
		const chunks: ChunkInfo[] = [
			{ fileName: "islands/Counter.js", size: 5000, moduleIds: [], isIsland: true, isEntry: false },
			{ fileName: "islands/Toggle.js", size: 3000, moduleIds: [], isIsland: true, isEntry: false },
			{ fileName: "entry.js", size: 2000, moduleIds: [], isIsland: false, isEntry: true },
		];

		const report = generateAuditReport(chunks);
		expect(report.totalJsBytes).toBe(10000);
		expect(report.islandJsBytes).toBe(8000);
	});

	it("identifies oversized island chunks", () => {
		const chunks: ChunkInfo[] = [
			{ fileName: "islands/Big.js", size: 25000, moduleIds: [], isIsland: true, isEntry: false },
			{ fileName: "islands/Small.js", size: 1000, moduleIds: [], isIsland: true, isEntry: false },
		];

		const report = generateAuditReport(chunks, { chunkSizeThreshold: 20000 });
		expect(report.oversizedChunks).toHaveLength(1);
		expect(report.oversizedChunks[0].fileName).toBe("islands/Big.js");
	});

	it("does not flag non-island chunks as oversized", () => {
		const chunks: ChunkInfo[] = [
			{ fileName: "vendor/huge.js", size: 50000, moduleIds: [], isIsland: false, isEntry: false },
		];

		const report = generateAuditReport(chunks, { chunkSizeThreshold: 1000 });
		expect(report.oversizedChunks).toHaveLength(0);
	});

	it("includes duplicated modules in report", () => {
		const chunks: ChunkInfo[] = [
			{
				fileName: "a.js",
				size: 100,
				moduleIds: ["/src/shared.ts"],
				isIsland: false,
				isEntry: false,
			},
			{
				fileName: "b.js",
				size: 100,
				moduleIds: ["/src/shared.ts"],
				isIsland: false,
				isEntry: false,
			},
		];

		const report = generateAuditReport(chunks);
		expect(report.duplicatedModules).toHaveLength(1);
	});
});

// ─── formatKiB ──────────────────────────────────────────────────────────────

describe("formatKiB", () => {
	it("formats bytes as KiB with 2 decimal places", () => {
		expect(formatKiB(1024)).toBe("1.00 KiB");
		expect(formatKiB(2048)).toBe("2.00 KiB");
		expect(formatKiB(512)).toBe("0.50 KiB");
	});

	it("handles zero", () => {
		expect(formatKiB(0)).toBe("0.00 KiB");
	});
});

// ─── formatAuditReport ──────────────────────────────────────────────────────

describe("formatAuditReport", () => {
	it("produces a formatted string with total and island sizes", () => {
		const report = generateAuditReport([
			{ fileName: "islands/Counter.js", size: 5120, moduleIds: [], isIsland: true, isEntry: false },
			{ fileName: "entry.js", size: 1024, moduleIds: [], isIsland: false, isEntry: true },
		]);

		const output = formatAuditReport(report);
		expect(output).toContain("Bundle Audit Report");
		expect(output).toContain("Total JS:");
		expect(output).toContain("Island JS:");
		expect(output).toContain("6.00 KiB");
		expect(output).toContain("5.00 KiB");
	});

	it("includes oversized chunk warnings", () => {
		const report = generateAuditReport(
			[{ fileName: "islands/Big.js", size: 25000, moduleIds: [], isIsland: true, isEntry: false }],
			{ chunkSizeThreshold: 20000 },
		);

		const output = formatAuditReport(report);
		expect(output).toContain("Oversized");
		expect(output).toContain("islands/Big.js");
	});

	it("includes duplicated module info", () => {
		const report = generateAuditReport([
			{
				fileName: "a.js",
				size: 100,
				moduleIds: ["/src/shared.ts"],
				isIsland: false,
				isEntry: false,
			},
			{
				fileName: "b.js",
				size: 100,
				moduleIds: ["/src/shared.ts"],
				isIsland: false,
				isEntry: false,
			},
		]);

		const output = formatAuditReport(report);
		expect(output).toContain("Duplicated modules:");
		expect(output).toContain("/src/shared.ts");
	});
});

// ─── auditBuildConfig ───────────────────────────────────────────────────────

describe("auditBuildConfig", () => {
	it("reports all optimizations for a well-configured build", () => {
		const audit = auditBuildConfig({
			build: {
				minify: "esbuild",
				target: "es2020",
				rollupOptions: {
					treeshake: { moduleSideEffects: () => true },
				},
			},
			define: {
				"process.env.NODE_ENV": '"production"',
				__DEV__: false,
			},
		});

		expect(audit.hasMinify).toBe(true);
		expect(audit.hasModernTarget).toBe(true);
		expect(audit.hasNodeEnvDefine).toBe(true);
		expect(audit.hasTreeshakeConfig).toBe(true);
		expect(audit.issues).toHaveLength(0);
		expect(audit.optimizations.length).toBeGreaterThanOrEqual(4);
	});

	it("flags disabled minification", () => {
		const audit = auditBuildConfig({
			build: { minify: false },
		});

		expect(audit.hasMinify).toBe(false);
		expect(audit.issues).toContain(
			"build.minify is disabled — production builds should be minified",
		);
	});

	it("flags legacy build target", () => {
		const audit = auditBuildConfig({
			build: { target: "es5" },
		});

		expect(audit.hasModernTarget).toBe(false);
		expect(audit.issues.some((i) => i.includes("es5"))).toBe(true);
	});

	it("flags missing NODE_ENV define", () => {
		const audit = auditBuildConfig({
			define: {},
		});

		expect(audit.hasNodeEnvDefine).toBe(false);
		expect(audit.issues.some((i) => i.includes("NODE_ENV"))).toBe(true);
	});

	it("flags missing treeshake config", () => {
		const audit = auditBuildConfig({
			build: { rollupOptions: {} },
		});

		expect(audit.hasTreeshakeConfig).toBe(false);
		expect(audit.issues.some((i) => i.includes("treeshake"))).toBe(true);
	});

	it("accepts __DEV__ as a valid NODE_ENV alternative", () => {
		const audit = auditBuildConfig({
			define: { __DEV__: false },
		});

		expect(audit.hasNodeEnvDefine).toBe(true);
	});

	it("uses sensible defaults when config is empty", () => {
		const audit = auditBuildConfig({});

		// Default minify is "esbuild" in Vite
		expect(audit.hasMinify).toBe(true);
		expect(audit.minifyValue).toBe("esbuild");
	});
});

// ─── bundleAuditPlugin ──────────────────────────────────────────────────────

describe("bundleAuditPlugin", () => {
	it("returns a plugin with the correct name", () => {
		const plugin = bundleAuditPlugin();
		expect(plugin.name).toBe("avalon:bundle-audit");
	});

	it("enforces post order", () => {
		const plugin = bundleAuditPlugin();
		expect(plugin.enforce).toBe("post");
	});

	it("activates only during build command", () => {
		const plugin = bundleAuditPlugin({ logReport: false });
		const configHook = plugin.config as Function;

		// Simulate serve command
		configHook({}, { command: "serve" });

		// generateBundle should be a no-op in serve mode
		const generateBundle = plugin.generateBundle as Function;
		// Should not throw
		generateBundle.call({ warn: vi.fn() }, {}, {});
	});

	it("accepts custom thresholds", () => {
		const plugin = bundleAuditPlugin({
			chunkSizeThreshold: 10240,
			totalSizeThreshold: 51200,
		});
		expect(plugin.name).toBe("avalon:bundle-audit");
	});
});

// ─── Constants ──────────────────────────────────────────────────────────────

describe("constants", () => {
	it("DEFAULT_CHUNK_THRESHOLD is 20 KiB", () => {
		expect(DEFAULT_CHUNK_THRESHOLD).toBe(20 * 1024);
	});

	it("DEFAULT_TOTAL_THRESHOLD is 20 KiB", () => {
		expect(DEFAULT_TOTAL_THRESHOLD).toBe(20 * 1024);
	});
});

// ─── compareBenchmarkBaseline ────────────────────────────────────────────────

function makeBaseline(
	islands: Record<string, { size: number; framework: string }>,
	astroRef = 4096,
): BenchmarkBaseline {
	return {
		version: 1,
		timestamp: new Date().toISOString(),
		islands,
		references: { astroSolidCounter: astroRef },
	};
}

describe("compareBenchmarkBaseline", () => {
	it("computes deltaBytes and deltaPercent for known islands", () => {
		const baseline = makeBaseline({
			"Counter.solid": { size: 5000, framework: "solid" },
		});
		const current = [{ island: "Counter.solid", size: 5500, framework: "solid" }];

		const { results } = compareBenchmarkBaseline(current, baseline);
		expect(results).toHaveLength(1);
		expect(results[0].deltaBytes).toBe(500);
		expect(results[0].deltaPercent).toBe(10);
		expect(results[0].baselineSize).toBe(5000);
		expect(results[0].currentSize).toBe(5500);
	});

	it("sets baselineSize to null and deltas to 0 for new islands", () => {
		const baseline = makeBaseline({});
		const current = [{ island: "NewIsland.preact", size: 3000, framework: "preact" }];

		const { results } = compareBenchmarkBaseline(current, baseline);
		expect(results[0].baselineSize).toBeNull();
		expect(results[0].deltaBytes).toBe(0);
		expect(results[0].deltaPercent).toBe(0);
	});

	it("includes astroReferenceSize from baseline in each result", () => {
		const baseline = makeBaseline({ "A.solid": { size: 1000, framework: "solid" } }, 4096);
		const current = [{ island: "A.solid", size: 1000, framework: "solid" }];

		const { results } = compareBenchmarkBaseline(current, baseline);
		expect(results[0].astroReferenceSize).toBe(4096);
	});

	it("flags regression when deltaBytes exceeds default threshold (500)", () => {
		const baseline = makeBaseline({ "Big.solid": { size: 5000, framework: "solid" } });
		const current = [{ island: "Big.solid", size: 5501, framework: "solid" }];

		const { hasRegression } = compareBenchmarkBaseline(current, baseline);
		expect(hasRegression).toBe(true);
	});

	it("does not flag regression when deltaBytes equals threshold", () => {
		const baseline = makeBaseline({ "Ok.solid": { size: 5000, framework: "solid" } });
		const current = [{ island: "Ok.solid", size: 5500, framework: "solid" }];

		const { hasRegression } = compareBenchmarkBaseline(current, baseline);
		expect(hasRegression).toBe(false);
	});

	it("does not flag regression when size decreased", () => {
		const baseline = makeBaseline({ "Shrunk.solid": { size: 5000, framework: "solid" } });
		const current = [{ island: "Shrunk.solid", size: 4000, framework: "solid" }];

		const { hasRegression } = compareBenchmarkBaseline(current, baseline);
		expect(hasRegression).toBe(false);
	});

	it("respects custom regressionThreshold", () => {
		const baseline = makeBaseline({ "X.vue": { size: 5000, framework: "vue" } });
		const current = [{ island: "X.vue", size: 5300, framework: "vue" }];

		// 300 byte delta, threshold 200 → regression
		expect(compareBenchmarkBaseline(current, baseline, 200).hasRegression).toBe(true);
		// 300 byte delta, threshold 400 → no regression
		expect(compareBenchmarkBaseline(current, baseline, 400).hasRegression).toBe(false);
	});

	it("handles multiple islands with mixed baseline presence", () => {
		const baseline = makeBaseline({
			"Known.solid": { size: 4000, framework: "solid" },
		});
		const current = [
			{ island: "Known.solid", size: 4200, framework: "solid" },
			{ island: "New.preact", size: 3000, framework: "preact" },
		];

		const { results, hasRegression } = compareBenchmarkBaseline(current, baseline);
		expect(results).toHaveLength(2);
		expect(results[0].baselineSize).toBe(4000);
		expect(results[1].baselineSize).toBeNull();
		expect(hasRegression).toBe(false);
	});
});
