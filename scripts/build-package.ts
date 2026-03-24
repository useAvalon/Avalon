/**
 * Shared build script for @useavalon packages.
 *
 * Compiles TypeScript to minified JavaScript in dist/ and rewrites
 * package.json exports & files for dist-only publishing.
 * Run from any package dir: bun run ../../scripts/build-package.ts
 *
 * After publish, run: bun run scripts/postpublish.ts (or the shared one)
 */

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { minify } from "oxc-minify";
import { transform } from "oxc-transform";

const ROOT = process.cwd();
const SRC_DIRS = ["src", "client", "server"];
const DIST_DIR = join(ROOT, "dist");

const SKIP_DIRS = new Set(["tests", "__tests__", "node_modules", "dist"]);

function shouldSkipFile(name: string): boolean {
	return (
		name.endsWith(".test.ts") ||
		name.endsWith(".test.tsx") ||
		name === "vitest.config.ts" ||
		name === "tsconfig.json"
	);
}

async function collectFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	try {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!SKIP_DIRS.has(entry.name)) files.push(...(await collectFiles(full)));
			} else if (!shouldSkipFile(entry.name)) {
				files.push(full);
			}
		}
	} catch {}
	return files;
}

function rewriteImportExtensions(code: string): string {
	return code
		.replaceAll(/(from\s+['"])([^'"]+)\.tsx?(['"])/g, "$1$2.js$3")
		.replaceAll(/(import\s*\(\s*['"])([^'"]+)\.tsx?(['"]\s*\))/g, "$1$2.js$3")
		.replaceAll(/(import\s+['"])([^'"]+)\.tsx?(['"])/g, "$1$2.js$3");
}

async function compileFile(file: string, rel: string): Promise<boolean> {
	const ext = extname(file);
	const outDir = join(DIST_DIR, dirname(rel));
	await mkdir(outDir, { recursive: true });

	if (ext === ".ts" || ext === ".tsx") {
		const code = await readFile(file, "utf-8");
		if (file.endsWith(".d.ts")) {
			await writeFile(join(DIST_DIR, rel), code, "utf-8");
			return false;
		}
		const result = await transform(file, code, {
			sourcemap: false,
			typescript: { onlyRemoveTypeImports: false },
		});
		const output = rewriteImportExtensions(result.code);
		const min = await minify(rel.replace(/\.tsx?$/, ".js"), output);
		await writeFile(join(DIST_DIR, rel.replace(/\.tsx?$/, ".js")), min.code, "utf-8");
		return true;
	}
	if (ext === ".js") {
		const code = await readFile(file, "utf-8");
		const min = await minify(rel, code);
		await writeFile(join(DIST_DIR, rel), min.code, "utf-8");
		return true;
	}
	const code = await readFile(file, "utf-8");
	await writeFile(join(DIST_DIR, rel), code, "utf-8");
	return false;
}

async function compileAllFiles(): Promise<number> {
	await rm(DIST_DIR, { recursive: true, force: true });

	const allFiles: Array<{ file: string; rel: string }> = [];

	for (const entry of await readdir(ROOT, { withFileTypes: true })) {
		if (entry.isFile() && /\.tsx?$/.test(entry.name) && !shouldSkipFile(entry.name)) {
			allFiles.push({ file: join(ROOT, entry.name), rel: entry.name });
		}
	}

	for (const dir of SRC_DIRS) {
		const dirPath = join(ROOT, dir);
		for (const f of await collectFiles(dirPath)) {
			allFiles.push({ file: f, rel: join(dir, relative(dirPath, f)) });
		}
	}

	let compiled = 0;
	for (const { file, rel } of allFiles) {
		if (await compileFile(file, rel)) compiled++;
	}
	return compiled;
}

async function rewritePackageJson(): Promise<void> {
	const pkgPath = join(ROOT, "package.json");
	const raw = await readFile(pkgPath, "utf-8");
	const pkg = JSON.parse(raw);

	if (pkg.exports?.["."]?.startsWith("./dist/")) {
		console.log("✓ package.json already rewritten, skipping");
		return;
	}

	await writeFile(join(ROOT, "package.json.bak"), raw, "utf-8");

	const toDistPath = (value: string, keepExt = false): string => {
		const stripped = value.replace(/^\.\//, "");
		return keepExt ? `./dist/${stripped}` : `./dist/${stripped.replace(/\.tsx?$/, ".js")}`;
	};

	if (pkg.exports) {
		for (const [key, value] of Object.entries(pkg.exports)) {
			if (typeof value === "string") {
				pkg.exports[key] = toDistPath(value, value.endsWith(".d.ts"));
			}
		}
	}

	if (pkg.typesVersions?.["*"]) {
		for (const [key, paths] of Object.entries(pkg.typesVersions["*"])) {
			if (Array.isArray(paths)) {
				pkg.typesVersions["*"][key] = (paths as string[]).map((p) => toDistPath(p, true));
			}
		}
	}

	pkg.files = ["dist/**/*.js", "dist/**/*.d.ts", "README.md"];

	// Resolve workspace: protocol references to actual versions.
	// npm doesn't understand workspace:^ or workspace:* — they must be
	// replaced with the real version from the referenced package.json.
	for (const depField of ["dependencies", "devDependencies", "peerDependencies"] as const) {
		const deps = pkg[depField];
		if (!deps) continue;
		for (const [name, version] of Object.entries(deps)) {
			if (typeof version === "string" && version.startsWith("workspace:")) {
				const prefix = version.replace("workspace:", "") || "^"; // workspace:^ → ^, workspace:* → *
				try {
					// Find the monorepo root by walking up until we find the root package.json
					let monorepoRoot = ROOT;
					for (let i = 0; i < 5; i++) {
						monorepoRoot = join(monorepoRoot, "..");
						try {
							const rootPkg = JSON.parse(
								await readFile(join(monorepoRoot, "package.json"), "utf-8"),
							);
							if (rootPkg.workspaces || rootPkg.name === "@useavalon/monorepo") break;
						} catch {}
					}
					// Try packages/integrations/<name>, packages/<name>
					const shortName = name.replace(/^@useavalon\//, "");
					const candidates = [
						join(monorepoRoot, "packages", "integrations", shortName, "package.json"),
						join(monorepoRoot, "packages", shortName, "package.json"),
					];
					let resolved = false;
					for (const candidate of candidates) {
						try {
							const depPkg = JSON.parse(await readFile(candidate, "utf-8"));
							if (depPkg.name === name) {
								const resolvedVersion =
									prefix === "*" ? `>=${depPkg.version}` : `${prefix}${depPkg.version}`;
								deps[name] = resolvedVersion;
								console.log(`  ✓ Resolved ${name}: ${version} → ${resolvedVersion}`);
								resolved = true;
								break;
							}
						} catch {}
					}
					if (!resolved) {
						console.warn(`  ⚠ Could not resolve ${name}: ${version} — leaving as-is`);
					}
				} catch {}
			}
		}
	}

	await writeFile(pkgPath, JSON.stringify(pkg, null, "\t") + "\n", "utf-8");
	console.log("✓ Rewrote package.json for publish");
}

const compiled = await compileAllFiles();
console.log(`✓ Compiled ${compiled} files to dist/`);
await rewritePackageJson();
