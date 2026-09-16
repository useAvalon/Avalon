import { afterEach, describe, expect, it } from "vitest";
import { ensureURLPattern } from "./urlpattern.ts";

describe("ensureURLPattern", () => {
	const original = (globalThis as { URLPattern?: unknown }).URLPattern;

	afterEach(() => {
		(globalThis as { URLPattern?: unknown }).URLPattern = original;
	});

	it("installs URLPattern when the global is missing", () => {
		const globals = globalThis as { URLPattern?: unknown };
		globals.URLPattern = undefined;
		ensureURLPattern();
		expect(typeof globals.URLPattern).toBe("function");
		const Pattern = globals.URLPattern as new (init: {
			pathname: string;
		}) => {
			test: (input: { pathname: string }) => boolean;
		};
		expect(new Pattern({ pathname: "/*" }).test({ pathname: "/x" })).toBe(true);
	});

	it("leaves an existing URLPattern global in place", () => {
		const sentinel = function URLPatternSentinel() {};
		(globalThis as { URLPattern?: unknown }).URLPattern = sentinel;
		ensureURLPattern();
		expect((globalThis as { URLPattern?: unknown }).URLPattern).toBe(sentinel);
	});
});
