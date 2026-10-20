import { afterEach, describe, expect, it, vi } from "vitest";
import { applyScroll, restoreScrollAfterReload, saveScrollForReload } from "../a11y.ts";

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

describe("scroll reload restore", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("restores scroll after reload for the same path", () => {
		const scrollTo = vi.fn();
		const storage = new Map<string, string>();
		vi.stubGlobal("sessionStorage", {
			setItem: (k: string, v: string) => storage.set(k, v),
			getItem: (k: string) => storage.get(k) ?? null,
			removeItem: (k: string) => storage.delete(k),
		});
		vi.stubGlobal("location", { pathname: "/docs", search: "", hash: "" });
		vi.stubGlobal("window", { scrollTo, scrollX: 0, scrollY: 0 });
		vi.stubGlobal("document", {
			readyState: "complete",
			documentElement: { style: {} },
			getElementById: () => null,
			addEventListener: vi.fn(),
		});
		vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
			cb();
			return 0;
		});
		vi.stubGlobal("performance", {
			getEntriesByType: () => [{ type: "reload" }],
		});

		saveScrollForReload();
		storage.set("avalon:scroll-restore", JSON.stringify({ path: "/docs", x: 4, y: 88 }));

		restoreScrollAfterReload();
		expect(scrollTo).toHaveBeenCalledWith({ left: 4, top: 88, behavior: "instant" });
		expect(storage.has("avalon:scroll-restore")).toBe(false);
	});

	it("restores saved coordinates even when the URL has a hash target", () => {
		const scrollTo = vi.fn();
		const scrollIntoView = vi.fn();
		const storage = new Map<string, string>();
		vi.stubGlobal("sessionStorage", {
			setItem: (k: string, v: string) => storage.set(k, v),
			getItem: (k: string) => storage.get(k) ?? null,
			removeItem: (k: string) => storage.delete(k),
		});
		vi.stubGlobal("location", { pathname: "/docs", search: "", hash: "#section" });
		vi.stubGlobal("window", { scrollTo, scrollX: 0, scrollY: 0 });
		vi.stubGlobal("document", {
			readyState: "complete",
			documentElement: { style: {} },
			getElementById: () => ({ scrollIntoView }),
			addEventListener: vi.fn(),
		});
		vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
			cb();
			return 0;
		});
		vi.stubGlobal("performance", {
			getEntriesByType: () => [{ type: "reload" }],
		});
		storage.set("avalon:scroll-restore", JSON.stringify({ path: "/docs", x: 4, y: 88 }));

		restoreScrollAfterReload();
		expect(scrollTo).toHaveBeenCalledWith({ left: 4, top: 88, behavior: "instant" });
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	it("consumes the saved entry without restoring on a non-reload navigation", () => {
		const scrollTo = vi.fn();
		const storage = new Map<string, string>();
		vi.stubGlobal("sessionStorage", {
			setItem: (k: string, v: string) => storage.set(k, v),
			getItem: (k: string) => storage.get(k) ?? null,
			removeItem: (k: string) => storage.delete(k),
		});
		vi.stubGlobal("location", { pathname: "/docs", search: "", hash: "" });
		vi.stubGlobal("window", { scrollTo, scrollX: 0, scrollY: 0 });
		vi.stubGlobal("document", {
			readyState: "complete",
			documentElement: { style: {} },
			getElementById: () => null,
			addEventListener: vi.fn(),
		});
		vi.stubGlobal("performance", {
			getEntriesByType: () => [{ type: "navigate" }],
		});
		storage.set("avalon:scroll-restore", JSON.stringify({ path: "/docs", x: 4, y: 88 }));

		restoreScrollAfterReload();
		expect(scrollTo).not.toHaveBeenCalled();
		expect(storage.has("avalon:scroll-restore")).toBe(false);
	});
});
