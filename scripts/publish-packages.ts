/**
 * Publish workspace packages to npm.
 *
 * Versions already on the registry are skipped so a retry can finish the
 * same versions without cutting a new patch. The version bump stays off
 * main until every target is on npm (or was already there). An unscoped
 * 403 (`create-avalon` missing a trusted publisher) is incomplete.
 *
 * Usage: bun scripts/publish-packages.ts --tag latest -- packages/avalon ...
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

export interface PublishResult {
	published: string[];
	skipped: string[];
	warned: string[];
	failed: string[];
}

export interface PublishDeps {
	fetchStatus: (url: string) => Promise<number>;
	publish: (dir: string, tag: string) => { ok: boolean; stderr: string };
}

export function registryUrl(name: string, version: string): string {
	const encoded = name.startsWith("@") ? name.replaceAll("/", "%2f") : name;
	return `https://registry.npmjs.org/${encoded}/${version}`;
}

export function isUnscopedName(name: string): boolean {
	return !name.startsWith("@");
}

export function isCredentialForbidden(stderr: string): boolean {
	return /403|ENEEDAUTH|You may not perform that action/i.test(stderr);
}

/** True when nothing in the set failed or warned. */
export function isReleaseComplete(result: PublishResult): boolean {
	return result.failed.length === 0 && result.warned.length === 0;
}

/** Commit the bump only when every target landed or was already on npm. */
export function shouldCommit(result: PublishResult): boolean {
	if (!isReleaseComplete(result)) return false;
	return result.published.length > 0 || result.skipped.length > 0;
}

export function resolveNpmBin(): string {
	for (const candidate of [process.env.NPM_BIN, process.env.npm_execpath]) {
		if (candidate && existsSync(candidate)) return candidate;
	}
	const sibling = join(dirname(process.execPath), "npm");
	if (existsSync(sibling)) return sibling;
	return "/usr/bin/npm";
}

/**
 * The build step rewrites package.json to dist/ paths and saves the source
 * manifest as package.json.bak. The lifecycle postpublish hook is meant to
 * undo that, but the release commit runs `git add -A`, so any manifest left
 * rewritten lands on main and breaks workspace consumers that have no dist/.
 * Restoring here, regardless of the hook, keeps the committed manifest on
 * source paths while keeping the bumped version.
 */
export function restoreSourceManifest(dir: string): void {
	const bakPath = join(dir, "package.json.bak");
	if (!existsSync(bakPath)) return;
	const pkgPath = join(dir, "package.json");
	const { version } = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
	const original = JSON.parse(readFileSync(bakPath, "utf8")) as Record<string, unknown>;
	original.version = version;
	writeFileSync(pkgPath, `${JSON.stringify(original, null, "\t")}\n`, "utf8");
	rmSync(bakPath);
}

function defaultPublish(dir: string, tag: string): { ok: boolean; stderr: string } {
	const npm = resolveNpmBin();
	if (!existsSync(npm)) {
		return { ok: false, stderr: `npm binary not found at ${npm}` };
	}
	const result = spawnSync(npm, ["publish", "--tag", tag, "--access", "public"], {
		cwd: dir,
		encoding: "utf8",
	});
	const stderr = `${result.error?.message ?? ""}${result.stderr ?? ""}${result.stdout ?? ""}`;
	return { ok: result.status === 0, stderr };
}

async function defaultFetchStatus(url: string): Promise<number> {
	const response = await fetch(url);
	return response.status;
}

export async function publishPackages(
	dirs: string[],
	tag: string,
	deps?: Partial<PublishDeps>,
): Promise<PublishResult> {
	const fetchStatus = deps?.fetchStatus ?? defaultFetchStatus;
	const publish = deps?.publish ?? defaultPublish;
	const result: PublishResult = {
		published: [],
		skipped: [],
		warned: [],
		failed: [],
	};

	for (const dir of dirs) {
		const pkgPath = `${dir}/package.json`;
		if (!existsSync(pkgPath)) {
			console.warn(`Skipping ${dir}: no package.json`);
			continue;
		}

		// Always restore before reading — the build step rewrites package.json to
		// dist/ paths, and the postpublish lifecycle hook may not have run (e.g.
		// when the version is skipped as already-published). Without this, git
		// add -A in the release commit lands dist-style exports on main.
		restoreSourceManifest(dir);

		const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
			name: string;
			version: string;
		};
		const id = `${pkg.name}@${pkg.version}`;
		const status = await fetchStatus(registryUrl(pkg.name, pkg.version));
		if (status === 200) {
			console.log(`Already on npm: ${id} — skipping`);
			result.skipped.push(id);
			continue;
		}

		console.log(`Publishing ${dir} (${id}) with tag ${tag}...`);
		const published = publish(dir, tag);
		if (published.ok) {
			console.log(`Published ${id}`);
			result.published.push(id);
			continue;
		}

		if (isUnscopedName(pkg.name) && isCredentialForbidden(published.stderr)) {
			console.warn(
				`Unscoped ${id} has no trusted publisher for release.yml. On npmjs.com add GitHub Actions useAvalon / Avalon / release.yml, then re-run Release with the same bump so already-published versions are skipped.`,
			);
			result.warned.push(id);
			continue;
		}

		console.error(`Failed to publish ${id}\n${published.stderr}`);
		result.failed.push(id);
	}

	return result;
}

function writeGithubOutput(result: PublishResult): void {
	const output = process.env.GITHUB_OUTPUT;
	if (!output) return;
	appendFileSync(output, `commit=${shouldCommit(result)}\nfailed=${!isReleaseComplete(result)}\n`);
}

if (import.meta.main) {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		options: {
			tag: { type: "string", default: "latest" },
		},
		allowPositionals: true,
	});

	const result = await publishPackages(positionals, values.tag ?? "latest");
	writeGithubOutput(result);
	if (!isReleaseComplete(result)) {
		process.exit(1);
	}
}
