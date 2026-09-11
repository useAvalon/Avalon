import { afterEach, describe, expect, it, vi } from "vitest";
import {
	cacheKeyFromUrl,
	clearPrefetchCache,
	getCachedDocument,
	prefetch,
	putCachedDocument,
} from "../prefetch.ts";

describe("prefetch cache", () => {
	afterEach(() => {
		clearPrefetchCache();
		vi.unstubAllGlobals();
	});

	it("stores and returns HTML until TTL expires", () => {
		const url = new URL("https://example.com/docs");
		putCachedDocument(url, "<html></html>", url.href, 1000, 0);
		expect(getCachedDocument(url, 500)?.html).toBe("<html></html>");
		expect(getCachedDocument(url, 1001)).toBeNull();
	});

	it("keys by origin + path + search", () => {
		expect(cacheKeyFromUrl(new URL("https://a.test/x?q=1#h"))).toBe("https://a.test/x?q=1");
	});

	it("does not cache documents that disable client navigation", async () => {
		vi.stubGlobal("location", {
			href: "https://example.com/",
			origin: "https://example.com",
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				return new Response("<html lang='en'></html>", {
					headers: {
						"content-type": "text/html",
						"Avalon-Client-Navigation": "false",
					},
					url: "https://example.com/checkout",
				});
			}),
		);

		await prefetch("/checkout");
		expect(getCachedDocument(new URL("https://example.com/checkout"))).toBeNull();
	});

	it("does not cache non-HTML responses", async () => {
		vi.stubGlobal("location", {
			href: "https://example.com/",
			origin: "https://example.com",
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				return new Response("{}", {
					headers: { "content-type": "application/json" },
				});
			}),
		);

		await prefetch("/api");
		expect(getCachedDocument(new URL("https://example.com/api"))).toBeNull();
	});
});
