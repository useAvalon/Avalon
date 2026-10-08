import { beforeEach, describe, expect, it } from "vitest";
import {
	addModulepreload,
	clearModulepreloads,
	formatModulepreloadLink,
	generateModulepreloadTags,
	getModulepreloadCount,
	getModulepreloadPaths,
	injectModulepreloadLinks,
} from "../modulepreload-collector.ts";

describe("addModulepreload", () => {
	beforeEach(() => {
		clearModulepreloads();
	});

	it("registers a bundle path", () => {
		addModulepreload("/islands/Counter.abc123.js");
		expect(getModulepreloadCount()).toBe(1);
	});

	it("deduplicates identical paths", () => {
		addModulepreload("/islands/Counter.abc123.js");
		addModulepreload("/islands/Counter.abc123.js");
		expect(getModulepreloadCount()).toBe(1);
	});

	it("merges fetch priority when the same path is registered twice", () => {
		addModulepreload("/islands/Counter.js", { fetchPriority: "low" });
		addModulepreload("/islands/Counter.js", { fetchPriority: "high" });
		const tags = generateModulepreloadTags();
		expect(tags).toContain('fetchpriority="high"');
	});

	it("treats a later registration without priority as default over low", () => {
		addModulepreload("/islands/Counter.js", { fetchPriority: "low" });
		addModulepreload("/islands/Counter.js");
		const tags = generateModulepreloadTags();
		expect(tags).toBe('<link rel="modulepreload" href="/islands/Counter.js">');
	});

	it("collects multiple distinct paths", () => {
		addModulepreload("/islands/Counter.abc123.js");
		addModulepreload("/islands/TodoList.def456.js");
		expect(getModulepreloadCount()).toBe(2);
	});

	it("ignores empty strings", () => {
		addModulepreload("");
		expect(getModulepreloadCount()).toBe(0);
	});
});

describe("getModulepreloadPaths", () => {
	beforeEach(() => {
		clearModulepreloads();
	});

	it("returns empty array when nothing collected", () => {
		expect(getModulepreloadPaths()).toEqual([]);
	});

	it("returns all collected paths", () => {
		addModulepreload("/islands/A.js");
		addModulepreload("/islands/B.js");
		const paths = getModulepreloadPaths(false);
		expect(paths).toContain("/islands/A.js");
		expect(paths).toContain("/islands/B.js");
	});

	it("clears the collector by default", () => {
		addModulepreload("/islands/A.js");
		getModulepreloadPaths(); // clears
		expect(getModulepreloadCount()).toBe(0);
	});

	it("preserves the collector when clear=false", () => {
		addModulepreload("/islands/A.js");
		getModulepreloadPaths(false);
		expect(getModulepreloadCount()).toBe(1);
	});
});

describe("generateModulepreloadTags", () => {
	beforeEach(() => {
		clearModulepreloads();
	});

	it("returns empty string when nothing collected", () => {
		expect(generateModulepreloadTags()).toBe("");
	});

	it("generates correct link tags", () => {
		addModulepreload("/islands/Counter.abc123.js");
		const tags = generateModulepreloadTags();
		expect(tags).toBe('<link rel="modulepreload" href="/islands/Counter.abc123.js">');
	});

	it("generates multiple link tags separated by newlines", () => {
		addModulepreload("/islands/A.js");
		addModulepreload("/islands/B.js");
		const tags = generateModulepreloadTags();
		expect(tags).toContain('<link rel="modulepreload" href="/islands/A.js">');
		expect(tags).toContain('<link rel="modulepreload" href="/islands/B.js">');
		expect(tags.split("\n")).toHaveLength(2);
	});

	it("uses modulepreload not preload", () => {
		addModulepreload("/islands/Counter.js");
		const tags = generateModulepreloadTags();
		expect(tags).toContain('rel="modulepreload"');
		expect(tags).not.toContain('rel="preload"');
	});

	it("includes fetchpriority when set", () => {
		addModulepreload("/islands/Counter.js", { fetchPriority: "low" });
		const tags = generateModulepreloadTags();
		expect(tags).toBe('<link rel="modulepreload" href="/islands/Counter.js" fetchpriority="low">');
	});
});

describe("formatModulepreloadLink", () => {
	it("omits fetchpriority for auto", () => {
		expect(formatModulepreloadLink("/islands/A.js", "auto")).toBe(
			'<link rel="modulepreload" href="/islands/A.js">',
		);
	});
});

describe("injectModulepreloadLinks", () => {
	beforeEach(() => {
		clearModulepreloads();
	});

	it("returns HTML unchanged when nothing collected", () => {
		const html = "<html><head><title>Test</title></head><body></body></html>";
		expect(injectModulepreloadLinks(html)).toBe(html);
	});

	it("injects modulepreload links before </head>", () => {
		addModulepreload("/islands/Counter.abc123.js");

		const html = `<!DOCTYPE html>
<html><head><title>Test</title></head>
<body><div>Hello</div></body></html>`;

		const result = injectModulepreloadLinks(html);
		expect(result).toContain('<link rel="modulepreload" href="/islands/Counter.abc123.js">');

		// Link should appear before </head>
		const linkIdx = result.indexOf("modulepreload");
		const headCloseIdx = result.indexOf("</head>");
		expect(linkIdx).toBeLessThan(headCloseIdx);
	});

	it("injects multiple modulepreload links", () => {
		addModulepreload("/islands/A.js");
		addModulepreload("/islands/B.js");

		const html = "<html><head></head><body></body></html>";
		const result = injectModulepreloadLinks(html);

		expect(result).toContain('<link rel="modulepreload" href="/islands/A.js">');
		expect(result).toContain('<link rel="modulepreload" href="/islands/B.js">');
	});

	it("clears the collector after injection", () => {
		addModulepreload("/islands/Counter.js");
		injectModulepreloadLinks("<html><head></head><body></body></html>");
		expect(getModulepreloadCount()).toBe(0);
	});

	it("returns HTML unchanged when no </head> tag exists", () => {
		addModulepreload("/islands/Counter.js");
		const html = "<html><body></body></html>";
		const result = injectModulepreloadLinks(html);
		// No </head> to inject into, so HTML is unchanged
		expect(result).toBe(html);
	});
});

describe("clearModulepreloads", () => {
	it("removes all collected paths", () => {
		addModulepreload("/islands/A.js");
		addModulepreload("/islands/B.js");
		clearModulepreloads();
		expect(getModulepreloadCount()).toBe(0);
	});
});
