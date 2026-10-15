import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	buildCloudflareRoutesExclude,
	CLOUDFLARE_PAGES_MAX_ROUTE_RULES,
	collectPrerenderedHtmlPaths,
	ensureCloudflarePages404Html,
	injectCloudflareDomStub,
	patchCloudflareCreateRequire,
	patchCloudflareRoutesAfterPrerender,
	patchCloudflareRoutesForStaticHtml,
	patchCloudflareWranglerJson,
	prerenderedPathWildcardExcludes,
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

describe("injectCloudflareDomStub", () => {
	it("writes _dom_stub.mjs and prepends imports before Lit", () => {
		const dir = mkdtempSync(join(tmpdir(), "avalon-cf-dom-"));
		dirs.push(dir);
		mkdirSync(join(dir, "_ssr"), { recursive: true });
		mkdirSync(join(dir, "_libs", "@lit-labs"), { recursive: true });
		writeFileSync(join(dir, "index.js"), "export default {};\n");
		writeFileSync(join(dir, "_ssr", "ssr.mjs"), 'import "../_libs/@lit-labs/ssr.mjs";\n');
		writeFileSync(join(dir, "_libs", "@lit-labs", "ssr+[...].mjs"), "var l = document;\n");

		expect(injectCloudflareDomStub(dir)).toBe(true);
		expect(readFileSync(join(dir, "_dom_stub.mjs"), "utf-8")).toContain("HTMLElement");
		expect(readFileSync(join(dir, "_dom_stub.mjs"), "utf-8")).not.toContain(
			"@lit-labs/ssr-dom-shim",
		);
		expect(
			readFileSync(join(dir, "index.js"), "utf-8").startsWith('import "./_dom_stub.mjs";'),
		).toBe(true);
		expect(
			readFileSync(join(dir, "_ssr", "ssr.mjs"), "utf-8").startsWith('import "../_dom_stub.mjs";'),
		).toBe(true);
		expect(
			readFileSync(join(dir, "_libs", "@lit-labs", "ssr+[...].mjs"), "utf-8").startsWith(
				'import "../../_dom_stub.mjs";',
			),
		).toBe(true);
	});
});

describe("patchCloudflareRoutesAfterPrerender", () => {
	it("skips _routes.json patch when prerender did not write index.html", () => {
		const cwd = mkdtempSync(join(tmpdir(), "avalon-cf-r-skip-"));
		dirs.push(cwd);
		mkdirSync(join(cwd, "dist"), { recursive: true });
		writeFileSync(
			join(cwd, "dist", "_routes.json"),
			JSON.stringify({ version: 1, include: ["/*"], exclude: [] }),
		);

		expect(patchCloudflareRoutesAfterPrerender(cwd)).toBe(false);
		const routes = JSON.parse(readFileSync(join(cwd, "dist", "_routes.json"), "utf-8"));
		expect(routes.include).toEqual(["/*"]);
	});

	it("patches _routes.json when index.html exists", () => {
		const cwd = mkdtempSync(join(tmpdir(), "avalon-cf-r-ok-"));
		dirs.push(cwd);
		mkdirSync(join(cwd, "dist"), { recursive: true });
		writeFileSync(join(cwd, "dist", "index.html"), "<!DOCTYPE html><html></html>\n");
		writeFileSync(
			join(cwd, "dist", "_routes.json"),
			JSON.stringify({ version: 1, include: ["/*"], exclude: [] }),
		);

		expect(patchCloudflareRoutesAfterPrerender(cwd)).toBe(true);
		const routes = JSON.parse(readFileSync(join(cwd, "dist", "_routes.json"), "utf-8"));
		expect(routes.include).not.toContain("/*");
		expect(routes.exclude).toContain("/");
	});
});

describe("prerenderedPathWildcardExcludes", () => {
	it("collapses nested paths to one wildcard per top-level segment", () => {
		expect(
			prerenderedPathWildcardExcludes(["/", "/docs", "/docs/guides", "/about"]).sort(),
		).toEqual(["/about", "/docs", "/docs/*"].sort());
	});
});

describe("buildCloudflareRoutesExclude", () => {
	it("falls back to static excludes when the rule cap would be exceeded", () => {
		const cwd = mkdtempSync(join(tmpdir(), "avalon-cf-cap-"));
		dirs.push(cwd);
		mkdirSync(cwd, { recursive: true });

		const manyPaths = Array.from(
			{ length: CLOUDFLARE_PAGES_MAX_ROUTE_RULES },
			(_, i) => `/${`page-${i}`}`,
		);
		const excludes = buildCloudflareRoutesExclude(cwd, manyPaths.length);
		expect(excludes).not.toContain("/page-0");
		expect(excludes).toContain("/assets/*");
	});
});

describe("collectPrerenderedHtmlPaths", () => {
	it("collects nested index.html paths", () => {
		const cwd = mkdtempSync(join(tmpdir(), "avalon-cf-html-"));
		dirs.push(cwd);
		mkdirSync(join(cwd, "docs", "guides"), { recursive: true });
		writeFileSync(join(cwd, "index.html"), "<html></html>\n");
		writeFileSync(join(cwd, "docs", "index.html"), "<html></html>\n");
		writeFileSync(join(cwd, "docs", "guides", "index.html"), "<html></html>\n");

		expect(collectPrerenderedHtmlPaths(cwd).sort()).toEqual(["/", "/docs", "/docs/guides"].sort());
	});
});

describe("ensureCloudflarePages404Html", () => {
	it("copies prerendered /404 page to 404.html", () => {
		const cwd = mkdtempSync(join(tmpdir(), "avalon-cf-404-"));
		dirs.push(cwd);
		mkdirSync(join(cwd, "404"), { recursive: true });
		writeFileSync(join(cwd, "404", "index.html"), "<html>custom 404</html>\n");

		expect(ensureCloudflarePages404Html(cwd)).toBe(true);
		expect(readFileSync(join(cwd, "404.html"), "utf-8")).toContain("custom 404");
	});
});

describe("patchCloudflareRoutesForStaticHtml", () => {
	it("limits Functions include to dynamic SSR paths", () => {
		const cwd = mkdtempSync(join(tmpdir(), "avalon-cf-r-"));
		dirs.push(cwd);
		mkdirSync(join(cwd, "dist"), { recursive: true });
		writeFileSync(
			join(cwd, "dist", "_routes.json"),
			JSON.stringify({ version: 1, include: ["/*"], exclude: ["/favicon.ico"] }),
		);

		mkdirSync(join(cwd, "dist", "docs", "foo"), { recursive: true });
		writeFileSync(join(cwd, "dist", "docs", "foo", "index.html"), "<html></html>\n");

		expect(patchCloudflareRoutesForStaticHtml(cwd)).toBe(true);
		const routes = JSON.parse(readFileSync(join(cwd, "dist", "_routes.json"), "utf-8"));
		expect(routes.include).toContain("/api/*");
		expect(routes.include).toContain("/_server-islands/*");
		expect(routes.include).not.toContain("/demo/data-fetching");
		expect(routes.include).not.toContain("/*");
		expect(routes.exclude).toContain("/");
		expect(routes.exclude).toContain("/docs/*");
		expect(routes.exclude).not.toContain("/docs/foo");
	});
});
