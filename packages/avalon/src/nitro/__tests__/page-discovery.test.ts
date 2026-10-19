import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverProjectPageRoutes } from "../../page-discovery.ts";

describe("discoverProjectPageRoutes", () => {
	let root: string;

	afterEach(() => {
		if (root) rmSync(root, { recursive: true, force: true });
	});

	it("discovers routes from traditional src/pages", async () => {
		root = mkdtempSync(join(tmpdir(), "avalon-page-discovery-"));
		const pages = join(root, "src", "pages");
		mkdirSync(pages, { recursive: true });
		writeFileSync(join(pages, "index.tsx"), "export default () => null", "utf-8");
		writeFileSync(join(pages, "about.tsx"), "export default () => null", "utf-8");

		const routes = await discoverProjectPageRoutes({ projectRoot: root });
		const patterns = routes.map((r) => r.pattern).sort();
		expect(patterns).toEqual(["/", "/about"]);
	});

	it("discovers modular app/modules pages when app/modules exists", async () => {
		root = mkdtempSync(join(tmpdir(), "avalon-page-discovery-mod-"));
		const modulePages = join(root, "app", "modules", "about", "pages");
		mkdirSync(modulePages, { recursive: true });
		writeFileSync(join(modulePages, "index.tsx"), "export default () => null", "utf-8");

		const routes = await discoverProjectPageRoutes({ projectRoot: root });
		expect(routes.some((r) => r.pattern === "/about")).toBe(true);
	});

	it("does not infer app/modules when modules is explicitly null", async () => {
		root = mkdtempSync(join(tmpdir(), "avalon-page-discovery-null-"));
		const modulePages = join(root, "app", "modules", "about", "pages");
		mkdirSync(modulePages, { recursive: true });
		writeFileSync(join(modulePages, "index.tsx"), "export default () => null", "utf-8");
		const pages = join(root, "src", "pages");
		mkdirSync(pages, { recursive: true });
		writeFileSync(join(pages, "index.tsx"), "export default () => null", "utf-8");

		const routes = await discoverProjectPageRoutes({ projectRoot: root, modules: null });
		expect(routes.map((r) => r.pattern)).toEqual(["/"]);
	});
});
