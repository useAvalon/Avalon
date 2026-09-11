import { render } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import Island from "../island.tsx";

describe("island HTML ids", () => {
	it("assigns unique ids to two instances of the same src", () => {
		const a = render(Island({ src: "/islands/Counter.tsx", children: "one" }));
		const b = render(Island({ src: "/islands/Counter.tsx", children: "two" }));
		const idA = a.match(/id="([^"]+)"/)?.[1];
		const idB = b.match(/id="([^"]+)"/)?.[1];
		expect(idA).toBeTruthy();
		expect(idB).toBeTruthy();
		expect(idA).not.toBe(idB);
	});

	it("uses an explicit island id when provided", () => {
		const html = render(Island({ src: "/islands/Counter.tsx", id: "my-counter", children: "x" }));
		expect(html).toContain('id="my-counter"');
	});

	it("emits data-router-persist from persist: true using src", () => {
		const html = render(Island({ src: "/islands/ThemeToggle.tsx", persist: true, children: "x" }));
		expect(html).toContain('data-router-persist="/islands/ThemeToggle.tsx"');
	});

	it("emits an explicit persist key", () => {
		const html = render(
			Island({ src: "/islands/Search.tsx", persist: "search-modal", children: "x" }),
		);
		expect(html).toContain('data-router-persist="search-modal"');
	});
});
