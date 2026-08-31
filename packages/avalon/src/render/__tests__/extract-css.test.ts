import { describe, expect, it } from "vitest";
import { directCssRequestUrl, extractCssFromTransformedModule } from "../collect-css.ts";

describe("extractCssFromTransformedModule", () => {
	it("reads Vite 8 JSON.stringify wrappers", () => {
		const css = '.foo {\n\tcolor: "red";\n}';
		const code = `const __vite__css = ${JSON.stringify(css)}\n__vite__updateStyle(__vite__id, __vite__css)`;
		expect(extractCssFromTransformedModule(code)).toBe(css);
	});

	it("returns hashed ?direct CSS as-is", () => {
		const css = "._page_1en1m_7 { background: pink; }";
		expect(extractCssFromTransformedModule(css)).toBe(css);
	});

	it("rejects JS modules that are not CSS wrappers", () => {
		expect(extractCssFromTransformedModule("export const page = 'x'")).toBeNull();
	});

	it("cache-busts with v= so Vite cannot strip the query", () => {
		expect(directCssRequestUrl("/app/x.css", 7)).toBe("/app/x.css?direct&v=7");
	});
});
