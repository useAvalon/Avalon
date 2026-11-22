import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_CACHE_SECONDS, ssrCacheUntilDeploy } from "../../deploy-revision.ts";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("ssrCacheUntilDeploy", () => {
	it("keeps the cache lifetime within what a timer can hold", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NITRO_PRESET", "");
		const rule = ssrCacheUntilDeploy();
		expect(rule).not.toBe(false);
		if (rule === false) return;
		// The in-memory cache sets setTimeout(maxAge * 1000); above 2^31 - 1 ms Node clamps it to 1 ms.
		expect(rule.maxAge * 1000).toBeLessThanOrEqual(2 ** 31 - 1);
		expect(rule.maxAge).toBe(MAX_CACHE_SECONDS);
	});

	it("is off outside production and for the node_server preset", () => {
		vi.stubEnv("NODE_ENV", "development");
		expect(ssrCacheUntilDeploy()).toBe(false);
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NITRO_PRESET", "node_server");
		expect(ssrCacheUntilDeploy()).toBe(false);
	});

	it("scopes entries to the deploy revision", () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("NITRO_PRESET", "");
		vi.stubEnv("GITHUB_SHA", "abc123");
		const rule = ssrCacheUntilDeploy();
		expect(rule === false ? null : rule.integrity).toBe("abc123");
	});
});
