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
});
