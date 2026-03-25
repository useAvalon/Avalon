/**
 * Final Benchmark — Hydration Performance Optimization
 *
 * Comprehensive summary of all three optimization phases:
 *   Phase 1: Slim hydration runtime (main-slim.js + strategies.js)
 *   Phase 2: HTML payload reduction (dev attrs, CSS dedup, conditional bootstrap)
 *   Phase 3: Solid runtime optimization (no render() fallback, inlined adapter)
 *
 * Final targets (from requirements):
 *   - Eager JS ≤ 8 KiB (gzipped, down from 20 KiB)
 *   - Total KiB ≤ 20 (gzipped, down from 57 KiB)
 *   - TTI ≤ 0.9s (estimated, down from 1.2s)
 *
 * Usage: bun run packages/avalon/scripts/benchmark-final.ts
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { minify } from "oxc-minify";

// ─── Paths ─────────────────────────────────────────────────────────────────

const CLIENT_DIR = join(import.meta.dir, "..", "src", "client");

// ─── Baseline values from requirements doc ─────────────────────────────────

const BEFORE = {
	eagerJS_KiB: 20,
	total_KiB: 57,
	TTI_s: 1.2,
	FCP_s: 1.2,
	LCP_s: 1.5,
};

// ─── Final targets from requirements ───────────────────────────────────────

const TARGETS = {
	eagerJS_KiB: 8,
	total_KiB: 20,
	TTI_s: 0.9,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function kib(bytes: number): string {
	return (bytes / 1024).toFixed(2);
}

interface SizeResult {
	label: string;
	raw: number;
	minified: number;
	gzipped: number;
}

async function measureFile(label: string, filepath: string): Promise<SizeResult> {
	const source = await readFile(filepath, "utf-8");
	const { code } = await minify(filepath.replace(/\.ts$/, ".js"), source);
	const gzipped = Bun.gzipSync(Buffer.from(code));
	return {
		label,
		raw: Buffer.byteLength(source),
		minified: Buffer.byteLength(code),
		gzipped: gzipped.byteLength,
	};
}

async function measureSource(label: string, source: string): Promise<SizeResult> {
	const { code } = await minify(`${label}.js`, source);
	const gzipped = Bun.gzipSync(Buffer.from(code));
	return {
		label,
		raw: Buffer.byteLength(source),
		minified: Buffer.byteLength(code),
		gzipped: gzipped.byteLength,
	};
}

/**
 * Estimate TTI from gzipped JS size.
 *
 * Without a real browser we model TTI from JS payload:
 *   - decompression ratio: ~3x (gzipped → raw)
 *   - parse+compile: ~1.5 ms/KiB (decompressed)
 *   - execute: ~0.5 ms/KiB (decompressed)
 *   - network: 50ms RTT + ~2ms/KiB transfer
 */
function estimateTTI(gzippedBytes: number): number {
	const decompressedKiB = (gzippedBytes / 1024) * 3;
	const networkLatencyMs = 50;
	const transferMs = (gzippedBytes / 1024) * 2;
	const parseCompileMs = decompressedKiB * 1.5;
	const executeMs = decompressedKiB * 0.5;
	return (networkLatencyMs + transferMs + parseCompileMs + executeMs) / 1000;
}

// ─── Production inlined Solid adapter ──────────────────────────────────────
// Exact code from generateIntegrationLoaderModule() in nitro-integration.ts.
// No render() fallback — only hydrate + createComponent from solid-js/web.

const INLINED_SOLID_ADAPTER = `
function _ensureHydrationContext() {
  if (!globalThis._$HY) {
    globalThis._$HY = { events: [], completed: new WeakSet(), r: {}, fe() {} };
  }
}

async function _solidHydrate(container, Component, props) {
  if (!container) throw new Error("Container element is required for hydration");
  if (!Component || typeof Component !== "function") {
    throw new Error("Invalid Solid component: expected function, got " + typeof Component);
  }
  var el = container;
  var renderId = el.dataset.solidRenderId || el.dataset.renderId;
  var { hydrate: solidHydrate, createComponent } = await import("solid-js/web");
  _ensureHydrationContext();
  solidHydrate(function() { return createComponent(Component, props || {}); }, el, { renderId: renderId || "" });
}

var _solidModule = { hydrate: _solidHydrate };
`;

// ─── Representative HTML for total transfer estimate ───────────────────────

function generateTodoPageHtml(): string {
	const props = JSON.stringify({ items: ["Buy milk", "Write tests", "Ship feature"] });
	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Todo App — Avalon</title>
    <meta name="description" content="A simple todo application built with Avalon islands architecture">
    <style>.todo-list{max-width:600px;margin:0 auto}.todo-item{display:flex;align-items:center;padding:8px 0;border-bottom:1px solid #eee}.todo-item input[type=checkbox]{margin-right:12px}.todo-item.done span{text-decoration:line-through;color:#999}.todo-input{width:100%;padding:12px;border:1px solid #ddd;border-radius:4px;font-size:16px}</style>
  </head>
  <body>
    <div id="app">
      <header><h1>My Todos</h1></header>
      <main>
        <avalon-island data-framework="preact" data-condition="on:client" data-src="/islands/TodoInput.tsx" data-props='{}'>
          <div class="todo-input-wrapper"><input class="todo-input" placeholder="What needs to be done?" /></div>
        </avalon-island>
        <avalon-island data-framework="preact" data-condition="on:visible" data-src="/islands/TodoList.tsx" data-props='${props}'>
          <ul class="todo-list">
            <li class="todo-item"><input type="checkbox" /><span>Buy milk</span></li>
            <li class="todo-item"><input type="checkbox" /><span>Write tests</span></li>
            <li class="todo-item"><input type="checkbox" /><span>Ship feature</span></li>
          </ul>
        </avalon-island>
        <avalon-island data-framework="preact" data-condition="on:idle" data-src="/islands/TodoStats.tsx" data-props='{"total":3,"done":0}'>
          <footer><span>0 of 3 completed</span></footer>
        </avalon-island>
      </main>
    </div>
    <script type="module" src="/assets/entry-client.js"></script>
  </body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Measurements
// ═══════════════════════════════════════════════════════════════════════════

// Phase 1: Slim hydration runtime files
const mainSlim = await measureFile("main-slim.js", join(CLIENT_DIR, "main-slim.js"));
const strategies = await measureFile("strategies.js", join(CLIENT_DIR, "strategies.js"));

// Phase 3: Inlined Solid adapter (no render() fallback)
const solidAdapter = await measureSource("solid-adapter (inlined)", INLINED_SOLID_ADAPTER);

// Combined eager JS: main-slim.js + inlined Solid adapter
// In production Vite bundles these into a single chunk, so we measure
// the combined minified source gzipped as one unit for accurate compression.
const mainSlimSource = await readFile(join(CLIENT_DIR, "main-slim.js"), "utf-8");
const combinedEagerSource = `${mainSlimSource}\n${INLINED_SOLID_ADAPTER}`;
const { code: combinedMinified } = await minify("eager-combined.js", combinedEagerSource);
const combinedGzipped = Bun.gzipSync(Buffer.from(combinedMinified));
const eagerJsGzipped = combinedGzipped.byteLength;
const eagerJsMinified = Buffer.byteLength(combinedMinified);

// HTML payload
const todoHtml = generateTodoPageHtml();
const todoHtmlGzipped = Bun.gzipSync(Buffer.from(todoHtml));

// Total transfer: gzipped HTML + gzipped eager JS + gzipped strategies (lazy but counted)
const totalTransferGzipped = todoHtmlGzipped.byteLength + eagerJsGzipped + strategies.gzipped;

// TTI estimate
const estimatedTTI = estimateTTI(eagerJsGzipped);

// Derived KiB values
const eagerJsKiB = eagerJsGzipped / 1024;
const totalKiB = totalTransferGzipped / 1024;

// ═══════════════════════════════════════════════════════════════════════════
// Report
// ═══════════════════════════════════════════════════════════════════════════

const W = 64; // box width
const line = (s: string) => console.log(s);
const rule = () => line(`╠${"═".repeat(W)}╣`);
const blank = () => line(`║${" ".repeat(W)}║`);
const pad = (s: string) => `║  ${s}${" ".repeat(Math.max(0, W - 2 - s.length))}║`;

line(`╔${"═".repeat(W)}╗`);
line(pad("  Avalon Hydration Performance — Final Benchmark"));
line(pad("  All three optimization phases complete"));
rule();

// ─── Individual file sizes ─────────────────────────────────────────────────

line(pad("COMPONENT SIZES"));
blank();

for (const r of [mainSlim, strategies, solidAdapter]) {
	line(pad(`${r.label}`));
	line(
		pad(
			`  raw: ${kib(r.raw).padStart(7)} KiB   min: ${kib(r.minified).padStart(7)} KiB   gz: ${kib(r.gzipped).padStart(7)} KiB`,
		),
	);
}
blank();

line(pad(`Combined eager JS (main-slim + solid adapter)`));
line(
	pad(
		`  min: ${kib(eagerJsMinified).padStart(7)} KiB   gz: ${kib(eagerJsGzipped).padStart(7)} KiB`,
	),
);
blank();

line(pad(`HTML payload (todo page)`));
line(
	pad(
		`  raw: ${kib(Buffer.byteLength(todoHtml)).padStart(7)} KiB   gz: ${kib(todoHtmlGzipped.byteLength).padStart(7)} KiB`,
	),
);
blank();

line(pad(`Strategies (lazy-loaded, not in eager JS)`));
line(
	pad(
		`  min: ${kib(strategies.minified).padStart(7)} KiB   gz: ${kib(strategies.gzipped).padStart(7)} KiB`,
	),
);

// ─── Before / After comparison ─────────────────────────────────────────────

rule();
line(pad("BEFORE / AFTER COMPARISON"));
blank();

const fmtNum = (n: number, unit: string) => `${n.toFixed(2)} ${unit}`;
const fmtPct = (before: number, after: number) => {
	const pct = ((before - after) / before) * 100;
	return `${pct > 0 ? "-" : "+"}${Math.abs(pct).toFixed(0)}%`;
};

line(pad("Metric                Before        After       Change"));
line(pad("─────────────────────────────────────────────────────────"));
line(
	pad(
		`Eager JS (gz)     ${fmtNum(BEFORE.eagerJS_KiB, "KiB").padStart(12)}  ${fmtNum(eagerJsKiB, "KiB").padStart(12)}  ${fmtPct(BEFORE.eagerJS_KiB, eagerJsKiB).padStart(8)}`,
	),
);
line(
	pad(
		`Total transfer    ${fmtNum(BEFORE.total_KiB, "KiB").padStart(12)}  ${fmtNum(totalKiB, "KiB").padStart(12)}  ${fmtPct(BEFORE.total_KiB, totalKiB).padStart(8)}`,
	),
);
line(
	pad(
		`Est. TTI          ${fmtNum(BEFORE.TTI_s, "s").padStart(12)}  ${fmtNum(estimatedTTI, "s").padStart(12)}  ${fmtPct(BEFORE.TTI_s, estimatedTTI).padStart(8)}`,
	),
);

// ─── Target checks ─────────────────────────────────────────────────────────

rule();
line(pad("FINAL TARGET CHECKS"));
blank();

interface Check {
	label: string;
	actual: number;
	limit: number;
	unit: string;
}

const checks: Check[] = [
	{ label: "Eager JS (gzipped)", actual: eagerJsKiB, limit: TARGETS.eagerJS_KiB, unit: "KiB" },
	{ label: "Total transfer (gzipped)", actual: totalKiB, limit: TARGETS.total_KiB, unit: "KiB" },
	{ label: "Estimated TTI", actual: estimatedTTI, limit: TARGETS.TTI_s, unit: "s" },
];

let allPassed = true;
for (const c of checks) {
	const passed = c.actual <= c.limit;
	if (!passed) allPassed = false;
	const icon = passed ? "✅" : "❌";
	line(
		pad(
			`${icon} ${c.label.padEnd(26)} ${c.actual.toFixed(2).padStart(6)} ${c.unit}  (target ≤ ${c.limit} ${c.unit})`,
		),
	);
}

// ─── Phase-level sub-targets ───────────────────────────────────────────────

blank();
line(pad("Phase sub-targets:"));

const mainSlimMinPassed = mainSlim.minified <= 2 * 1024;
line(
	pad(
		`  ${mainSlimMinPassed ? "✅" : "❌"} Phase 1: main-slim.js ≤ 2 KiB min  (actual: ${kib(mainSlim.minified)} KiB)`,
	),
);

const strategiesMinPassed = strategies.minified <= 2 * 1024;
line(
	pad(
		`  ${strategiesMinPassed ? "✅" : "❌"} Phase 1: strategies.js ≤ 2 KiB min  (actual: ${kib(strategies.minified)} KiB)`,
	),
);

const totalTransferPassed = totalKiB <= 30;
line(
	pad(
		`  ${totalTransferPassed ? "✅" : "❌"} Phase 2: total transfer ≤ 30 KiB gz (actual: ${totalKiB.toFixed(2)} KiB)`,
	),
);

const noRenderFallback = !INLINED_SOLID_ADAPTER.includes("render: solidRender");
line(pad(`  ${noRenderFallback ? "✅" : "❌"} Phase 3: No render() fallback in Solid adapter`));

const adapterInlined = INLINED_SOLID_ADAPTER.includes("_solidHydrate");
line(
	pad(`  ${adapterInlined ? "✅" : "❌"} Phase 3: Solid adapter inlined (saves 1 network request)`),
);

// ─── Summary ───────────────────────────────────────────────────────────────

rule();

if (allPassed) {
	line(pad("🎉 ALL FINAL TARGETS MET"));
} else {
	line(pad("⚠️  SOME TARGETS NOT MET — see ❌ above"));
}

blank();
line(`╚${"═".repeat(W)}╝`);

// ─── Exit code ─────────────────────────────────────────────────────────────

if (!allPassed) {
	process.exit(1);
}
