import { describe, expect, it } from "vitest";
import {
	depPreloadHintsForHtml,
	islandDepPreloadPolicyFromHtml,
} from "../inject-island-preloads.ts";

describe("islandDepPreloadPolicyFromHtml", () => {
	const islandPath = "/islands/Dashboard.abc.js";

	it("defaults to preloading deps for on:client", () => {
		const html = `<avalon-island data-src="${islandPath}" data-condition="on:client"></avalon-island>`;
		expect(islandDepPreloadPolicyFromHtml(html, islandPath)).toEqual({ skip: false });
	});

	it("skips when every on:client instance opts out", () => {
		const html = `<avalon-island data-src="${islandPath}" data-condition="on:client" data-island-preload="false"></avalon-island>`;
		expect(islandDepPreloadPolicyFromHtml(html, islandPath)).toEqual({ skip: true });
	});

	it("does not skip when a later on:client instance keeps preload enabled", () => {
		const html = [
			`<avalon-island data-src="${islandPath}" data-condition="on:client" data-island-preload="false"></avalon-island>`,
			`<avalon-island data-src="${islandPath}" data-condition="on:client"></avalon-island>`,
		].join("");
		expect(islandDepPreloadPolicyFromHtml(html, islandPath)).toEqual({ skip: false });
	});

	it("skips deferred islands", () => {
		const html = `<avalon-island data-src="${islandPath}" data-condition="on:visible"></avalon-island>`;
		expect(islandDepPreloadPolicyFromHtml(html, islandPath)).toEqual({ skip: true });
	});

	it("reads fetch priority from the island tag", () => {
		const html = `<avalon-island data-src="${islandPath}" data-condition="on:client" data-island-fetchpriority="low"></avalon-island>`;
		expect(islandDepPreloadPolicyFromHtml(html, islandPath)).toEqual({
			skip: false,
			fetchPriority: "low",
		});
	});

	it("merges fetch priority across instances (default beats low)", () => {
		const html = [
			`<avalon-island data-src="${islandPath}" data-condition="on:client" data-island-fetchpriority="low"></avalon-island>`,
			`<avalon-island data-src="${islandPath}" data-condition="on:client"></avalon-island>`,
		].join("");
		expect(islandDepPreloadPolicyFromHtml(html, islandPath)).toEqual({ skip: false });
	});

	it("ignores fetch priority on opted-out instances", () => {
		const html = [
			`<avalon-island data-src="${islandPath}" data-condition="on:client" data-island-preload="false" data-island-fetchpriority="high"></avalon-island>`,
			`<avalon-island data-src="${islandPath}" data-condition="on:client" data-island-fetchpriority="low"></avalon-island>`,
		].join("");
		expect(islandDepPreloadPolicyFromHtml(html, islandPath)).toEqual({
			skip: false,
			fetchPriority: "low",
		});
	});

	it("preserves default priority when it precedes a low instance", () => {
		const html = [
			`<avalon-island data-src="${islandPath}" data-condition="on:client"></avalon-island>`,
			`<avalon-island data-src="${islandPath}" data-condition="on:client" data-island-fetchpriority="low"></avalon-island>`,
		].join("");
		expect(islandDepPreloadPolicyFromHtml(html, islandPath)).toEqual({ skip: false });
	});
});

describe("depPreloadHintsForHtml", () => {
	it("skips dependency hints when island opts out of preload", () => {
		const islandPath = "/islands/Dashboard.abc.js";
		const dep = "/assets/chunk-xyz.js";
		const html = `<head></head><body><avalon-island data-src="${islandPath}" data-condition="on:client" data-island-preload="false"></avalon-island></body>`;
		const hints = depPreloadHintsForHtml(html, { [islandPath]: [dep] });
		expect(hints).toBeNull();
	});

	it("emits dep hints with fetchpriority from the island tag", () => {
		const islandPath = "/islands/Dashboard.abc.js";
		const dep = "/assets/chunk-xyz.js";
		const html = `<head></head><body><avalon-island data-src="${islandPath}" data-condition="on:client" data-island-fetchpriority="low"></avalon-island>${islandPath}</body>`;
		const hints = depPreloadHintsForHtml(html, { [islandPath]: [dep] });
		expect(hints).toBe(
			'<link rel="modulepreload" href="/assets/chunk-xyz.js" fetchpriority="low">',
		);
	});

	it("omits fetchpriority when default-priority island follows a low-priority one", () => {
		const islandPath = "/islands/Dashboard.abc.js";
		const dep = "/assets/chunk-xyz.js";
		const html = `<head></head><body>
			<avalon-island data-src="${islandPath}" data-condition="on:client" data-island-fetchpriority="low"></avalon-island>
			<avalon-island data-src="${islandPath}" data-condition="on:client"></avalon-island>
			${islandPath}</body>`;
		const hints = depPreloadHintsForHtml(html, { [islandPath]: [dep] });
		expect(hints).toBe('<link rel="modulepreload" href="/assets/chunk-xyz.js">');
	});

	it("skips dependency hints for on:visible islands", () => {
		const islandPath = "/islands/Dashboard.abc.js";
		const dep = "/assets/chunk-xyz.js";
		const html = `<head></head><body><avalon-island data-src="${islandPath}" data-condition="on:visible"></avalon-island>${islandPath}</body>`;
		expect(depPreloadHintsForHtml(html, { [islandPath]: [dep] })).toBeNull();
	});
});
