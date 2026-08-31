import { describe, expect, it } from "vitest";
import { shouldSetDevScopedName, stableDevScopedName } from "../dev-css-modules.ts";

describe("stableDevScopedName", () => {
	it("is stable across file contents and query strings", () => {
		const a = stableDevScopedName("page", "/app/pages/index.module.css");
		const b = stableDevScopedName("page", "/app/pages/index.module.css?direct");
		expect(a).toBe(b);
		expect(a).toMatch(/^_index_page_[a-f0-9]{5}$/);
	});

	it("differs for another file or local name", () => {
		const page = stableDevScopedName("page", "/app/pages/index.module.css");
		expect(stableDevScopedName("hero", "/app/pages/index.module.css")).not.toBe(page);
		expect(stableDevScopedName("page", "/app/pages/other.module.css")).not.toBe(page);
	});
});

describe("shouldSetDevScopedName", () => {
	it("skips when the app disabled modules or set its own generator", () => {
		expect(shouldSetDevScopedName(false)).toBe(false);
		expect(shouldSetDevScopedName({ generateScopedName: "[name]_[local]" })).toBe(false);
		expect(shouldSetDevScopedName(undefined)).toBe(true);
		expect(shouldSetDevScopedName({})).toBe(true);
	});
});
