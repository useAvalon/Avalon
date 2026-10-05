/**
 * Build script for @useavalon/avalon
 *
 * 1. Compiles all TypeScript source files to minified JavaScript in dist/.
 * 2. Rewrites package.json exports & files to point to dist/ for publishing.
 *    The postpublish hook reverts this via scripts/postpublish.ts.
 *
 * Usage: bun run scripts/build.ts
 */

import { execSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { minify } from "oxc-minify";
import { transform } from "oxc-transform";
import { preserveViteIgnore } from "../../../scripts/preserve-vite-ignore.ts";
import { rewriteImportExtensions } from "./rewrite-import-extensions.ts";

const ROOT = join(import.meta.dir, "..");
const SRC_DIR = join(ROOT, "src");
const DIST_DIR = join(ROOT, "dist");

const SKIP_DIRS = new Set(["tests", "__tests__", "node_modules"]);

function shouldSkipFile(name: string): boolean {
	return name.endsWith(".test.ts") || name.endsWith(".test.tsx") || name === "README.md";
}

async function collectFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (SKIP_DIRS.has(entry.name)) return [];
				return collectFiles(fullPath);
			}
			if (shouldSkipFile(entry.name)) return [];
			return [fullPath];
		}),
	);
	return nested.flat();
}

/** Compile the `avalon` CLI to JS. Node will not strip types from node_modules. */
async function compileBin() {
	const binSrc = join(ROOT, "bin", "avalon.ts");
	const code = await readFile(binSrc, "utf-8");
	const result = await transform(binSrc, code, {
		sourcemap: false,
		typescript: { onlyRemoveTypeImports: false },
	});
	const output = rewriteImportExtensions(result.code);
	const js = output.startsWith("#!") ? output : `#!/usr/bin/env node\n${output}`;
	await mkdir(join(DIST_DIR, "bin"), { recursive: true });
	await writeFile(join(DIST_DIR, "bin", "avalon.js"), js, "utf-8");
}

async function writeMinifiedJs(outRel: string, fileLabel: string, source: string): Promise<void> {
	const minified = await minify(fileLabel, source);
	await writeFile(join(DIST_DIR, outRel), preserveViteIgnore(minified.code), "utf-8");
}

async function compileTypeScriptFile(
	file: string,
	rel: string,
	ext: string,
): Promise<"compiled" | "copied"> {
	const code = await readFile(file, "utf-8");
	if (file.endsWith(".d.ts")) {
		await writeFile(join(DIST_DIR, rel), code, "utf-8");
		return "copied";
	}

	const result = await transform(file, code, {
		sourcemap: false,
		typescript: { onlyRemoveTypeImports: false },
		...(ext === ".tsx" && {
			jsx: {
				runtime: "automatic",
				importSource: "preact",
			},
		}),
	});

	const output = rewriteImportExtensions(result.code);
	const jsName = rel.replace(/\.tsx?$/, ".js");
	await writeMinifiedJs(jsName, file.replace(/\.tsx?$/, ".js"), output);
	return "compiled";
}

async function compileNonTypeScriptFile(
	file: string,
	rel: string,
	ext: string,
): Promise<"compiled" | "copied"> {
	const code = await readFile(file, "utf-8");
	if (ext !== ".js") {
		await writeFile(join(DIST_DIR, rel), code, "utf-8");
		return "copied";
	}

	const rewritten = rewriteImportExtensions(code);
	await writeMinifiedJs(rel, file, rewritten);
	return "compiled";
}

async function compileSourceFile(file: string, modFile: string): Promise<"compiled" | "copied"> {
	const rel = file === modFile ? "mod.ts" : join("src", relative(SRC_DIR, file));
	const ext = extname(file);
	await mkdir(join(DIST_DIR, dirname(rel)), { recursive: true });
	if (ext === ".ts" || ext === ".tsx") return compileTypeScriptFile(file, rel, ext);
	return compileNonTypeScriptFile(file, rel, ext);
}

async function compileToDistDir() {
	await rm(DIST_DIR, { recursive: true, force: true });

	const allFiles = await collectFiles(SRC_DIR);
	const modFile = join(ROOT, "mod.ts");
	const outcomes = await Promise.all(
		[modFile, ...allFiles].map((file) => compileSourceFile(file, modFile)),
	);

	const compiled = outcomes.filter((outcome) => outcome === "compiled").length;
	const copied = outcomes.length - compiled;

	await compileBin();
	console.log(`✓ Compiled ${compiled} files, copied ${copied} files to dist/`);

	const distFiles = await collectFiles(DIST_DIR);
	const totalSize = await Promise.all(distFiles.map(async (f) => (await readFile(f)).byteLength));
	const total = totalSize.reduce((a, b) => a + b, 0);
	console.log(`✓ dist/ contains ${distFiles.length} files (${(total / 1024).toFixed(1)} kB)`);
}

type PublishPkg = {
	main?: string;
	module?: string;
	exports?: Record<string, unknown>;
	typesVersions?: { "*": Record<string, string[]> };
	bin?: Record<string, string>;
	files?: string[];
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	overrides?: Record<string, string>;
};

function toDistPath(value: string, keepExt = false): string {
	const stripped = value.replace(/^\.\//, "");
	return keepExt ? `./dist/${stripped}` : `./dist/${stripped.replace(/\.tsx?$/, ".js")}`;
}

function isAlreadyRewritten(pkg: PublishPkg): boolean {
	const mainExport = pkg.exports?.["."];
	if (typeof mainExport === "string") return mainExport.startsWith("./dist/");
	return (
		typeof mainExport === "object" &&
		mainExport !== null &&
		"default" in mainExport &&
		typeof mainExport.default === "string" &&
		mainExport.default.startsWith("./dist/")
	);
}

function rewriteExports(pkg: PublishPkg): void {
	if (!pkg.exports) return;
	for (const [key, value] of Object.entries(pkg.exports)) {
		if (typeof value !== "string") continue;
		if (value.endsWith(".d.ts")) {
			pkg.exports[key] = toDistPath(value, true);
			continue;
		}
		const jsPath = toDistPath(value);
		pkg.exports[key] = { types: jsPath.replace(/\.js$/, ".d.ts"), default: jsPath };
	}
}

function rewriteTypesVersions(pkg: PublishPkg): void {
	const star = pkg.typesVersions?.["*"];
	if (!star) return;
	for (const [key, paths] of Object.entries(star)) {
		star[key] = paths.map((p) => toDistPath(p, true));
	}
}

function rewriteBin(pkg: PublishPkg): void {
	if (!pkg.bin) return;
	for (const [name, value] of Object.entries(pkg.bin)) {
		pkg.bin[name] = toDistPath(value);
	}
}

async function resolveWorkspaceVersion(
	name: string,
	spec: string,
	monorepoRoot: string,
): Promise<string | null> {
	const prefix = spec.replace("workspace:", "") || "^";
	const shortName = name.replace(/^@useavalon\//, "");
	const candidates = [
		join(monorepoRoot, "packages", "integrations", shortName, "package.json"),
		join(monorepoRoot, "packages", shortName, "package.json"),
	];
	const resolvedFromCandidates = await Promise.all(
		candidates.map(async (candidate) => {
			try {
				const depPkg = JSON.parse(await readFile(candidate, "utf-8")) as {
					name: string;
					version: string;
				};
				if (depPkg.name !== name) return null;
				return prefix === "*" ? `>=${depPkg.version}` : `${prefix}${depPkg.version}`;
			} catch {
				return null;
			}
		}),
	);
	return resolvedFromCandidates.find((value) => value !== null) ?? null;
}

async function resolveWorkspaceDeps(pkg: PublishPkg): Promise<void> {
	const monorepoRoot = join(ROOT, "..", "..");
	type WorkspaceDep = {
		deps: Record<string, string>;
		name: string;
		version: string;
	};
	const pending: WorkspaceDep[] = [];
	for (const depField of ["dependencies", "devDependencies", "peerDependencies"] as const) {
		const deps = pkg[depField];
		if (!deps) continue;
		for (const [name, version] of Object.entries(deps)) {
			if (version.startsWith("workspace:")) pending.push({ deps, name, version });
		}
	}

	await Promise.all(
		pending.map(async ({ deps, name, version }) => {
			const resolved = await resolveWorkspaceVersion(name, version, monorepoRoot);
			if (!resolved) {
				console.warn(`  ⚠ Could not resolve ${name}: ${version}`);
				return;
			}
			deps[name] = resolved;
			console.log(`  ✓ Resolved ${name}: ${version} → ${resolved}`);
		}),
	);
}

async function rewritePackageJsonForPublish() {
	const pkgPath = join(ROOT, "package.json");
	const raw = await readFile(pkgPath, "utf-8");
	const pkg = JSON.parse(raw) as PublishPkg;

	if (isAlreadyRewritten(pkg)) {
		console.log("✓ package.json already rewritten for publish, skipping");
		return;
	}

	await writeFile(join(ROOT, "package.json.bak"), raw, "utf-8");
	rewriteExports(pkg);
	rewriteTypesVersions(pkg);
	rewriteBin(pkg);
	const mainEntry = "./dist/mod.js";
	pkg.main = mainEntry;
	pkg.module = mainEntry;
	pkg.files = ["dist/**/*.js", "dist/**/*.d.ts", "README.md"];
	await resolveWorkspaceDeps(pkg);
	await writeFile(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`, "utf-8");
	console.log("✓ Rewrote package.json exports → dist/ for publish");
}

function exportPathToDeclaration(exportPath: string): string | null {
	const normalized = exportPath.replace(/^\.\//, "");
	if (normalized.endsWith(".d.ts")) return normalized;
	if (normalized.endsWith(".ts") || normalized.endsWith(".tsx")) {
		return normalized.replace(/\.tsx?$/, ".d.ts");
	}
	if (normalized.endsWith(".js")) return normalized.replace(/\.js$/, ".d.ts");
	return null;
}

function declarationIncludeFromExports(exportsMap: Record<string, string>): string[] {
	const include = new Set<string>(["mod.ts"]);
	for (const value of Object.values(exportsMap)) {
		if (typeof value !== "string") continue;
		const normalized = value.replace(/^\.\//, "");
		if (normalized.endsWith(".d.ts") || normalized.endsWith(".ts") || normalized.endsWith(".tsx")) {
			include.add(normalized);
		}
	}
	return [...include].sort((a, b) => a.localeCompare(b));
}

function declarationRootsFromExports(exportsMap: Record<string, string>): string[] {
	const roots = new Set<string>(["mod.d.ts"]);
	for (const value of Object.values(exportsMap)) {
		if (typeof value !== "string") continue;
		const decl = exportPathToDeclaration(value);
		if (decl) roots.add(decl);
	}
	return [...roots].sort((a, b) => a.localeCompare(b));
}

const FROM_RELATIVE = /\bfrom\s+["'](\.\.?\/[^"']+)["']/g;
const EXPORT_FROM_RELATIVE = /export\s+\*\s+from\s+["'](\.\.?\/[^"']+)["']/g;

function relativeImportsInDeclaration(source: string): string[] {
	return [FROM_RELATIVE, EXPORT_FROM_RELATIVE].flatMap((pattern) => {
		pattern.lastIndex = 0;
		return Array.from(source.matchAll(pattern), (match) => match[1]);
	});
}

async function collectDeclarationPaths(distDir: string): Promise<string[]> {
	async function walk(dir: string): Promise<string[]> {
		const entries = await readdir(dir, { withFileTypes: true });
		const nested = await Promise.all(
			entries.map(async (entry) => {
				const full = join(dir, entry.name);
				if (entry.isDirectory()) return walk(full);
				if (entry.name.endsWith(".d.ts")) return [relative(distDir, full)];
				return [];
			}),
		);
		return nested.flat();
	}
	return walk(distDir);
}

function resolveRelativeDeclaration(fromFile: string, spec: string): string {
	const stem = spec.replace(/\.(?:tsx?|jsx?|mjs|cjs)$/, "");
	return join(dirname(fromFile), `${stem}.d.ts`);
}

async function pruneOrphanDeclarations(
	distDir: string,
	roots: string[],
): Promise<{ kept: number; removed: number }> {
	const existing = await collectDeclarationPaths(distDir);
	const existingSet = new Set(existing);
	const contents = new Map(
		await Promise.all(
			existing.map(async (rel) => [rel, await readFile(join(distDir, rel), "utf-8")] as const),
		),
	);

	const reachable = new Set<string>();
	const visitDeclaration = (rel: string): void => {
		if (reachable.has(rel) || !existingSet.has(rel)) return;
		reachable.add(rel);
		for (const spec of relativeImportsInDeclaration(contents.get(rel) ?? "")) {
			visitDeclaration(resolveRelativeDeclaration(rel, spec));
		}
	};
	for (const root of roots) visitDeclaration(root);

	const toRemove = existing.filter((rel) => !reachable.has(rel));
	await Promise.all(toRemove.map((rel) => rm(join(distDir, rel), { force: true })));
	return { kept: reachable.size, removed: toRemove.length };
}

async function generateDeclarations(exportsMap: Record<string, string>) {
	const include = declarationIncludeFromExports(exportsMap);
	const tsconfigBuild = {
		compilerOptions: {
			target: "ESNext",
			module: "ESNext",
			moduleResolution: "bundler",
			declaration: true,
			emitDeclarationOnly: true,
			outDir: "./dist",
			rootDir: ".",
			strict: false,
			skipLibCheck: true,
			jsx: "react-jsx",
			jsxImportSource: "preact",
			allowArbitraryExtensions: true,
			allowImportingTsExtensions: true,
			paths: {
				"@useavalon/core": ["./node_modules/@useavalon/core"],
			},
		},
		include,
		exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/tests/**", "src/**/__tests__/**"],
	};

	const tsconfigPath = join(ROOT, "tsconfig.build.json");
	await writeFile(tsconfigPath, JSON.stringify(tsconfigBuild, null, 2), "utf-8");

	try {
		const tsc = join(ROOT, "..", "..", "node_modules", ".bin", "tsc");
		execSync(`"${tsc}" --project tsconfig.build.json`, { cwd: ROOT, stdio: "inherit" });
		const roots = declarationRootsFromExports(exportsMap);
		const { kept, removed } = await pruneOrphanDeclarations(DIST_DIR, roots);
		const prunedNote = removed > 0 ? `, ${removed} pruned` : "";
		console.log(`✓ Generated declaration files (${kept} kept${prunedNote})`);
	} finally {
		await rm(tsconfigPath, { force: true });
	}
}

const pkgForDeclarations = JSON.parse(
	await readFile(join(ROOT, "package.json"), "utf-8"),
) as PublishPkg;

await compileToDistDir();
await generateDeclarations((pkgForDeclarations.exports ?? {}) as Record<string, string>);
await rewritePackageJsonForPublish();
