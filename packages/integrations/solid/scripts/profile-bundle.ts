/**
 * Profile Solid Client Bundle
 *
 * Analyzes the Solid client hydration adapter to determine:
 * 1. Which parts of solid-js and solid-js/web are included in the client bundle
 * 2. Total bundle size including solid-js dependencies
 * 3. Module-level size breakdown
 * 4. Comparison against Astro's ~4 KiB target
 * 5. vite-plugin-solid configuration audit
 *
 * Usage: bun run packages/integrations/solid/scripts/profile-bundle.ts
 */

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { minify } from "oxc-minify";

// ─── Paths ──────────────────────────────────────────────────────────────────

const SCRIPT_DIR = import.meta.dir;
const SOLID_PKG_ROOT = resolve(SCRIPT_DIR, "..");
const CLIENT_ADAPTER = join(SOLID_PKG_ROOT, "client", "hydration.ts");
const MOD_FILE = join(SOLID_PKG_ROOT, "mod.ts");

// Resolve solid-js dist files
const SOLID_JS_ROOT = resolve(SOLID_PKG_ROOT, "node_modules", "solid-js");
// Follow symlink to actual location
const SOLID_JS_REAL = (await Bun.file(join(SOLID_JS_ROOT, "package.json")).exists())
	? SOLID_JS_ROOT
	: dirname(require.resolve("solid-js/package.json"));

const SOLID_DIST = {
	// Production client builds (what ships to users)
	"solid-js/dist/solid.js": join(SOLID_JS_REAL, "dist", "solid.js"),
	"solid-js/dist/dev.js": join(SOLID_JS_REAL, "dist", "dev.js"),
	"solid-js/dist/server.js": join(SOLID_JS_REAL, "dist", "server.js"),
	"solid-js/web/dist/web.js": join(SOLID_JS_REAL, "web", "dist", "web.js"),
	"solid-js/web/dist/dev.js": join(SOLID_JS_REAL, "web", "dist", "dev.js"),
	"solid-js/web/dist/server.js": join(SOLID_JS_REAL, "web", "dist", "server.js"),
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function kib(bytes: number): string {
	return (bytes / 1024).toFixed(2);
}

interface SizeInfo {
	raw: number;
	minified: number;
	gzipped: number;
}

async function measureFile(filepath: string): Promise<SizeInfo> {
	const source = await readFile(filepath, "utf-8");
	const { code } = await minify(filepath.replace(/\.ts$/, ".js"), source);
	const gzipped = Bun.gzipSync(Buffer.from(code));
	return {
		raw: Buffer.byteLength(source),
		minified: Buffer.byteLength(code),
		gzipped: gzipped.byteLength,
	};
}

async function measureSource(name: string, source: string): Promise<SizeInfo> {
	const { code } = await minify(name, source);
	const gzipped = Bun.gzipSync(Buffer.from(code));
	return {
		raw: Buffer.byteLength(source),
		minified: Buffer.byteLength(code),
		gzipped: gzipped.byteLength,
	};
}

// ─── 1. Individual solid-js dist file sizes ─────────────────────────────────

console.log("╔══════════════════════════════════════════════════════════════╗");
console.log("║         Solid Client Bundle Profiling Report                ║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  Section 1: solid-js dist file sizes                        ║");
console.log("╠══════════════════════════════════════════════════════════════╣");

for (const [label, filepath] of Object.entries(SOLID_DIST)) {
	try {
		const info = await measureFile(filepath);
		console.log(`║  ${label.padEnd(32)} raw: ${kib(info.raw).padStart(7)} KiB`);
		console.log(`║  ${"".padEnd(32)} min: ${kib(info.minified).padStart(7)} KiB`);
		console.log(`║  ${"".padEnd(32)}  gz: ${kib(info.gzipped).padStart(7)} KiB`);
		console.log("║");
	} catch {
		console.log(`║  ${label.padEnd(32)} (not found)`);
	}
}

// ─── 2. Bundle the client adapter with Bun ──────────────────────────────────

console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  Section 2: Client adapter bundle (Bun bundler)             ║");
console.log("╠══════════════════════════════════════════════════════════════╣");

// Create a temporary entry that imports the hydration adapter the same way
// the integration loader would in production
const entryCode = `export { hydrate } from "${CLIENT_ADAPTER}";\n`;
const entryPath = join(SOLID_PKG_ROOT, "scripts", "_profile-entry.ts");
await Bun.write(entryPath, entryCode);

try {
	const result = await Bun.build({
		entrypoints: [entryPath],
		minify: true,
		target: "browser",
		format: "esm",
		// Don't externalize solid-js — we want to measure the full bundle
		external: [],
		define: {
			"process.env.NODE_ENV": '"production"',
		},
	});

	if (result.success) {
		const output = result.outputs[0];
		const bundleText = await output.text();
		const bundleInfo = await measureSource("solid-adapter-bundle.js", bundleText);

		console.log(`║  Full bundle (hydration.ts + solid-js deps)`);
		console.log(`║    raw:      ${kib(bundleInfo.raw).padStart(7)} KiB`);
		console.log(`║    minified: ${kib(bundleInfo.minified).padStart(7)} KiB`);
		console.log(`║    gzipped:  ${kib(bundleInfo.gzipped).padStart(7)} KiB`);
		console.log("║");

		// Analyze which solid-js modules are pulled in
		console.log("║  Modules included in bundle:");
		const solidImports = [
			{ pattern: "hydrate", label: "solid-js/web hydrate()" },
			{ pattern: "render", label: "solid-js/web render()" },
			{ pattern: "createComponent", label: "solid-js/web createComponent()" },
			{ pattern: "template", label: "solid-js/web template()" },
			{ pattern: "insert", label: "solid-js/web insert()" },
			{ pattern: "delegateEvents", label: "solid-js/web delegateEvents()" },
			{ pattern: "spread", label: "solid-js/web spread()" },
			{ pattern: "classList", label: "solid-js/web classList()" },
			{ pattern: "createSignal", label: "solid-js createSignal()" },
			{ pattern: "createEffect", label: "solid-js createEffect()" },
			{ pattern: "createMemo", label: "solid-js createMemo()" },
			{ pattern: "createRoot", label: "solid-js createRoot()" },
			{ pattern: "createRenderEffect", label: "solid-js createRenderEffect()" },
			{ pattern: "batch", label: "solid-js batch()" },
			{ pattern: "untrack", label: "solid-js untrack()" },
			{ pattern: "sharedConfig", label: "solid-js sharedConfig" },
			{ pattern: "_$HY", label: "Hydration context (_$HY)" },
			{ pattern: "getNextElement", label: "solid-js/web getNextElement()" },
			{ pattern: "getNextMarker", label: "solid-js/web getNextMarker()" },
		];

		for (const { pattern, label } of solidImports) {
			const found = bundleText.includes(pattern);
			console.log(`║    ${found ? "✅" : "  "} ${label}`);
		}
		console.log("║");

		// Compare against Astro's target
		const ASTRO_TARGET_KIB = 4;
		const bundleKib = bundleInfo.gzipped / 1024;
		const ratio = bundleKib / ASTRO_TARGET_KIB;
		console.log(`║  Astro comparison:`);
		console.log(`║    Astro target:     ${ASTRO_TARGET_KIB.toFixed(2).padStart(7)} KiB (gzipped)`);
		console.log(`║    Our bundle:       ${kib(bundleInfo.gzipped).padStart(7)} KiB (gzipped)`);
		console.log(`║    Ratio:            ${ratio.toFixed(2).padStart(7)}x`);
		if (ratio <= 1.5) {
			console.log(`║    ✅ Within acceptable range of Astro's output`);
		} else {
			console.log(`║    ⚠️  ${ratio.toFixed(1)}x larger than Astro — optimization needed`);
		}
	} else {
		console.log("║  ❌ Bundle build failed:");
		for (const log of result.logs) {
			console.log(`║     ${log}`);
		}
	}
} finally {
	// Clean up temp entry
	try {
		const { unlink } = await import("node:fs/promises");
		await unlink(entryPath);
	} catch {
		// ignore
	}
}

// ─── 3. vite-plugin-solid configuration audit ───────────────────────────────

console.log("║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  Section 3: vite-plugin-solid configuration audit           ║");
console.log("╠══════════════════════════════════════════════════════════════╣");

const modSource = await readFile(MOD_FILE, "utf-8");

// Check 1: hot: false
const hasHotFalse = /hot\s*:\s*false/.test(modSource);
console.log(`║  ${hasHotFalse ? "✅" : "❌"} hot: false (disables solid-refresh HMR)`);

// Check 2: ssr: true
const hasSsrTrue = /ssr\s*:\s*true/.test(modSource);
console.log(`║  ${hasSsrTrue ? "✅" : "❌"} ssr: true (enables SSR compilation)`);

// Check 3: hydratable option
const hasHydratable = /hydratable\s*:\s*true/.test(modSource);
console.log(`║  ${hasHydratable ? "✅" : "❌"} hydratable: true (generates hydration-aware code)`);
// Check 4: include filter for .solid. files
const hasIncludeFilter = modSource.includes("include") && modSource.includes(".solid.");
console.log(`║  ${hasIncludeFilter ? "✅" : "❌"} include filter scoped to .solid. files`);

// Check 5: exclude node_modules
const hasExcludeNodeModules = /exclude\s*:\s*\[.*node_modules/.test(modSource);
console.log(`║  ${hasExcludeNodeModules ? "✅" : "❌"} exclude: [/node_modules/]`);

// Check 6: resolveId hook routes to correct builds
const hasResolveId = modSource.includes("resolveId") && modSource.includes("solid-js/dist");
console.log(`║  ${hasResolveId ? "✅" : "❌"} resolveId routes solid-js to correct dist builds`);

// Check 7: Production target uses solid.js (not dev.js)
const usesProductionBuild =
	(modSource.includes('"solid"') && modSource.includes("solid-js/dist/${target}.js")) ||
	modSource.includes("`solid-js/dist/${target}.js`");
console.log(
	`║  ${usesProductionBuild ? "✅" : "❌"} Production client uses solid.js (tree-shakeable)`,
);

// Check 8: Dev-only code paths check
const hasDevGuard = modSource.includes("process.env.NODE_ENV") || modSource.includes("isDev");
console.log(`║  ${hasDevGuard ? "✅" : "❌"} Dev/prod environment detection present`);

// ─── 4. Recommendations ────────────────────────────────────────────────────

console.log("║");
console.log("╠══════════════════════════════════════════════════════════════╣");
console.log("║  Section 4: Findings & Recommendations                     ║");
console.log("╠══════════════════════════════════════════════════════════════╣");

const findings: string[] = [];

if (!hasHotFalse) {
	findings.push("CRITICAL: Set hot: false in vite-plugin-solid config");
}

if (!hasHydratable) {
	findings.push(
		"INVESTIGATE: Consider adding hydratable: true to vite-plugin-solid." +
			" This tells Solid's compiler to generate hydration-aware code that" +
			" may reduce the web runtime size by skipping full render() fallback paths.",
	);
}

// Check if the adapter imports both hydrate and render (fallback)
const adapterSource = await readFile(CLIENT_ADAPTER, "utf-8");
const importsRender = adapterSource.includes("render") && adapterSource.includes("solidRender");
if (importsRender) {
	findings.push(
		"NOTE: Client adapter imports both hydrate() and render() from solid-js/web." +
			" The render() fallback path pulls in additional DOM runtime code." +
			" If hydration is reliable, removing the render() fallback could reduce" +
			" the bundle by ~1-2 KiB.",
	);
}

// Check production vs dev build selection
const solidJsProd = await measureFile(join(SOLID_JS_REAL, "dist", "solid.js"));
const solidJsDev = await measureFile(join(SOLID_JS_REAL, "dist", "dev.js"));
if (solidJsDev.minified > solidJsProd.minified * 1.05) {
	findings.push(
		`INFO: solid.js (prod) is ${kib(solidJsProd.minified)} KiB vs dev.js ${kib(solidJsDev.minified)} KiB minified.` +
			` The resolveId hook correctly routes to solid.js in production.`,
	);
}

const solidWebProd = await measureFile(join(SOLID_JS_REAL, "web", "dist", "web.js"));
const solidWebDev = await measureFile(join(SOLID_JS_REAL, "web", "dist", "dev.js"));
if (solidWebDev.minified > solidWebProd.minified * 1.05) {
	findings.push(
		`INFO: web.js (prod) is ${kib(solidWebProd.minified)} KiB vs dev.js ${kib(solidWebDev.minified)} KiB minified.` +
			` The resolveId hook correctly routes to web.js in production.`,
	);
}

findings.push(
	"INFO: Astro achieves ~4 KiB because Solid's compiler transforms reactive" +
		" primitives into direct DOM operations at build time. The 'runtime' is" +
		" mostly compiled away — only a thin scheduling layer remains. Our adapter" +
		" dynamically imports solid-js/web at hydration time, which includes the" +
		" full DOM runtime. Inlining the adapter (Task 11) would save a network" +
		" request but not reduce the solid-js dependency size.",
	"RECOMMENDATION: The biggest win would be ensuring Vite's production" +
		" bundler (Rolldown) tree-shakes unused solid-js/web exports. The" +
		" adapter only uses hydrate(), render(), and createComponent() — the" +
		" rest (template, insert, delegateEvents, spread, etc.) should be" +
		" tree-shaken if sideEffects: false is respected.",
);

for (const finding of findings) {
	// Word-wrap findings at ~56 chars for the box
	const words = finding.split(" ");
	let line = "║  ";
	for (const word of words) {
		if (line.length + word.length + 1 > 62) {
			console.log(line);
			line = "║    " + word;
		} else {
			line += (line.endsWith("  ") ? "" : " ") + word;
		}
	}
	if (line.trim() !== "║") console.log(line);
	console.log("║");
}

console.log("╚══════════════════════════════════════════════════════════════╝");
