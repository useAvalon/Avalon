/**
 * Pack workspace packages, scaffold with `create-avalon --yes`, install from
 * those tarballs, and run the generated app's production build.
 *
 * Unit tests never exercise the published install path. This script is the
 * gate for a stable release: if a fresh app cannot install and build, we
 * must not publish `latest`.
 *
 * Usage: bun scripts/smoke-create-avalon.ts
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Packages a default `create-avalon --yes` app installs from the workspace. */
const PACK_TARGETS = [
	"packages/integrations/core",
	"packages/avalon",
	"packages/integrations/preact",
	"packages/seo",
	"packages/create-avalon",
] as const;

const AVALON_TARBALL_MUST_CONTAIN = [
	"package/dist/mod.js",
	"package/dist/mod.d.ts",
	"package/dist/bin/avalon.js",
];

function run(command: string, cwd: string): void {
	console.log(`$ ${command}`);
	execSync(command, { cwd, stdio: "inherit", env: process.env });
}

function npmPackBasename(name: string, version: string): string {
	return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

async function restorePackageJson(pkgDir: string): Promise<void> {
	const bak = join(pkgDir, "package.json.bak");
	const pkgPath = join(pkgDir, "package.json");
	if (!existsSync(bak)) return;
	const current = JSON.parse(await readFile(pkgPath, "utf-8")) as { version: string };
	const original = JSON.parse(await readFile(bak, "utf-8")) as Record<string, unknown>;
	original.version = current.version;
	await writeFile(pkgPath, `${JSON.stringify(original, null, "\t")}\n`);
	await rm(bak);
}

async function packPackage(
	relDir: string,
	destDir: string,
): Promise<{ name: string; tarball: string }> {
	const pkgDir = join(REPO, relDir);
	try {
		run("bun run build", pkgDir);
		run(`npm pack --ignore-scripts --pack-destination "${destDir}"`, pkgDir);
	} finally {
		await restorePackageJson(pkgDir);
	}

	const pkg = JSON.parse(await readFile(join(pkgDir, "package.json"), "utf-8")) as {
		name: string;
		version: string;
	};
	const tarball = join(destDir, npmPackBasename(pkg.name, pkg.version));
	if (!existsSync(tarball)) {
		throw new Error(`Expected tarball at ${tarball}`);
	}
	return { name: pkg.name, tarball };
}

const TAR = "/usr/bin/tar";

function assertTarballContains(tarball: string, entries: readonly string[]): void {
	const listing = execFileSync(TAR, ["-tzf", tarball], { encoding: "utf-8" });
	const missing = entries.filter((entry) => !listing.includes(entry));
	if (missing.length > 0) {
		throw new Error(`Tarball ${tarball} is missing:\n  ${missing.join("\n  ")}`);
	}
}

function lineImportsTypeScript(line: string): boolean {
	if (!line.includes("from") && !line.includes("import")) return false;
	return (
		line.includes(".ts'") ||
		line.includes('.ts"') ||
		line.includes(".tsx'") ||
		line.includes('.tsx"')
	);
}

/** Published client JS must not import `.ts` files that `files` omits. */
function assertPublishedClientJsHasNoTsImports(tarball: string): void {
	for (const file of ["package/dist/src/client/main.js", "package/dist/src/client/main-slim.js"]) {
		const contents = execFileSync(TAR, ["-xOf", tarball, file], { encoding: "utf-8" });
		if (contents.split("\n").some(lineImportsTypeScript)) {
			throw new Error(`${file} still imports TypeScript specifiers`);
		}
		if (!contents.includes("hydrate-runtime.js")) {
			throw new Error(`${file} does not import hydrate-runtime.js`);
		}
	}
}

function pinPackedDeps(pkg: Record<string, unknown>, packed: Record<string, string>): void {
	for (const field of ["dependencies", "devDependencies"] as const) {
		const deps = pkg[field] as Record<string, string> | undefined;
		if (!deps) continue;
		for (const [name, tarball] of Object.entries(packed)) {
			if (deps[name]) deps[name] = `file:${tarball}`;
		}
	}
	pkg.overrides = Object.fromEntries(
		Object.entries(packed).map(([name, tarball]) => [name, `file:${tarball}`]),
	);
}

const SMOKE_PAGE = `import Counter from '../components/Counter.tsx';

export const metadata = {
  title: 'Avalon smoke',
};

export default function HomePage() {
  return (
    <main>
      <h1>Avalon smoke</h1>
      <Counter island={{ condition: 'on:client' }} count={0} />
    </main>
  );
}
`;

const SMOKE_COUNTER = `import { useState } from 'preact/hooks';

export default function Counter({ count = 0 }: { count?: number }) {
  const [value, setValue] = useState(count);
  return (
    <button type="button" onClick={() => setValue((current) => current + 1)}>
      {value}
    </button>
  );
}
`;

async function main(): Promise<void> {
	const work = await mkdtemp(join(tmpdir(), "avalon-install-smoke-"));
	const packedDir = join(work, "packed");
	const appDir = join(work, "smoke-app");
	console.log(`smoke workdir: ${work}`);

	try {
		run(`mkdir -p "${packedDir}"`, work);

		const packed: Record<string, string> = {};
		for (const relDir of PACK_TARGETS) {
			const { name, tarball } = await packPackage(relDir, packedDir);
			if (name === "create-avalon") continue;
			packed[name] = tarball;
		}

		const avalonTarball = packed["@useavalon/avalon"];
		if (!avalonTarball) {
			throw new Error("Did not pack @useavalon/avalon");
		}
		assertTarballContains(avalonTarball, AVALON_TARBALL_MUST_CONTAIN);
		assertPublishedClientJsHasNoTsImports(avalonTarball);

		run(`bun "${join(REPO, "packages/create-avalon/src/cli.ts")}" smoke-app --yes`, work);

		const pkgPath = join(appDir, "package.json");
		const pkg = JSON.parse(await readFile(pkgPath, "utf-8")) as Record<string, unknown>;
		pinPackedDeps(pkg, packed);
		await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

		await writeFile(join(appDir, "app/modules/main/pages/index.tsx"), SMOKE_PAGE);
		await writeFile(join(appDir, "app/modules/main/components/Counter.tsx"), SMOKE_COUNTER);

		run("bun install", appDir);
		run("bun run build", appDir);

		const html = await readFile(join(appDir, ".output/public/index.html"), "utf-8");
		if (!html.includes("Avalon smoke")) {
			throw new Error("Prerendered index.html does not contain the smoke page title");
		}
		if (!html.includes("<button")) {
			throw new Error("Prerendered index.html does not contain the island button");
		}

		const avalonBin = join(appDir, "node_modules/@useavalon/avalon/dist/bin/avalon.js");
		if (!existsSync(avalonBin)) {
			throw new Error(`Published avalon CLI missing at ${avalonBin}`);
		}
		const help = execFileSync(process.execPath, [avalonBin, "--help"], { encoding: "utf-8" });
		if (!help.includes("Usage: avalon")) {
			throw new Error(`avalon --help did not print usage:\n${help}`);
		}

		console.log("✓ create-avalon install smoke passed");
	} finally {
		await rm(work, { recursive: true, force: true });
	}
}

try {
	await main();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
