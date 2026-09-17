import { describe, expect, it } from "vitest";
import { fetchHandlerWrapperSource } from "../fetch-handler-wrapper.ts";

describe("fetchHandlerWrapperSource", () => {
	it("passes a waitUntil execution context into handler.fetch", () => {
		const src = fetchHandlerWrapperSource("./index.js", 13172);
		expect(src).toContain("waitUntil(promise)");
		expect(src).toContain("handler.fetch(request, {}, cfCtx)");
		expect(src).toContain("createTreeWalker");
		expect(src).toContain("HTMLElement");
		expect(src).not.toContain("handler.fetch(request, {}, {})");
	});

	it("uses the self-contained stub when Lit is not installed", () => {
		const src = fetchHandlerWrapperSource("./index.js", 13172);
		expect(src).not.toContain("@lit-labs/ssr-dom-shim");
		expect(src).toContain("registry.set(name, ctor)");
	});

	it("imports ssr-dom-shim when the Lit package is present", () => {
		const src = fetchHandlerWrapperSource("./index.js", 13172, { litDomShim: true });
		expect(src).toContain("@lit-labs/ssr-dom-shim");
		expect(src).toContain("CustomElementRegistry");
	});
});
