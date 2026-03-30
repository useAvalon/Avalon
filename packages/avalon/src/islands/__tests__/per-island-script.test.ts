import { describe, it, expect } from "vitest";
import { generatePerIslandScript } from "../per-island-script.ts";
import type { PerIslandScriptOptions } from "../per-island-script.ts";

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

	it("imports loadIntegrationModule from the component chunk", () => {
		const result = generatePerIslandScript(makeOpts());
		expect(result).toContain("m.loadIntegrationModule");
	});

	it("calls integration.hydrate", () => {
		const result = generatePerIslandScript(makeOpts());
		expect(result).toContain("i.hydrate");
	});

	it("sets data-hydrated on success", () => {
		const result = generatePerIslandScript(makeOpts());
		expect(result).toContain('dataset.hydrated="true"');
	});

	describe("on:client strategy", () => {
		it("uses requestIdleCallback or requestAnimationFrame", () => {
			const result = generatePerIslandScript(makeOpts({ condition: "on:client" }));
			expect(result).toContain("requestIdleCallback");
			expect(result).toContain("requestAnimationFrame");
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
