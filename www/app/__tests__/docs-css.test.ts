import { readFileSync } from "node:fs";
import path from "node:path";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const layoutCss = readFileSync(
	path.resolve(process.cwd(), "www/app/modules/docs/layouts/_layout.module.css"),
	"utf-8",
);

const sidebarCss = readFileSync(
	path.resolve(process.cwd(), "www/app/modules/docs/components/DocsSidebar.module.css"),
	"utf-8",
);

describe("Docs CSS property tests", () => {
	// Feature: avalon-docs, Property 9: Syntax highlighting token classes not overridden by prose pre code color
	it("Property 9: .prose pre code has no color declaration", () => {
		fc.assert(
			fc.property(fc.constant(layoutCss), (css) => {
				const match = css.match(/\.prose pre code\s*\{([^}]*)\}/);
				if (!match) return true;
				return !match[1].includes("color:");
			}),
			{ numRuns: 100 },
		);
	});
});

describe("Docs CSS unit tests", () => {
	it(".prose pre code rule exists in _layout.module.css", () => {
		expect(layoutCss).toMatch(/\.prose pre code\s*\{/);
	});

	it("_layout.module.css contains two-column grid-template-columns", () => {
		expect(layoutCss).toMatch(/grid-template-columns\s*:\s*260px\s+1fr/);
	});

	it("_layout.module.css hides TOC below 1100px", () => {
		expect(layoutCss).toMatch(/@media\s*\(max-width:\s*1100px\)/);
		expect(layoutCss).toMatch(/\.tocSidebar\s*\{[^}]*display:\s*none/);
	});

	it("_layout.module.css contains position: sticky for sidebar", () => {
		expect(layoutCss).toContain("position: sticky");
	});

	it("DocsSidebar.module.css contains display: flex for .mobileToggle inside @media (max-width: 768px)", () => {
		// Find the @media (max-width: 768px) block and check .mobileToggle has display: flex
		const mediaMatch = sidebarCss.match(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n\}/);
		expect(mediaMatch).not.toBeNull();
		const mediaBlock = mediaMatch?.[1] ?? "";
		expect(mediaBlock).toMatch(/\.mobileToggle\s*\{[^}]*display\s*:\s*flex/);
	});
});
