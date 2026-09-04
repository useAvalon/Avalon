import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	patchCloudflareCreateRequire,
	patchCloudflareWranglerJson,
} from "../cloudflare-worker-patch.ts";

const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("patchCloudflareCreateRequire", () => {
	it("rewrites createRequire(import.meta.url) for workerd", () => {
		const dir = mkdtempSync(join(tmpdir(), "avalon-cf-"));
		dirs.push(dir);
		const file = join(dir, "_runtime.mjs");
		writeFileSync(
			file,
			'import { createRequire } from "node:module";\nvar __require = /* @__PURE__ */ createRequire(import.meta.url);\n',
		);

		expect(patchCloudflareCreateRequire(dir)).toBe(1);
		const out = readFileSync(file, "utf-8");
		expect(out).toContain('createRequire(import.meta.url || "file:///")');
		expect(out).not.toContain("createRequire(import.meta.url);");
	});
});

describe("patchCloudflareWranglerJson", () => {
	it("merges compatibility date and flags", () => {
		const dir = mkdtempSync(join(tmpdir(), "avalon-cf-w-"));
		dirs.push(dir);
		mkdirSync(dir, { recursive: true });
		writeFileSync(
			join(dir, "wrangler.json"),
			JSON.stringify({
				name: "useavalon",
				compatibility_date: "2025-06-01",
				compatibility_flags: ["nodejs_compat"],
			}),
		);

		expect(
			patchCloudflareWranglerJson(dir, {
				compatibilityDate: "2026-09-04",
				compatibilityFlags: ["nodejs_compat", "enable_nodejs_fs_module"],
			}),
		).toBe(true);

		const config = JSON.parse(readFileSync(join(dir, "wrangler.json"), "utf-8"));
		expect(config.compatibility_date).toBe("2026-09-04");
		expect(config.compatibility_flags).toEqual(
			expect.arrayContaining(["nodejs_compat", "enable_nodejs_fs_module"]),
		);
	});
});
