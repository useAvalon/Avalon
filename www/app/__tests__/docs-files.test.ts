import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import * as fc from "fast-check";
import { describe, it } from "vitest";
import { ALL_SIDEBAR_HREFS } from "../shared/utils/sidebar.ts";

describe("Docs files property tests", () => {
	// Feature: avalon-docs, Property 6: All sidebar hrefs have corresponding files on disk
	it("Property 6: all sidebar hrefs have corresponding files on disk", () => {
		fc.assert(
			fc.property(fc.constantFrom(...ALL_SIDEBAR_HREFS), (href) => {
				// New modular path: app/modules/docs/pages/...
				const filePath = path.resolve(
					process.cwd(),
					"www/app/modules/docs/pages" + href.replace("/docs", "") + ".mdx",
				);
				return existsSync(filePath);
			}),
			{ numRuns: 100 },
		);
	});

	// Feature: avalon-docs, Property 7: All five hydration conditions appear in islands-architecture.mdx
	it("Property 7: all five hydration conditions appear in islands-architecture.mdx", () => {
		const content = readFileSync(
			path.resolve(process.cwd(), "www/app/modules/docs/pages/islands-architecture.mdx"),
			"utf-8",
		);
		fc.assert(
			fc.property(
				fc.constantFrom("on:client", "on:visible", "on:interaction", "on:idle", "media:"),
				(condition) => content.includes(condition),
			),
			{ numRuns: 100 },
		);
	});

	// Feature: avalon-docs, Property 8: All six framework pages exist
	it("Property 8: all six framework pages exist", () => {
		fc.assert(
			fc.property(
				fc.constantFrom("react", "preact", "vue", "svelte", "solid", "lit"),
				(framework) =>
					existsSync(
						path.resolve(process.cwd(), `www/app/modules/docs/pages/frameworks/${framework}.mdx`),
					),
			),
			{ numRuns: 100 },
		);
	});
});
