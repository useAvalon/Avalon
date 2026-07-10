/**
 * Build script for @useavalon/mcp
 *
 * 1. Compiles the TypeScript sources (mod.ts, src/, bin/) to minified
 *    JavaScript in dist/, rewriting `.ts` import specifiers to `.js`.
 * 2. Rewrites package.json `exports`, `bin`, and `files` for dist-only
 *    publishing (a backup is written to package.json.bak).
 *
 * Mirrors the approach used by @useavalon/agent-optimization.
 */

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { minify } from "oxc-minify";
import { transform } from "oxc-transform";

const ROOT = join(import.meta.dir, "..");
const SRC_DIR = join(ROOT, "src");
const BIN_DIR = join(ROOT, "bin");
const DIST_DIR = join(ROOT, "dist");

const SKIP_DIRS = new Set(["__tests__", "node_modules"]);
const SKIP_FILES = (name: string) => name.endsWith(".test.ts");

async function collectFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) files.push(...(await collectFiles(full)));
		} else if (!SKIP_FILES(entry.name)) {
			files.push(full);
		}
	}
	return files;
}

function rewriteTsToJs(code: string): string {
	return code
		.replaceAll(/(from\s+['"])([^'"]+)\.ts(['"])/g, "$1$2.js$3")
		.replaceAll(/(import\s*\(\s*['"])([^'"]+)\.ts(['"]\s*\))/g, "$1$2.js$3")
		.replaceAll(/(import\s+['"])([^'"]+)\.ts(['"])/g, "$1$2.js$3");
}

async function build() {
	await rm(DIST_DIR, { recursive: true, force: true });

	const modFile = join(ROOT, "mod.ts");
	const srcFiles = await collectFiles(SRC_DIR);
	const binFiles = await collectFiles(BIN_DIR);
	let compiled = 0;

	const relOf = (file: string): string => {
		if (file === modFile) return "mod.ts";
		if (file.startsWith(SRC_DIR)) return join("src", relative(SRC_DIR, file));
		return join("bin", relative(BIN_DIR, file));
	};

	for (const file of [modFile, ...srcFiles, ...binFiles]) {
		const rel = relOf(file);
		await mkdir(join(DIST_DIR, dirname(rel)), { recursive: true });

		if (extname(file) !== ".ts") continue;

		const code = await readFile(file, "utf-8");
		if (file.endsWith(".d.ts")) {
			await writeFile(join(DIST_DIR, rel), code, "utf-8");
			continue;
		}

		const result = await transform(file, code, {
			sourcemap: false,
			typescript: { onlyRemoveTypeImports: false },
		});
		const output = rewriteTsToJs(result.code);
		const outRel = rel.replace(/\.ts$/, ".js");
		const min = await minify(outRel, output);
		// Preserve the shebang on the binary entry so it stays executable.
		const isBin = rel.startsWith("bin/");
		const finalCode = isBin ? `#!/usr/bin/env node\n${min.code}` : min.code;
		await writeFile(join(DIST_DIR, outRel), finalCode, "utf-8");
		compiled++;
	}

	console.log(`✓ Compiled ${compiled} files to dist/`);

	// Rewrite package.json for publish.
	const pkgPath = join(ROOT, "package.json");
	const raw = await readFile(pkgPath, "utf-8");
	const pkg = JSON.parse(raw);

	if (pkg.exports?.["."]?.startsWith("./dist/")) {
		console.log("✓ package.json already rewritten, skipping");
		return;
	}

	await writeFile(join(ROOT, "package.json.bak"), raw, "utf-8");

	const toDist = (value: string): string =>
		`./dist/${value.replace(/^\.\//, "").replace(/\.ts$/, ".js")}`;

	if (pkg.exports) {
		for (const [key, value] of Object.entries(pkg.exports)) {
			if (typeof value === "string") pkg.exports[key] = toDist(value);
		}
	}
	if (pkg.bin) {
		for (const [key, value] of Object.entries(pkg.bin)) {
			if (typeof value === "string") pkg.bin[key] = toDist(value);
		}
	}
	pkg.files = ["dist/**/*.js", "dist/**/*.d.ts", "README.md"];

	await writeFile(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`, "utf-8");
	console.log("✓ Rewrote package.json for publish");
}

await build();
