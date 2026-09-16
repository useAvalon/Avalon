/**
 * Publish workspace packages to npm.
 *
 * Versions already on the registry are skipped so a retry after a partial
 * release can finish git tags without republishing. Unscoped names such as
 * `create-avalon` often sit outside an org-scoped token; a 403 there is a
 * warning, not a hard failure.
 *
 * Usage: bun scripts/publish-packages.ts --tag latest -- packages/avalon ...
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
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

export function shouldCommit(result: PublishResult): boolean {
	return result.published.length > 0 || result.skipped.length > 0;
}

export function resolveNpmBin(): string {
	const fromEnv = process.env.npm_execpath;
	if (fromEnv && existsSync(fromEnv)) return fromEnv;
	const sibling = join(dirname(process.execPath), "npm");
	if (existsSync(sibling)) return sibling;
	return "/usr/bin/npm";
}

function defaultPublish(dir: string, tag: string): { ok: boolean; stderr: string } {
	const result = spawnSync(resolveNpmBin(), ["publish", "--tag", tag, "--access", "public"], {
		cwd: dir,
		encoding: "utf8",
	});
	const stderr = `${result.stderr ?? ""}${result.stdout ?? ""}`;
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
				`Unscoped ${id} is outside this token's grant. Add the package to the npm token, then re-run Release for create-avalon with bump=none.`,
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
	appendFileSync(output, `commit=${shouldCommit(result)}\nfailed=${result.failed.length > 0}\n`);
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
	if (result.failed.length > 0) {
		process.exit(1);
	}
}
