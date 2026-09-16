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
import { rewriteImportExtensions } from "./rewrite-import-extensions.ts";

const ROOT = join(import.meta.dir, "..");
const SRC_DIR = join(ROOT, "src");
const DIST_DIR = join(ROOT, "dist");

const SKIP_DIRS = new Set(["tests", "__tests__", "node_modules"]);

function shouldSkipFile(name: string): boolean {
	return name.endsWith(".test.ts") || name.endsWith(".test.tsx") || name === "README.md";
}

async function collectFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) files.push(...(await collectFiles(fullPath)));
		} else if (!shouldSkipFile(entry.name)) {
			files.push(fullPath);
		}
	}
	return files;
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

async function compileToDistDir() {
	await rm(DIST_DIR, { recursive: true, force: true });

	const allFiles = await collectFiles(SRC_DIR);
	const modFile = join(ROOT, "mod.ts");
	const filesToProcess = [modFile, ...allFiles];

	let compiled = 0;
	let copied = 0;

	for (const file of filesToProcess) {
		const rel = file === modFile ? "mod.ts" : join("src", relative(SRC_DIR, file));
		const ext = extname(file);
		const outDir = join(DIST_DIR, dirname(rel));
		await mkdir(outDir, { recursive: true });

		if (ext === ".ts" || ext === ".tsx") {
			const code = await readFile(file, "utf-8");

			if (file.endsWith(".d.ts")) {
				await writeFile(join(DIST_DIR, rel), code, "utf-8");
				copied++;
				continue;
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
			const minified = await minify(file.replace(/\.tsx?$/, ".js"), output);
			const jsName = rel.replace(/\.tsx?$/, ".js");
			await writeFile(join(DIST_DIR, jsName), minified.code, "utf-8");
			compiled++;
		} else {
			const code = await readFile(file, "utf-8");
			if (ext === ".js") {
				const rewritten = rewriteImportExtensions(code);
				const minified = await minify(file, rewritten);
				await writeFile(join(DIST_DIR, rel), minified.code, "utf-8");
				compiled++;
			} else {
				await writeFile(join(DIST_DIR, rel), code, "utf-8");
				copied++;
			}
		}
	}

	await compileBin();
	console.log(`✓ Compiled ${compiled} files, copied ${copied} files to dist/`);

	const distFiles = await collectFiles(DIST_DIR);
	const totalSize = await Promise.all(distFiles.map(async (f) => (await readFile(f)).byteLength));
	const total = totalSize.reduce((a, b) => a + b, 0);
	console.log(`✓ dist/ contains ${distFiles.length} files (${(total / 1024).toFixed(1)} kB)`);
}

type PublishPkg = {
	exports?: Record<string, unknown>;
	typesVersions?: { "*": Record<string, string[]> };
	bin?: Record<string, string>;
	files?: string[];
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
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
	for (const candidate of candidates) {
		try {
			const depPkg = JSON.parse(await readFile(candidate, "utf-8")) as {
				name: string;
				version: string;
			};
			if (depPkg.name !== name) continue;
			return prefix === "*" ? `>=${depPkg.version}` : `${prefix}${depPkg.version}`;
		} catch {
			// Candidate path may not exist for this package name.
		}
	}
	return null;
}

async function resolveWorkspaceDeps(pkg: PublishPkg): Promise<void> {
	const monorepoRoot = join(ROOT, "..", "..");
	for (const depField of ["dependencies", "devDependencies", "peerDependencies"] as const) {
		const deps = pkg[depField];
		if (!deps) continue;
		for (const [name, version] of Object.entries(deps)) {
			if (!version.startsWith("workspace:")) continue;
			const resolved = await resolveWorkspaceVersion(name, version, monorepoRoot);
			if (!resolved) {
				console.warn(`  ⚠ Could not resolve ${name}: ${version}`);
				continue;
			}
			deps[name] = resolved;
			console.log(`  ✓ Resolved ${name}: ${version} → ${resolved}`);
		}
	}
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
	pkg.files = ["dist/**/*.js", "dist/**/*.d.ts", "README.md"];
	await resolveWorkspaceDeps(pkg);
	await writeFile(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`, "utf-8");
	console.log("✓ Rewrote package.json exports → dist/ for publish");
}

async function generateDeclarations() {
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
		include: ["mod.ts", "src/**/*.ts", "src/**/*.tsx"],
		exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/tests/**", "src/**/__tests__/**"],
	};

	const tsconfigPath = join(ROOT, "tsconfig.build.json");
	await writeFile(tsconfigPath, JSON.stringify(tsconfigBuild, null, 2), "utf-8");

	try {
		const tsc = join(ROOT, "..", "..", "node_modules", ".bin", "tsc");
		execSync(`"${tsc}" --project tsconfig.build.json`, { cwd: ROOT, stdio: "inherit" });
		console.log("✓ Generated declaration files");
	} finally {
		await rm(tsconfigPath, { force: true });
	}
}

await compileToDistDir();
await generateDeclarations();
await rewritePackageJsonForPublish();
