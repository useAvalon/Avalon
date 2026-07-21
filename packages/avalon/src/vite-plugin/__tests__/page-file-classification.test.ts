import { describe, expect, it } from "vitest";
import { isPageFile } from "../nitro-integration.ts";

describe("isPageFile — dev route add/unlink classification", () => {
	it("matches flat src/pages files", () => {
		expect(isPageFile("/app/src/pages/index.tsx")).toBe(true);
		expect(isPageFile("/app/src/pages/pricing.tsx")).toBe(true);
	});

	it("matches module-based app/modules/<name>/pages files", () => {
		expect(isPageFile("/app/app/modules/main/pages/index.tsx")).toBe(true);
		expect(isPageFile("/app/app/modules/blog/pages/index.tsx")).toBe(true);
	});

	it("matches nested paths", () => {
		expect(isPageFile("/app/src/pages/a/b/index.tsx")).toBe(true);
	});

	it("matches dynamic segments", () => {
		expect(isPageFile("/app/src/pages/blog/[slug].tsx")).toBe(true);
		expect(isPageFile("/app/src/pages/docs/[...slug].tsx")).toBe(true);
	});

	it("matches .mdx pages", () => {
		expect(isPageFile("/app/src/pages/about.mdx")).toBe(true);
	});

	it("matches special files", () => {
		expect(isPageFile("/app/src/pages/404.tsx")).toBe(true);
		expect(isPageFile("/app/src/pages/_error.tsx")).toBe(true);
	});

	it("does not match CSS under pages", () => {
		expect(isPageFile("/app/src/pages/styles.css")).toBe(false);
	});

	it("does not match files outside a pages directory", () => {
		expect(isPageFile("/app/src/components/Counter.tsx")).toBe(false);
		expect(isPageFile("/app/app/shared/layouts/_layout.tsx")).toBe(false);
		expect(isPageFile("/app/routes/api/hello.ts")).toBe(false);
	});
});
