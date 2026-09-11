import { describe, expect, it } from "vitest";
import { extractIslandMarkers } from "../renderer.ts";

describe("extractIslandMarkers", () => {
	it("reads framework, src, props, and hydrate from island tags", () => {
		const html = `
			<avalon-island data-framework="preact" data-src="/islands/A.tsx" data-props="{}" data-hydrate="visible"></avalon-island>
			<div data-framework="solid" data-src="/islands/B.tsx"></div>
		`;
		expect(extractIslandMarkers(html)).toEqual([
			{
				framework: "preact",
				src: "/islands/A.tsx",
				props: "{}",
				hydrate: "visible",
			},
			{
				framework: "solid",
				src: "/islands/B.tsx",
				props: undefined,
				hydrate: undefined,
			},
		]);
	});

	it("returns an empty list when no islands are present", () => {
		expect(extractIslandMarkers("<html><body><p>Hi</p></body></html>")).toEqual([]);
	});

	it("skips a data-framework attribute that is not inside a tag", () => {
		expect(extractIslandMarkers('data-framework="preact"')).toEqual([]);
	});
});
