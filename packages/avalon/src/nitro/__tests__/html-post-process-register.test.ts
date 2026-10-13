import { describe, expect, it } from "vitest";
import {
	clearHtmlPostProcessRegisterModuleSource,
	getHtmlPostProcessRegisterModuleSource,
	setHtmlPostProcessRegisterModuleSource,
} from "../html-post-process-register.ts";

describe("html-post-process-register", () => {
	it("returns no-op until a provider is registered", () => {
		clearHtmlPostProcessRegisterModuleSource();
		expect(getHtmlPostProcessRegisterModuleSource()).toContain("no-op");
	});

	it("returns registered module source", () => {
		setHtmlPostProcessRegisterModuleSource(() => "export const x = 1;\n");
		expect(getHtmlPostProcessRegisterModuleSource()).toBe("export const x = 1;\n");
		clearHtmlPostProcessRegisterModuleSource();
	});

	it("reads provider from globalThis when module state is isolated", () => {
		clearHtmlPostProcessRegisterModuleSource();
		(globalThis as Record<string, unknown>).__avalonHtmlPostProcessRegisterProvider = () =>
			"export const fromGlobal = true;\n";
		expect(getHtmlPostProcessRegisterModuleSource()).toBe("export const fromGlobal = true;\n");
		clearHtmlPostProcessRegisterModuleSource();
	});
});
