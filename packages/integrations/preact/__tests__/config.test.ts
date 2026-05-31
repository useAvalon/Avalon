import { describe, expect, it } from "vitest";
import { preactIntegration } from "../mod.ts";

describe("preactIntegration.config()", () => {
	const cfg = preactIntegration.config();

	it('returns "preact" as the integration name', () => {
		expect(cfg.name).toBe("preact");
	});

	it("declares .tsx and .jsx file extensions", () => {
		expect(cfg.fileExtensions).toEqual([".tsx", ".jsx"]);
	});

	it('declares "preact" as a JSX import source', () => {
		expect(cfg.jsxImportSources).toContain("preact");
	});

	describe("detection patterns - imports", () => {
		const { imports } = cfg.detectionPatterns;

		it('matches bare "preact" import', () => {
			expect(imports.some((r) => r.test("preact"))).toBe(true);
		});

		it('matches "preact/" subpath import', () => {
			expect(imports.some((r) => r.test("preact/hooks"))).toBe(true);
		});

		it('matches from "preact" import statement', () => {
			const code = "import { h } from 'preact'";
			expect(imports.some((r) => r.test(code))).toBe(true);
		});

		it('matches from "preact/hooks" import statement', () => {
			const code = "import { useState } from 'preact/hooks'";
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

		it("matches useRef hook", () => {
			expect(content.some((r) => r.test("const ref = useRef(null)"))).toBe(true);
		});

		it("matches useMemo hook", () => {
			expect(content.some((r) => r.test("useMemo(() => val, [val])"))).toBe(true);
		});

		it("matches useCallback hook", () => {
			expect(content.some((r) => r.test("useCallback(() => {}, [])"))).toBe(true);
		});

		it("matches useContext hook", () => {
			expect(content.some((r) => r.test("const ctx = useContext(MyCtx)"))).toBe(true);
		});

		it("matches useReducer hook", () => {
			expect(content.some((r) => r.test("useReducer(reducer, init)"))).toBe(true);
		});

		it("matches h() call", () => {
			expect(content.some((r) => r.test("h('div', null, 'hello')"))).toBe(true);
		});

		it("matches Fragment", () => {
			expect(content.some((r) => r.test("<Fragment>"))).toBe(true);
		});

		it("does not match unrelated content", () => {
			expect(content.some((r) => r.test("const x = 42"))).toBe(false);
		});
	});
});

describe("preactIntegration.getHydrationScript()", () => {
	const script = preactIntegration.getHydrationScript();

	it("returns a non-empty string", () => {
		expect(script).toBeTruthy();
		expect(typeof script).toBe("string");
		expect(script.length).toBeGreaterThan(0);
	});

	it('contains a query selector for data-framework="preact"', () => {
		expect(script).toContain('data-framework="preact"');
	});

	it("contains dynamic import logic", () => {
		expect(script).toContain("import(");
	});
});
