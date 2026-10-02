import { afterEach, describe, expect, it, vi } from "vitest";
import { applyScroll } from "../a11y.ts";

describe("applyScroll", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("scrolls to the top when position is top and there is no hash target", () => {
		const scrollTo = vi.fn();
		vi.stubGlobal("window", { scrollTo });
		vi.stubGlobal("document", {
			documentElement: { style: {} },
			getElementById: () => null,
		});

		applyScroll("top");
		expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: "instant" });
	});

	it("scrolls to a hash target instead of the top", () => {
		const scrollIntoView = vi.fn();
		const scrollTo = vi.fn();
		vi.stubGlobal("window", { scrollTo });
		vi.stubGlobal("document", {
			documentElement: { style: {} },
			getElementById: () => ({ scrollIntoView }),
		});

		applyScroll("top", "#section");
		expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it("restores an explicit scroll position", () => {
		const scrollTo = vi.fn();
		vi.stubGlobal("window", { scrollTo });
		vi.stubGlobal("document", {
			documentElement: { style: {} },
			getElementById: () => null,
		});

		applyScroll({ x: 12, y: 340 });
		expect(scrollTo).toHaveBeenCalledWith({ left: 12, top: 340, behavior: "instant" });
	});
});
