import { describe, expect, it } from "vitest";
import { litIntegration } from "../mod.ts";

describe("litIntegration.config()", () => {
	const cfg = litIntegration.config();

	it('returns "lit" as the integration name', () => {
		expect(cfg.name).toBe("lit");
	});

	it("declares .ts and .js file extensions", () => {
		expect(cfg.fileExtensions).toEqual([".ts", ".js"]);
	});

	describe("detection patterns - imports", () => {
		const { imports } = cfg.detectionPatterns;

		it('matches bare "lit" import', () => {
			expect(imports.some((r) => r.test("lit"))).toBe(true);
		});

		it('matches "lit/" subpath import', () => {
			expect(imports.some((r) => r.test("lit/decorators"))).toBe(true);
		});

		it('matches from "lit" import statement', () => {
			const code = "import { LitElement } from 'lit'";
			expect(imports.some((r) => r.test(code))).toBe(true);
		});

		it('matches from "lit/decorators" import statement', () => {
			const code = "import { customElement } from 'lit/decorators'";
			expect(imports.some((r) => r.test(code))).toBe(true);
		});

		it("matches @lit-labs/ssr import", () => {
			expect(imports.some((r) => r.test("@lit-labs/ssr"))).toBe(true);
		});

		it("does not match unrelated imports", () => {
			expect(imports.some((r) => r.test("react"))).toBe(false);
			expect(imports.some((r) => r.test("vue"))).toBe(false);
		});
	});

	describe("detection patterns - content", () => {
		const { content } = cfg.detectionPatterns;

		it("matches LitElement class usage", () => {
			expect(content.some((r) => r.test("class MyEl extends LitElement"))).toBe(true);
		});

		it("matches customElement call", () => {
			expect(content.some((r) => r.test('customElement("my-el")'))).toBe(true);
		});

		it("matches @customElement decorator", () => {
			expect(content.some((r) => r.test('@customElement("my-el")'))).toBe(true);
		});

		it("matches @property decorator", () => {
			expect(content.some((r) => r.test("@property({ type: String })"))).toBe(true);
		});

		it("matches @state decorator", () => {
			expect(content.some((r) => r.test("@state()"))).toBe(true);
		});

		it("matches html tagged template literal", () => {
			expect(content.some((r) => r.test("html`<div>hello</div>`"))).toBe(true);
		});

		it("matches css tagged template literal", () => {
			expect(content.some((r) => r.test("css`:host { display: block }`"))).toBe(true);
		});

		it("does not match unrelated content", () => {
			expect(content.some((r) => r.test("const x = 42"))).toBe(false);
		});
	});
});

describe("Lit SSR declarative shadow DOM", () => {
	it("marks shadow roots clonable so client-navigation swaps keep styles", async () => {
		const { readFileSync } = await import("node:fs");
		const { fileURLToPath } = await import("node:url");
		const src = readFileSync(
			fileURLToPath(new URL("../server/renderer.ts", import.meta.url)),
			"utf8",
		);
		expect(src).toContain('shadowrootmode="open" shadowrootclonable');
	});
});
