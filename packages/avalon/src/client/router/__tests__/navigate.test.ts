import { afterEach, describe, expect, it, vi } from "vitest";
import { navigate } from "../index.ts";

describe("navigate fallback", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("falls back to location.assign for cross-origin URLs", async () => {
		const assign = vi.fn();
		vi.stubGlobal("location", {
			href: "https://example.com/home",
			origin: "https://example.com",
			pathname: "/home",
			search: "",
			hash: "",
			assign,
		});

		await navigate("https://other.test/about");
		expect(assign).toHaveBeenCalledWith("https://other.test/about");
	});

	it("falls back when the destination disables client navigation", async () => {
		const assign = vi.fn();
		vi.stubGlobal("location", {
			href: "https://example.com/home",
			origin: "https://example.com",
			pathname: "/home",
			search: "",
			hash: "",
			assign,
		});
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				return new Response("<html></html>", {
					headers: {
						"content-type": "text/html",
						"Avalon-Client-Navigation": "false",
					},
				});
			}),
		);

		await navigate("/checkout");
		expect(assign).toHaveBeenCalledWith("https://example.com/checkout");
	});

	it("falls back when the current document disables client navigation", async () => {
		const assign = vi.fn();
		vi.stubGlobal("document", {
			documentElement: { dataset: { clientNavigation: "false" } },
		});
		vi.stubGlobal("location", {
			href: "https://example.com/checkout",
			origin: "https://example.com",
			pathname: "/checkout",
			search: "",
			hash: "",
			assign,
		});

		await navigate("/about");
		expect(assign).toHaveBeenCalledWith("https://example.com/about");
	});
});
