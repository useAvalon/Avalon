/**
 * Build every workspace package that defines a `build` script (prepublish dist).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { restoreSourceManifest } from "./publish-packages.ts";

const ROOTS = [
	"packages/avalon",
	"packages/agent-optimization",
	"packages/mcp",
	"packages/seo",
	"packages/create-avalon",
	"packages/integrations/core",
	"packages/integrations/lit",
	"packages/integrations/react",
	"packages/integrations/preact",
	"packages/integrations/svelte",
	"packages/integrations/solid",
	"packages/integrations/vue",
	"packages/integrations/qwik",
];

for (const dir of ROOTS) {
	const pkgPath = join(dir, "package.json");
	if (!existsSync(pkgPath)) continue;
	const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { scripts?: { build?: string } };
	if (!pkg.scripts?.build) continue;
	console.log(`Building ${dir}...`);
	const result = spawnSync("bun", ["run", "build"], { cwd: dir, stdio: "inherit" });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
	restoreSourceManifest(dir);
}
