import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { normalizePresetName, resolvePresetName } from "../../nitro/config.ts";
import { readNitroOutputPreset, resolveCloudflareWorker, waitForServer } from "../prerender.ts";

const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "avalon-prerender-"));
	dirs.push(dir);
	for (const [rel, body] of Object.entries(files)) {
		const full = join(dir, rel);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, body);
	}
	return dir;
}

describe("resolveCloudflareWorker", () => {
	it("finds the Pages worker under dist/_worker.js", () => {
		const cwd = project({ "dist/_worker.js/index.js": "export default {};" });
		expect(resolveCloudflareWorker(cwd)).toBe(join(cwd, "dist", "_worker.js", "index.js"));
	});

	it("finds a cloudflare-module worker from .output/nitro.json", () => {
		const cwd = project({
			".output/nitro.json": JSON.stringify({ preset: "cloudflare-module" }),
			".output/server/index.mjs": "export default {};",
		});
		expect(readNitroOutputPreset(cwd)).toBe("cloudflare_module");
		expect(resolveCloudflareWorker(cwd)).toBe(join(cwd, ".output", "server", "index.mjs"));
	});

	it("accepts the underscore spelling in nitro.json", () => {
		const cwd = project({
			".output/nitro.json": JSON.stringify({ preset: "cloudflare_module" }),
			".output/server/index.mjs": "export default {};",
		});
		expect(resolveCloudflareWorker(cwd)).toBe(join(cwd, ".output", "server", "index.mjs"));
	});

	it("leaves node_server output to the Node listener path", () => {
		const cwd = project({
			".output/nitro.json": JSON.stringify({ preset: "node-server" }),
			".output/server/index.mjs": "export {};",
		});
		expect(resolveCloudflareWorker(cwd)).toBeNull();
	});
});

describe("waitForServer", () => {
	it("fails as soon as the server process has exited", async () => {
		const started = Date.now();
		await expect(
			waitForServer("http://127.0.0.1:1", 15_000, { exitCode: 1, signalCode: null }),
		).rejects.toThrow("Server process exited with code 1 before it was ready");
		expect(Date.now() - started).toBeLessThan(2_000);
	});

	it("reports the timeout when the server never answers", async () => {
		await expect(
			waitForServer("http://127.0.0.1:1", 300, { exitCode: null, signalCode: null }),
		).rejects.toThrow("did not become ready");
	});
});

describe("preset names", () => {
	it("accepts Nitro's hyphenated spelling and returns the underscore form", () => {
		expect(resolvePresetName("cloudflare-module")).toBe("cloudflare_module");
		expect(resolvePresetName("cloudflare_pages")).toBe("cloudflare_pages");
		expect(normalizePresetName(" Node-Server ")).toBe("node_server");
	});

	it("still rejects unknown presets", () => {
		expect(() => resolvePresetName("cloudflare-nope")).toThrow(
			'Unknown Nitro preset: "cloudflare-nope"',
		);
	});
});
