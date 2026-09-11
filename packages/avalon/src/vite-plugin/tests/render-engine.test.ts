import { render as preactRenderToString } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import {
	renderShell,
	setShellRenderToString,
	shellFragment,
	shellH,
} from "../../render/shell-engine.ts";
import { resolveConfig } from "../config.ts";

describe("resolveConfig — render engine (core)", () => {
	it("defaults clientRouter to false", () => {
		expect(resolveConfig(undefined, false).clientRouter).toBe(false);
		expect(resolveConfig({}, true).clientRouter).toBe(false);
	});

	it("respects an explicit clientRouter: true", () => {
		expect(resolveConfig({ clientRouter: true }, false).clientRouter).toBe(true);
	});

	it("respects an explicit core: react", () => {
		expect(resolveConfig({ core: "react" }, false).core).toBe("react");
	});

	it("MDX jsxImportSource follows the core engine by default", () => {
		expect(resolveConfig({}, false).mdx.jsxImportSource).toBe("preact");
		expect(resolveConfig({ core: "react" }, false).mdx.jsxImportSource).toBe("react");
	});

	it("explicit mdx.jsxImportSource overrides the core default", () => {
		const resolved = resolveConfig({ core: "react", mdx: { jsxImportSource: "preact" } }, false);
		expect(resolved.mdx.jsxImportSource).toBe("preact");
	});
});

describe("shell-engine", () => {
	it("defaults to Preact rendering", () => {
		const html = renderShell(shellH("div", { id: "x" }, "hello"));
		expect(html).toContain("hello");
		expect(html).toContain('id="x"');
	});

	it("shellH + shellFragment delegate to the active engine (Preact by default)", () => {
		const vnode = shellH(
			shellFragment(),
			null,
			shellH("span", null, "a"),
			shellH("span", null, "b"),
		);
		expect(renderShell(vnode)).toBe("<span>a</span><span>b</span>");
	});

	it("setShellRenderToString overrides the renderer, then can be restored", () => {
		setShellRenderToString(() => "<custom></custom>");
		expect(renderShell(shellH("div", null))).toBe("<custom></custom>");

		// Restore the Preact default so other suites are unaffected.
		setShellRenderToString((vnode) =>
			// biome-ignore lint/suspicious/noExplicitAny: test restore
			preactRenderToString(vnode as any),
		);
		expect(renderShell(shellH("p", null, "ok"))).toBe("<p>ok</p>");
	});
});
