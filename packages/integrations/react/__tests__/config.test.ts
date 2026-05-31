import { describe, expect, it } from "vitest";
import { reactIntegration } from "../mod.ts";

describe("reactIntegration.config()", () => {
	const cfg = reactIntegration.config();

	it('returns "react" as the integration name', () => {
		expect(cfg.name).toBe("react");
	});

	it("declares .jsx and .tsx file extensions", () => {
		expect(cfg.fileExtensions).toEqual([".jsx", ".tsx"]);
	});

	it('declares "react" as a JSX import source', () => {
		expect(cfg.jsxImportSources).toContain("react");
	});

	describe("detection patterns - imports", () => {
		const { imports } = cfg.detectionPatterns;

		it('matches bare "react" import', () => {
			expect(imports.some((r) => r.test("react"))).toBe(true);
		});

		it('matches "react/" subpath import', () => {
			expect(imports.some((r) => r.test("react/jsx-runtime"))).toBe(true);
		});

		it('matches from "react" import statement', () => {
			const code = "import { useState } from 'react'";
			expect(imports.some((r) => r.test(code))).toBe(true);
		});

		it('matches from "react/client" import statement', () => {
			const code = "import { hydrateRoot } from 'react/client'";
			expect(imports.some((r) => r.test(code))).toBe(true);
		});

		it("does not match unrelated imports", () => {
			const code = "import { render } from 'solid-js'";
			expect(imports.some((r) => r.test(code))).toBe(false);
		});
	});

	describe("detection patterns - content", () => {
		const { content } = cfg.detectionPatterns;

		it("matches useState hook", () => {
			expect(content.some((r) => r.test("const [x, setX] = useState(0)"))).toBe(true);
		});

		it("matches useEffect hook", () => {
			expect(content.some((r) => r.test("useEffect(() => {}, [])"))).toBe(true);
		});

		it("matches useContext hook", () => {
			expect(content.some((r) => r.test("const ctx = useContext(MyCtx)"))).toBe(true);
		});

		it("matches useReducer hook", () => {
			expect(content.some((r) => r.test("useReducer(reducer, init)"))).toBe(true);
		});

		it("matches useMemo hook", () => {
			expect(content.some((r) => r.test("useMemo(() => val, [val])"))).toBe(true);
		});

		it("matches useRef hook", () => {
			expect(content.some((r) => r.test("const ref = useRef(null)"))).toBe(true);
		});

		it('matches "use client" directive', () => {
			expect(content.some((r) => r.test('"use client"'))).toBe(true);
		});

		it('matches "use server" directive', () => {
			expect(content.some((r) => r.test("'use server'"))).toBe(true);
		});

		it("does not match unrelated content", () => {
			expect(content.some((r) => r.test("const x = 42"))).toBe(false);
		});
	});
});

describe("reactIntegration.getHydrationScript()", () => {
	const script = reactIntegration.getHydrationScript();

	it("returns a non-empty string", () => {
		expect(script).toBeTruthy();
		expect(typeof script).toBe("string");
		expect(script.length).toBeGreaterThan(0);
	});

	it('contains a query selector for data-framework="react"', () => {
		expect(script).toContain('data-framework="react"');
	});

	it("contains dynamic import logic", () => {
		expect(script).toContain("import(");
	});
});
