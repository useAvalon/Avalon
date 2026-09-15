import { afterEach, describe, expect, it, vi } from "vitest";
import { registerBuiltinDirectives } from "../builtin-directives.ts";
import {
	clearDirectives,
	getDirective,
	getRegisteredDirectives,
	registerHydrationDirective,
} from "../hydration-directives.ts";

afterEach(() => {
	clearDirectives();
	vi.restoreAllMocks();
});

describe("registerBuiltinDirectives", () => {
	it("registers delay, event, scroll, and match once", () => {
		registerBuiltinDirectives();
		expect(getRegisteredDirectives()).toEqual(["on:delay", "on:event", "on:scroll", "on:match"]);
	});

	it("does not warn when the renderer registers built-ins again", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		registerBuiltinDirectives();
		registerBuiltinDirectives();
		expect(warn).not.toHaveBeenCalled();
		expect(getRegisteredDirectives()).toHaveLength(4);
	});
});

describe("registerHydrationDirective", () => {
	it("keeps the first definition when the same name is registered twice", () => {
		const first = vi.fn();
		registerHydrationDirective("on:custom", { name: "on:custom", script: first });
		registerHydrationDirective("on:custom", { name: "on:custom", script: vi.fn() });
		expect(getDirective("on:custom")?.script).toBe(first);
	});
});
