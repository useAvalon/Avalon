/**
 * Build script for @useavalon/agent-optimization
 *
 * 1. Compiles TypeScript to minified JavaScript in dist/.
 * 2. Rewrites package.json exports & files for dist-only publishing.
 *    Run scripts/postpublish.ts after publish to restore.
 */

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { minify } from "oxc-minify";
import { transform } from "oxc-transform";

const ROOT = join(import.meta.dir, "..");
const SRC_DIR = join(ROOT, "src");
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

async function build() {
	await rm(DIST_DIR, { recursive: true, force: true });

	const srcFiles = await collectFiles(SRC_DIR);
	const modFile = join(ROOT, "mod.ts");
	let compiled = 0;

	for (const file of [modFile, ...srcFiles]) {
		const rel = file === modFile ? "mod.ts" : join("src", relative(SRC_DIR, file));
		const ext = extname(file);
		await mkdir(join(DIST_DIR, dirname(rel)), { recursive: true });

		if (ext === ".ts") {
			const code = await readFile(file, "utf-8");
			if (file.endsWith(".d.ts")) {
				await writeFile(join(DIST_DIR, rel), code, "utf-8");
				continue;
			}
			const result = await transform(file, code, {
				sourcemap: false,
				typescript: { onlyRemoveTypeImports: false },
			});
			const output = result.code
				.replaceAll(/(from\s+['"])([^'"]+)\.ts(['"])/g, "$1$2.js$3")
				.replaceAll(/(import\s*\(\s*['"])([^'"]+)\.ts(['"]\s*\))/g, "$1$2.js$3")
				.replaceAll(/(import\s+['"])([^'"]+)\.ts(['"])/g, "$1$2.js$3");
			const min = await minify(rel.replace(/\.ts$/, ".js"), output);
			await writeFile(join(DIST_DIR, rel.replace(/\.ts$/, ".js")), min.code, "utf-8");
			compiled++;
		}
	}

	console.log(`✓ Compiled ${compiled} files to dist/`);

	// Rewrite package.json for publish
	const pkgPath = join(ROOT, "package.json");
	const raw = await readFile(pkgPath, "utf-8");
	const pkg = JSON.parse(raw);

	// The exports/files rewrite is one-way (src → dist), so skip it if a prior
	// build already did it. Dependency resolution + the safety assertion below
	// still run unconditionally — a half-rewritten manifest must never publish
	// with a leaked `workspace:` spec.
	const alreadyRewritten = pkg.exports?.["."]?.startsWith?.("./dist/") ?? false;
	if (!alreadyRewritten) {
		await writeFile(join(ROOT, "package.json.bak"), raw, "utf-8");

		if (pkg.exports) {
			for (const [key, value] of Object.entries(pkg.exports)) {
				if (typeof value === "string") {
					pkg.exports[key] = `./dist/${value.replace(/^\.\//, "").replace(/\.ts$/, ".js")}`;
				}
			}
		}
		pkg.files = ["dist/**/*.js", "dist/**/*.d.ts", "README.md"];
	}

	await resolveWorkspaceDeps(pkg);
	assertNoWorkspaceProtocol(pkg);

	await writeFile(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`, "utf-8");
	console.log("✓ Rewrote package.json for publish");
}

const DEP_FIELDS = ["dependencies", "devDependencies", "peerDependencies"] as const;

/** Read the current version of a workspace package by its npm name, or null. */
async function readWorkspaceVersion(name: string): Promise<string | null> {
	const shortName = name.replace(/^@useavalon\//, "");
	const monorepoRoot = join(ROOT, "..", "..");
	const candidates = [
		join(monorepoRoot, "packages", shortName, "package.json"),
		join(monorepoRoot, "packages", "integrations", shortName, "package.json"),
	];
	for (const candidate of candidates) {
		try {
			const depPkg = JSON.parse(await readFile(candidate, "utf-8"));
			if (depPkg.name === name) return depPkg.version;
		} catch {}
	}
	return null;
}

/**
 * Resolve `workspace:` protocol references to concrete semver ranges. npm/Node
 * don't understand `workspace:^`/`workspace:*`, so these MUST be replaced with a
 * real version from the referenced package.json before publishing.
 */
async function resolveWorkspaceDeps(pkg: Record<string, unknown>): Promise<void> {
	for (const depField of DEP_FIELDS) {
		const deps = pkg[depField] as Record<string, string> | undefined;
		if (!deps) continue;
		for (const [name, version] of Object.entries(deps)) {
			if (typeof version !== "string" || !version.startsWith("workspace:")) continue;
			const prefix = version.replace("workspace:", "") || "^"; // workspace:^ → ^, workspace:* → *
			const depVersion = await readWorkspaceVersion(name);
			if (depVersion === null) continue; // asserted below — do not silently ship
			deps[name] = prefix === "*" ? `>=${depVersion}` : `${prefix}${depVersion}`;
			console.log(`  ✓ Resolved ${name}: ${version} → ${deps[name]}`);
		}
	}
}

/**
 * Fail the build if any `workspace:` spec survived resolution. Publishing one
 * produces a package that can't be installed outside the monorepo, so we abort
 * rather than ship it.
 */
function assertNoWorkspaceProtocol(pkg: Record<string, unknown>): void {
	const leaked: string[] = [];
	for (const depField of DEP_FIELDS) {
		const deps = pkg[depField] as Record<string, string> | undefined;
		if (!deps) continue;
		for (const [name, version] of Object.entries(deps)) {
			if (typeof version === "string" && version.startsWith("workspace:")) {
				leaked.push(`${depField}.${name} = "${version}"`);
			}
		}
	}
	if (leaked.length > 0) {
		throw new Error(
			`Refusing to publish: unresolved workspace: protocol dependencies:\n  ${leaked.join(
				"\n  ",
			)}\nEnsure the referenced package(s) exist in the monorepo so the version can be resolved.`,
		);
	}
}

await build();
