import { describe, expect, it } from "vitest";
import type { PerIslandScriptOptions } from "../per-island-script.ts";
import { generatePerIslandScript } from "../per-island-script.ts";

function makeOpts(overrides: Partial<PerIslandScriptOptions> = {}): PerIslandScriptOptions {
	return {
		islandId: "island-Counter-tsx",
		componentSrc: "/islands/Counter.js",
		framework: "solid",
		condition: "on:client",
		propsJson: '{"count":0}',
		...overrides,
	};
}

describe("generatePerIslandScript", () => {
	it("returns a script tag with type=module", () => {
		const result = generatePerIslandScript(makeOpts());
		expect(result).toMatch(/^<script type="module">.*<\/script>$/s);
	});

	it("includes the component import path", () => {
		const result = generatePerIslandScript(makeOpts({ componentSrc: "/islands/Todo.js" }));
		expect(result).toContain("/islands/Todo.js");
	});

	it("includes the framework identifier", () => {
		const result = generatePerIslandScript(makeOpts({ framework: "preact" }));
		expect(result).toContain('"preact"');
	});

	it("includes the island element ID for querySelector", () => {
		const result = generatePerIslandScript(makeOpts({ islandId: "island-my-comp" }));
		expect(result).toContain("island-my-comp");
	});

	it("includes the props JSON", () => {
		const result = generatePerIslandScript(makeOpts({ propsJson: '{"title":"hello"}' }));
		expect(result).toContain('{"title":"hello"}');
	});

	it.each([
		"m.loadIntegrationModule",
		"i.hydrate",
		'renderStrategy==="client-only"',
		"__mountIsland",
		"i.mount",
	])("emits %s in the hydrate call", (snippet) => {
		expect(generatePerIslandScript(makeOpts())).toContain(snippet);
	});

	it("sets data-hydrated on success", () => {
		const result = generatePerIslandScript(makeOpts());
		expect(result).toContain('dataset.hydrated="true"');
	});

	describe("on:client strategy", () => {
		it("hydrates immediately when the module loads", () => {
			const result = generatePerIslandScript(makeOpts({ condition: "on:client" }));
			// on:client means hydrate as soon as the module loads — the script calls h()
			// directly with no deferral (no requestIdleCallback / IntersectionObserver wrapper).
			expect(result).toContain("h();");
			expect(result).not.toContain("requestIdleCallback");
			expect(result).not.toContain("IntersectionObserver");
		});
	});

	describe("on:visible strategy", () => {
		it("uses IntersectionObserver", () => {
			const result = generatePerIslandScript(makeOpts({ condition: "on:visible" }));
			expect(result).toContain("IntersectionObserver");
			expect(result).toContain("isIntersecting");
		});

		it("sets rootMargin for early trigger", () => {
			const result = generatePerIslandScript(makeOpts({ condition: "on:visible" }));
			expect(result).toContain("50px");
		});
	});

	describe("on:idle strategy", () => {
		it("uses requestIdleCallback with timeout", () => {
			const result = generatePerIslandScript(makeOpts({ condition: "on:idle" }));
			expect(result).toContain("requestIdleCallback");
			expect(result).toContain("5000");
		});

		it("falls back to setTimeout for browsers without requestIdleCallback", () => {
			const result = generatePerIslandScript(makeOpts({ condition: "on:idle" }));
			expect(result).toContain("setTimeout");
		});
	});

	describe("on:interaction strategy", () => {
		it("listens for click, touchstart, mouseenter, focusin", () => {
			const result = generatePerIslandScript(makeOpts({ condition: "on:interaction" }));
			expect(result).toContain("click");
			expect(result).toContain("touchstart");
			expect(result).toContain("mouseenter");
			expect(result).toContain("focusin");
		});

		it("removes event listeners after first trigger", () => {
			const result = generatePerIslandScript(makeOpts({ condition: "on:interaction" }));
			expect(result).toContain("removeEventListener");
		});
	});

	describe("media: strategy", () => {
		it("uses matchMedia with the specified query", () => {
			const result = generatePerIslandScript(makeOpts({ condition: "media:(min-width: 768px)" }));
			expect(result).toContain("matchMedia");
			expect(result).toContain("(min-width: 768px)");
		});
	});

	describe("custom directive", () => {
		it("inlines the directive script", () => {
			const directiveScript = "(el, hydrate) => { setTimeout(hydrate, 1000); }";
			const result = generatePerIslandScript(
				makeOpts({
					condition: "on:delay" as any,
					isCustomDirective: true,
					directiveScript,
				}),
			);
			expect(result).toContain("setTimeout(hydrate, 1000)");
		});

		it("passes conditionArg to the directive", () => {
			const directiveScript = "(el, hydrate, arg) => { setTimeout(hydrate, parseInt(arg)); }";
			const result = generatePerIslandScript(
				makeOpts({
					condition: "on:delay" as any,
					isCustomDirective: true,
					directiveScript,
					conditionArg: "2000",
				}),
			);
			expect(result).toContain('"2000"');
		});
	});

	describe("Lit framework", () => {
		it("uses the same hydration pattern as other frameworks", () => {
			const result = generatePerIslandScript(
				makeOpts({ framework: "lit", componentSrc: "/islands/Counter.lit.js" }),
			);
			// Lit preLitHydration is handled by the island chunk wrapper (top-level await),
			// not by the per-island script. The script just imports and hydrates normally.
			expect(result).toContain("m.loadIntegrationModule");
			expect(result).toContain("/islands/Counter.lit.js");
		});
	});

	describe("unknown condition fallback", () => {
		it("hydrates immediately for unknown conditions", () => {
			const result = generatePerIslandScript(makeOpts({ condition: "on:unknown" as any }));
			// Should call h() directly without any strategy wrapper
			expect(result).toContain("h();");
		});
	});

	it("each script is self-contained (no external runtime dependency)", () => {
		const result = generatePerIslandScript(makeOpts());
		// Should NOT reference main.js, main-slim.js, or strategies.js
		expect(result).not.toContain("main.js");
		expect(result).not.toContain("main-slim.js");
		expect(result).not.toContain("strategies.js");
	});
});

describe("generatePerIslandScript - script-context prop escaping (XSS)", () => {
	it("does not allow a prop value to break out of the inline <script>", () => {
		const propsJson = JSON.stringify({ msg: "</script><img src=x onerror=alert(1)>" });
		const result = generatePerIslandScript(makeOpts({ propsJson }));

		// The raw closing-tag sequence must not appear in the emitted script body,
		// otherwise the payload would terminate the <script> element early.
		const body = result.replace(/^<script type="module">/, "").replace(/<\/script>$/, "");
		expect(body).not.toContain("</script>");
		expect(body).not.toContain("<img");
		// The `<` is encoded so the value stays a valid JS expression.
		expect(body).toContain(String.raw`\u003c`);
	});

	it("escapes JS line terminators U+2028 / U+2029 in props", () => {
		const propsJson = JSON.stringify({ a: "x\u2028y\u2029z" });
		const result = generatePerIslandScript(makeOpts({ propsJson }));
		expect(result).not.toContain("\u2028");
		expect(result).not.toContain("\u2029");
		expect(result).toContain(String.raw`\u2028`);
		expect(result).toContain(String.raw`\u2029`);
	});
});
