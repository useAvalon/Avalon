import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	isCredentialForbidden,
	isReleaseComplete,
	isUnscopedName,
	publishPackages,
	registryUrl,
	resolveNpmBin,
	restoreSourceManifest,
	shouldCommit,
} from "./publish-packages.ts";

function writePkg(name: string, version: string): string {
	const dir = mkdtempSync(join(tmpdir(), "avalon-publish-"));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version }));
	return dir;
}

describe("resolveNpmBin", () => {
	it("prefers NPM_BIN when that path exists", () => {
		const dir = writePkg("tmp", "0.0.0");
		const fake = join(dir, "npm");
		writeFileSync(fake, "");
		const prev = process.env.NPM_BIN;
		process.env.NPM_BIN = fake;
		try {
			expect(resolveNpmBin()).toBe(fake);
		} finally {
			if (prev === undefined) delete process.env.NPM_BIN;
			else process.env.NPM_BIN = prev;
		}
	});
});

describe("registryUrl", () => {
	it("encodes the slash in a scoped name", () => {
		expect(registryUrl("@useavalon/avalon", "0.5.0")).toBe(
			"https://registry.npmjs.org/@useavalon%2favalon/0.5.0",
		);
	});

	it("leaves an unscoped name unchanged", () => {
		expect(registryUrl("create-avalon", "0.2.0")).toBe(
			"https://registry.npmjs.org/create-avalon/0.2.0",
		);
	});
});

describe("publishPackages", () => {
	it("skips versions already on the registry", async () => {
		const dir = writePkg("@useavalon/avalon", "0.5.0");
		const result = await publishPackages([dir], "latest", {
			fetchStatus: async () => 200,
			publish: () => {
				throw new Error("must not publish");
			},
		});
		expect(result.skipped).toEqual(["@useavalon/avalon@0.5.0"]);
		expect(result.published).toEqual([]);
		expect(shouldCommit(result)).toBe(true);
	});

	it("publishes versions that are not on the registry", async () => {
		const dir = writePkg("@useavalon/seo", "0.2.0");
		const result = await publishPackages([dir], "latest", {
			fetchStatus: async () => 404,
			publish: () => ({ ok: true, stderr: "" }),
		});
		expect(result.published).toEqual(["@useavalon/seo@0.2.0"]);
		expect(shouldCommit(result)).toBe(true);
	});

	it("records an unscoped 403 as incomplete so the bump stays off main", async () => {
		const dir = writePkg("create-avalon", "0.2.0");
		const result = await publishPackages([dir], "latest", {
			fetchStatus: async () => 404,
			publish: () => ({
				ok: false,
				stderr:
					"npm error 403 403 Forbidden - PUT https://registry.npmjs.org/create-avalon - You may not perform that action with these credentials.",
			}),
		});
		expect(result.warned).toEqual(["create-avalon@0.2.0"]);
		expect(result.failed).toEqual([]);
		expect(isReleaseComplete(result)).toBe(false);
		expect(shouldCommit(result)).toBe(false);
		expect(isUnscopedName("create-avalon")).toBe(true);
		expect(
			isCredentialForbidden(
				"npm error 403 403 Forbidden - You may not perform that action with these credentials.",
			),
		).toBe(true);
	});

	it("does not commit when create-avalon 403s even if others were skipped", async () => {
		const avalon = writePkg("@useavalon/avalon", "0.5.0");
		const create = writePkg("create-avalon", "0.2.0");
		const result = await publishPackages([avalon, create], "latest", {
			fetchStatus: async (url) => (url.includes("create-avalon") ? 404 : 200),
			publish: () => ({
				ok: false,
				stderr: "npm error 403 You may not perform that action with these credentials.",
			}),
		});
		expect(result.skipped).toEqual(["@useavalon/avalon@0.5.0"]);
		expect(result.warned).toEqual(["create-avalon@0.2.0"]);
		expect(result.failed).toEqual([]);
		expect(shouldCommit(result)).toBe(false);
	});

	it("does not commit when one package publishes and another fails", async () => {
		const create = writePkg("create-avalon", "0.2.1");
		const avalon = writePkg("@useavalon/avalon", "0.5.1");
		const result = await publishPackages([create, avalon], "latest", {
			fetchStatus: async () => 404,
			publish: (dir) => {
				const name = (
					JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
						name: string;
					}
				).name;
				if (name === "create-avalon") return { ok: true, stderr: "" };
				return { ok: false, stderr: "npm error ENEEDAUTH" };
			},
		});
		expect(result.published).toEqual(["create-avalon@0.2.1"]);
		expect(result.failed).toEqual(["@useavalon/avalon@0.5.1"]);
		expect(isReleaseComplete(result)).toBe(false);
		expect(shouldCommit(result)).toBe(false);
	});

	it("fails a scoped package that npm rejects", async () => {
		const dir = writePkg("@useavalon/avalon", "0.6.0");
		const result = await publishPackages([dir], "latest", {
			fetchStatus: async () => 404,
			publish: () => ({ ok: false, stderr: "npm error 403 Forbidden" }),
		});
		expect(result.failed).toEqual(["@useavalon/avalon@0.6.0"]);
		expect(shouldCommit(result)).toBe(false);
	});
});

describe("restoreSourceManifest", () => {
	it("restores source exports and keeps the bumped version", () => {
		const dir = mkdtempSync(join(tmpdir(), "avalon-restore-"));
		const pkgPath = join(dir, "package.json");
		const bakPath = join(dir, "package.json.bak");
		writeFileSync(bakPath, JSON.stringify({ version: "0.5.0", exports: { ".": "./mod.ts" } }));
		writeFileSync(pkgPath, JSON.stringify({ version: "0.5.1", exports: { ".": "./dist/mod.js" } }));
		restoreSourceManifest(dir);
		const restored = JSON.parse(readFileSync(pkgPath, "utf8"));
		expect(restored).toEqual({ version: "0.5.1", exports: { ".": "./mod.ts" } });
		expect(existsSync(bakPath)).toBe(false);
	});

	it("does nothing without a backup", () => {
		const dir = writePkg("x", "1.0.0");
		restoreSourceManifest(dir);
		expect(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version).toBe("1.0.0");
	});
});
