import { describe, expect, it } from "vitest";
import {
	cssHotPayload,
	fileToDevHref,
	generateDevCssHmrModule,
	invalidateCssFile,
	isBrowserFullReloadPayload,
	isCssHotFile,
	scheduleCssPush,
	shouldDropCssFullReload,
} from "../dev-css-hmr.ts";

describe("dev CSS HMR", () => {
	it("treats stylesheets as CSS hot files", () => {
		expect(isCssHotFile("/app/pages/index.module.css")).toBe(true);
		expect(isCssHotFile("/app/pages/index.tsx")).toBe(false);
		expect(isCssHotFile("/x.scss?direct")).toBe(true);
	});

	it("maps a file under root to a /-href", () => {
		expect(fileToDevHref("/proj", "/proj/app/x.css")).toBe("/app/x.css");
	});

	it("drops Nitro document reloads while a CSS save is in flight", () => {
		expect(isBrowserFullReloadPayload({ type: "full-reload" })).toBe(true);
		expect(isBrowserFullReloadPayload({ type: "update" })).toBe(false);
		expect(shouldDropCssFullReload(true, { type: "full-reload" })).toBe(true);
		expect(shouldDropCssFullReload(true, { type: "full-reload", path: "*" })).toBe(true);
		expect(shouldDropCssFullReload(true, { type: "full-reload", triggeredBy: "/app/x.css" })).toBe(
			true,
		);
		expect(
			shouldDropCssFullReload(true, {
				type: "full-reload",
				path: "*",
				triggeredBy: "/app/pages/index.tsx",
			}),
		).toBe(false);
		expect(shouldDropCssFullReload(true, { type: "full-reload", path: "/index.html" })).toBe(false);
		expect(shouldDropCssFullReload(true, { type: "custom", event: "avalon:css" })).toBe(false);
		expect(shouldDropCssFullReload(false, { type: "full-reload" })).toBe(false);
	});

	it("queues one follow-up CSS push when a save arrives while a push is in flight", async () => {
		const pushing = new Set<string>();
		const pending = new Set<string>();
		const finish: Array<() => void> = [];
		const run = (): Promise<void> =>
			new Promise((resolve) => {
				finish.push(resolve);
			});

		scheduleCssPush("a.css", pushing, pending, run);
		scheduleCssPush("a.css", pushing, pending, run);
		expect(finish).toHaveLength(1);
		expect(pending.has("a.css")).toBe(true);

		finish[0]?.();
		await Promise.resolve();
		await Promise.resolve();
		expect(finish).toHaveLength(2);
		expect(pending.has("a.css")).toBe(false);

		finish[1]?.();
		await Promise.resolve();
		await Promise.resolve();
		expect(pushing.has("a.css")).toBe(false);
	});

	it("sends an explicit custom payload the Vite client can dispatch", () => {
		expect(cssHotPayload("/a.css", "a{}")).toEqual({
			type: "custom",
			event: "avalon:css",
			data: { href: "/a.css", css: "a{}" },
		});
	});

	it("generates a self-contained HMR listener", () => {
		const src = generateDevCssHmrModule();
		expect(src).toContain("import.meta.hot.on('avalon:css'");
		expect(src).toContain("?direct&v=");
	});

	it("invalidates the CSS module in every Vite environment", () => {
		const invalidated: string[] = [];
		const mod = { id: "/app/x.css" };
		const server = {
			environments: {
				client: {
					moduleGraph: {
						getModulesByFile: (file: string) => (file.endsWith("x.css") ? new Set([mod]) : null),
						invalidateModule: (m: { id: string }) => {
							invalidated.push(`client:${m.id}`);
						},
					},
				},
				ssr: {
					moduleGraph: {
						getModulesByFile: (file: string) => (file.endsWith("x.css") ? new Set([mod]) : null),
						invalidateModule: (m: { id: string }) => {
							invalidated.push(`ssr:${m.id}`);
						},
					},
				},
			},
		};
		invalidateCssFile(server as never, "/proj/app/x.css");
		expect(invalidated).toEqual(["client:/app/x.css", "ssr:/app/x.css"]);
	});
});
