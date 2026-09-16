import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	isCredentialForbidden,
	isUnscopedName,
	publishPackages,
	registryUrl,
	shouldCommit,
} from "./publish-packages.ts";

function writePkg(name: string, version: string): string {
	const dir = mkdtempSync(join(tmpdir(), "avalon-publish-"));
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version }));
	return dir;
}

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

	it("warns on an unscoped 403 instead of failing the release", async () => {
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
		expect(isUnscopedName("create-avalon")).toBe(true);
		expect(
			isCredentialForbidden(
				"npm error 403 403 Forbidden - You may not perform that action with these credentials.",
			),
		).toBe(true);
	});

	it("still commits when scoped packages were skipped and create-avalon 403s", async () => {
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
		expect(shouldCommit(result)).toBe(true);
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
