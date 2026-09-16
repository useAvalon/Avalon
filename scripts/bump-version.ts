/**
 * Version bump script for Avalon releases.
 *
 * Usage:
 *   # Bump only the core framework
 *   bun run scripts/bump-version.ts --bump=minor --channel=beta --package=core
 *
 *   # Bump a specific integration
 *   bun run scripts/bump-version.ts --bump=patch --channel=stable --package=lit
 *
 *   # Bump everything (breaking shared change)
 *   bun run scripts/bump-version.ts --bump=major --channel=beta --package=all
 *
 * Package targets:
 *   core     — avalon + core + preact + seo + create-avalon (default install set)
 *   lit      — @useavalon/lit
 *   react    — @useavalon/react
 *   preact   — @useavalon/preact
 *   svelte   — @useavalon/svelte
 *   solid    — @useavalon/solid
 *   vue      — @useavalon/vue
 *   mcp           — @useavalon/mcp (independent version line; not part of `all`)
 *   create-avalon — create-avalon (unscoped; needs its own trusted publisher)
 *   all           — every framework package + create-avalon + seo + agent-optimization
 */

import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const PACKAGE_MAP: Record<string, string[]> = {
	core: [
		"packages/avalon/package.json",
		"packages/integrations/core/package.json",
		"packages/integrations/preact/package.json",
		"packages/seo/package.json",
		"packages/create-avalon/package.json",
	],
	lit: ["packages/integrations/lit/package.json"],
	react: ["packages/integrations/react/package.json"],
	preact: ["packages/integrations/preact/package.json"],
	svelte: ["packages/integrations/svelte/package.json"],
	solid: ["packages/integrations/solid/package.json"],
	vue: ["packages/integrations/vue/package.json"],
	qwik: ["packages/integrations/qwik/package.json"],
	mcp: ["packages/mcp/package.json"],
	"create-avalon": ["packages/create-avalon/package.json"],
};

// `mcp` has an independent version line, so it is deliberately excluded from the
// `all` target (which is meant for coordinated framework releases).
const STANDALONE_PACKAGES = new Set(["mcp"]);
const ALL_PACKAGES = [
	...new Set(
		Object.entries(PACKAGE_MAP)
			.filter(([name]) => !STANDALONE_PACKAGES.has(name))
			.flatMap(([, files]) => files),
	),
	"packages/agent-optimization/package.json",
];

interface SemVer {
	major: number;
	minor: number;
	patch: number;
	prerelease?: string;
}

function parseSemVer(version: string): SemVer {
	const [core, prerelease] = version.split("-");
	const [major, minor, patch] = core.split(".").map(Number);
	return { major, minor, patch, prerelease };
}

function formatSemVer(v: SemVer): string {
	const core = `${v.major}.${v.minor}.${v.patch}`;
	return v.prerelease ? `${core}-${v.prerelease}` : core;
}

function bumpVersion(
	current: SemVer,
	bump: "patch" | "minor" | "major",
	channel: "stable" | "beta" | "rc",
): SemVer {
	const base = { ...current, prerelease: undefined };
	const isExistingPrerelease = current.prerelease !== undefined;

	if (isExistingPrerelease && channel !== "stable") {
		const currentChannel = current.prerelease?.split(".")[0];
		if (currentChannel === channel) {
			const counter = Number.parseInt(current.prerelease?.split(".")[1] ?? "0", 10) + 1;
			return { ...base, prerelease: `${channel}.${counter}` };
		}
		if (channel === "rc" && currentChannel === "beta") {
			return { ...base, prerelease: `rc.1` };
		}
	}

	let nextBase: SemVer;
	switch (bump) {
		case "major":
			nextBase = { major: base.major + 1, minor: 0, patch: 0 };
			break;
		case "minor":
			nextBase = { major: base.major, minor: base.minor + 1, patch: 0 };
			break;
		case "patch":
			nextBase = { major: base.major, minor: base.minor, patch: base.patch + 1 };
			break;
	}

	if (channel === "stable") {
		return nextBase;
	}

	return { ...nextBase, prerelease: `${channel}.1` };
}

// --- Main ---

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: {
		bump: { type: "string", default: "patch" },
		channel: { type: "string", default: "stable" },
		package: { type: "string", default: "core" },
	},
});

const bump = values.bump as "patch" | "minor" | "major";
const channel = values.channel as "stable" | "beta" | "rc";
const pkg = values.package as string;

if (!["patch", "minor", "major"].includes(bump)) {
	console.error(`Invalid bump type: ${bump}. Use patch, minor, or major.`);
	process.exit(1);
}

if (!["stable", "beta", "rc"].includes(channel)) {
	console.error(`Invalid channel: ${channel}. Use stable, beta, or rc.`);
	process.exit(1);
}

const validPackages = [...Object.keys(PACKAGE_MAP), "all"];
if (!validPackages.includes(pkg)) {
	console.error(`Invalid package: ${pkg}. Use one of: ${validPackages.join(", ")}`);
	process.exit(1);
}

const targetFiles = pkg === "all" ? ALL_PACKAGES : PACKAGE_MAP[pkg];

console.log(`Target:  ${pkg}`);
console.log(`Bump:    ${bump}`);
console.log(`Channel: ${channel}`);
console.log();

for (const pkgPath of targetFiles) {
	try {
		const config = JSON.parse(await readFile(pkgPath, "utf-8"));
		const currentVersion = parseSemVer(config.version);
		const nextVersion = bumpVersion(currentVersion, bump, channel);
		const nextVersionStr = formatSemVer(nextVersion);

		config.version = nextVersionStr;
		await writeFile(pkgPath, `${JSON.stringify(config, null, "\t")}\n`);
		console.log(
			`  ${config.name}: ${config.version !== nextVersionStr ? formatSemVer(currentVersion) : config.version} → ${nextVersionStr}`,
		);
	} catch (e) {
		console.error(`  Failed to update ${pkgPath}: ${e}`);
	}
}

console.log("\nDone.");
