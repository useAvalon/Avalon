import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateBuildMjs } from "./deploy";

const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Fake `vite build` that writes the given files, then keeps running like
 * Vite/Nitro does when open handles survive the build.
 */
function fakeViteSource(files: Record<string, string>): string {
	return `
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const files = ${JSON.stringify(files)};
setTimeout(() => {
  for (const [rel, body] of Object.entries(files)) {
    const full = join(process.cwd(), rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
}, 200);
setInterval(() => {}, 1000);
`;
}

function scaffold(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "avalon-build-mjs-"));
	dirs.push(dir);
	const vite = join(dir, "node_modules", "vite");
	mkdirSync(join(vite, "bin"), { recursive: true });
	writeFileSync(join(vite, "package.json"), JSON.stringify({ name: "vite", type: "module" }));
	writeFileSync(join(vite, "bin", "vite.js"), fakeViteSource(files));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));
	writeFileSync(join(dir, "post-build.mjs"), "console.log('[fake] post-build');\n");
	writeFileSync(join(dir, "build.mjs"), generateBuildMjs());
	return dir;
}

function runBuild(cwd: string, preset: string): Promise<{ code: number | null; output: string }> {
	return new Promise((resolve) => {
		const child = spawn("node", ["build.mjs"], {
			cwd,
			env: { ...process.env, NITRO_PRESET: preset },
			stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		child.stdout.on("data", (d: Buffer) => {
			output += d.toString();
		});
		child.stderr.on("data", (d: Buffer) => {
			output += d.toString();
		});
		const timer = setTimeout(() => child.kill("SIGKILL"), 20_000);
		child.on("exit", (code) => {
			clearTimeout(timer);
			resolve({ code, output });
		});
	});
}

describe("generated build.mjs output detection", () => {
	it("finishes a cloudflare_pages build once dist/nitro.json is written", async () => {
		const cwd = scaffold({
			"dist/_worker.js/index.js": "export default {};\n",
			"dist/nitro.json": JSON.stringify({ preset: "cloudflare-pages" }),
		});
		const { code, output } = await runBuild(cwd, "cloudflare_pages");
		expect(output).toContain("Output detected (cloudflare-pages)");
		expect(output).toContain("Cloudflare worker found (dist/_worker.js)");
		expect(output).not.toContain("Timeout");
		expect(code).toBe(0);
	}, 25_000);

	it("finishes a cloudflare_module build from .output/server/index.mjs and nitro.json", async () => {
		const cwd = scaffold({
			".output/server/_ssr/ssr.mjs": "export {};\n",
			".output/server/index.mjs": "export default {};\n",
			".output/nitro.json": JSON.stringify({ preset: "cloudflare-module" }),
		});
		const { code, output } = await runBuild(cwd, "cloudflare_module");
		expect(output).toContain("Output detected (cloudflare-module)");
		expect(output).toContain("Cloudflare worker found (.output/server/index.mjs)");
		expect(output).not.toContain("Timeout");
		expect(code).toBe(0);
	}, 25_000);
});
