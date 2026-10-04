import { describe, expect, it } from "vitest";
import { shouldStubBuildTimeSpecifier } from "../stub-build-time-packages.ts";

describe("shouldStubBuildTimeSpecifier", () => {
	it("stubs Vite plugin packages used by integrations", () => {
		expect(shouldStubBuildTimeSpecifier("@preact/preset-vite")).toBe(true);
		expect(shouldStubBuildTimeSpecifier("@vitejs/plugin-vue/dist/index.js")).toBe(true);
		expect(shouldStubBuildTimeSpecifier("vite-plugin-solid")).toBe(true);
	});

	it("stubs oxc-parser so Cloudflare SSR does not resolve wasm32-wasi", () => {
		expect(shouldStubBuildTimeSpecifier("oxc-parser")).toBe(true);
		expect(shouldStubBuildTimeSpecifier("oxc-parser/src-js/wasm.js")).toBe(true);
		expect(shouldStubBuildTimeSpecifier("@oxc-parser/binding-wasm32-wasi")).toBe(true);
	});

	it("stubs rolldown native bindings out of the Cloudflare worker", () => {
		expect(shouldStubBuildTimeSpecifier("rolldown")).toBe(true);
		expect(shouldStubBuildTimeSpecifier("@rolldown/binding-wasm32-wasi")).toBe(true);
		expect(shouldStubBuildTimeSpecifier("@rolldown/binding-linux-x64-gnu")).toBe(true);
	});

	it("stubs native watcher addons out of the Cloudflare worker", () => {
		expect(shouldStubBuildTimeSpecifier("vite")).toBe(false);
		expect(shouldStubBuildTimeSpecifier("chokidar")).toBe(true);
		expect(shouldStubBuildTimeSpecifier("fsevents")).toBe(true);
		expect(shouldStubBuildTimeSpecifier("/abs/fsevents.node")).toBe(true);
	});

	it("does not stub runtime packages", () => {
		expect(shouldStubBuildTimeSpecifier("preact")).toBe(false);
		expect(shouldStubBuildTimeSpecifier("@useavalon/avalon")).toBe(false);
		expect(shouldStubBuildTimeSpecifier("oxc-lint")).toBe(false);
	});
});
