import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateBuildMjs } from "./deploy";

const dirs: string[] = [];
const children: ChildProcess[] = [];

function killPid(pid: number): void {
	try {
		process.kill(pid, "SIGKILL");
	} catch {
		// Already gone.
	}
}

/** Stops the detached fake Vite that build.mjs spawned in `dir`. */
function stopFakeVite(dir: string): void {
	const pidFile = join(dir, "vite.pid");
	if (existsSync(pidFile)) killPid(Number(readFileSync(pidFile, "utf-8")));
}

afterEach(() => {
	for (const child of children.splice(0)) {
		if (child.pid && child.exitCode === null && child.signalCode === null) killPid(child.pid);
	}
	for (const dir of dirs.splice(0)) {
		stopFakeVite(dir);
		rmSync(dir, { recursive: true, force: true });
	}
});

interface FakeVite {
	/** Files to write, keyed by path, with the delay in ms before each write. */
	files: Record<string, { body: string; at: number }>;
	/** Exit with this code 1.5s after the last write (inside the 3s grace period) instead of hanging. */
	exitCode?: number;
}

/**
 * Fake `vite build`: writes files on a schedule, then keeps running like
 * Vite/Nitro does when open handles survive the build (or exits, when asked).
 * Records its pid so the test can stop it, since build.mjs spawns it detached.
 */
function fakeViteSource({ files, exitCode }: FakeVite): string {
	const last = Math.max(0, ...Object.values(files).map((f) => f.at));
	const tail =
		exitCode === undefined
			? "setInterval(() => {}, 1000);"
			: `setTimeout(() => process.exit(${exitCode}), ${last + 1_500});`;
	return `
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
writeFileSync(join(process.cwd(), 'vite.pid'), String(process.pid));
const files = ${JSON.stringify(files)};
for (const [rel, { body, at }] of Object.entries(files)) {
  setTimeout(() => {
    const full = join(process.cwd(), rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }, at);
}
${tail}
`;
}

function scaffold(fake: FakeVite): string {
	const dir = mkdtempSync(join(tmpdir(), "avalon-build-mjs-"));
	dirs.push(dir);
	const vite = join(dir, "node_modules", "vite");
	mkdirSync(join(vite, "bin"), { recursive: true });
	writeFileSync(join(vite, "package.json"), JSON.stringify({ name: "vite", type: "module" }));
	writeFileSync(join(vite, "bin", "vite.js"), fakeViteSource(fake));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));
	writeFileSync(join(dir, "post-build.mjs"), "console.log('[fake] post-build');\n");
	writeFileSync(join(dir, "build.mjs"), generateBuildMjs());
	return dir;
}

function runBuild(
	cwd: string,
	preset: string | undefined,
): Promise<{ code: number | null; output: string }> {
	return new Promise((resolve) => {
		const env = { ...process.env };
		if (preset === undefined) delete env.NITRO_PRESET;
		else env.NITRO_PRESET = preset;
		const child = spawn("node", ["build.mjs"], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
		children.push(child);
		let output = "";
		child.stdout.on("data", (d: Buffer) => {
			output += d.toString();
		});
		child.stderr.on("data", (d: Buffer) => {
			output += d.toString();
		});
		const timer = setTimeout(() => {
			stopFakeVite(cwd);
			child.kill("SIGKILL");
		}, 20_000);
		child.on("exit", (code) => {
			clearTimeout(timer);
			resolve({ code, output });
		});
	});
}

const at = (body: string, ms = 200) => ({ body, at: ms });

describe("generated build.mjs output detection", () => {
	it("finishes a cloudflare_pages build once dist/nitro.json is written", async () => {
		const cwd = scaffold({
			files: {
				"dist/_worker.js/index.js": at("export default {};\n"),
				"dist/nitro.json": at(JSON.stringify({ preset: "cloudflare-pages" })),
			},
		});
		const { code, output } = await runBuild(cwd, "cloudflare_pages");
		expect(output).toContain("Output detected (cloudflare-pages)");
		expect(output).toContain("Cloudflare worker found (dist/_worker.js)");
		expect(output).not.toContain("Timeout");
		expect(code).toBe(0);
	}, 25_000);

	it("finishes a cloudflare_module build from .output/server/index.mjs and nitro.json", async () => {
		const cwd = scaffold({
			files: {
				".output/server/_ssr/ssr.mjs": at("export {};\n"),
				".output/server/index.mjs": at("export default {};\n"),
				".output/nitro.json": at(JSON.stringify({ preset: "cloudflare-module" })),
			},
		});
		const { code, output } = await runBuild(cwd, "cloudflare_module");
		expect(output).toContain("Output detected (cloudflare-module)");
		expect(output).toContain("Cloudflare worker found (.output/server/index.mjs)");
		expect(output).not.toContain("Timeout");
		expect(code).toBe(0);
	}, 25_000);

	it("waits for nitro.json when vite.config selects cloudflare_module without NITRO_PRESET", async () => {
		const cwd = scaffold({
			files: {
				".output/server/_ssr/ssr.mjs": at("export {};\n"),
				".output/server/index.mjs": at("export default {};\n", 2_500),
				".output/nitro.json": at(JSON.stringify({ preset: "cloudflare-module" }), 2_500),
			},
		});
		const { code, output } = await runBuild(cwd, undefined);
		expect(output).toContain("Output detected (cloudflare-module)");
		expect(output).not.toContain("Output detected (node-server)");
		expect(code).toBe(0);
	}, 25_000);

	it("keeps a failing Vite exit code that arrives during the grace period", async () => {
		const cwd = scaffold({
			files: {
				".output/server/_ssr/ssr.mjs": at("export {};\n"),
				".output/nitro.json": at(JSON.stringify({ preset: "node-server" })),
			},
			exitCode: 3,
		});
		const { code, output } = await runBuild(cwd, undefined);
		expect(output).toContain("Output detected (node-server)");
		expect(output).toContain("vite build exited with code 3");
		expect(code).toBe(3);
	}, 25_000);
});
