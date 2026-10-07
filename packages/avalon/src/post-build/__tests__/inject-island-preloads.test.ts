import { describe, expect, it } from "vitest";
import {
	depPreloadHintsForHtml,
	islandDepPreloadPolicyFromHtml,
} from "../inject-island-preloads.ts";

describe("islandDepPreloadPolicyFromHtml", () => {
	const islandPath = "/islands/Dashboard.abc.js";

	it("defaults to preloading deps", () => {
		const html = `<avalon-island data-src="${islandPath}"></avalon-island>`;
		expect(islandDepPreloadPolicyFromHtml(html, islandPath)).toEqual({ skip: false });
	});

	it("skips when data-island-preload is false", () => {
		const html = `<avalon-island data-src="${islandPath}" data-island-preload="false"></avalon-island>`;
		expect(islandDepPreloadPolicyFromHtml(html, islandPath)).toEqual({ skip: true });
	});

	it("reads fetch priority from the island tag", () => {
		const html = `<avalon-island data-src="${islandPath}" data-island-fetchpriority="low"></avalon-island>`;
		expect(islandDepPreloadPolicyFromHtml(html, islandPath)).toEqual({
			skip: false,
			fetchPriority: "low",
		});
	});
});

describe("depPreloadHintsForHtml", () => {
	it("skips dependency hints when island opts out of preload", () => {
		const islandPath = "/islands/Dashboard.abc.js";
		const dep = "/assets/chunk-xyz.js";
		const html = `<head></head><body><avalon-island data-src="${islandPath}" data-island-preload="false"></avalon-island></body>`;
		const hints = depPreloadHintsForHtml(html, { [islandPath]: [dep] });
		expect(hints).toBeNull();
	});

	it("emits dep hints with fetchpriority from the island tag", () => {
		const islandPath = "/islands/Dashboard.abc.js";
		const dep = "/assets/chunk-xyz.js";
		const html = `<head></head><body><avalon-island data-src="${islandPath}" data-island-fetchpriority="low"></avalon-island>${islandPath}</body>`;
		const hints = depPreloadHintsForHtml(html, { [islandPath]: [dep] });
		expect(hints).toBe(
			'<link rel="modulepreload" href="/assets/chunk-xyz.js" fetchpriority="low">',
		);
	});
});
