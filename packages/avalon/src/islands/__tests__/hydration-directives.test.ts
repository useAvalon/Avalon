import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
	clearDirectives,
	customDirectiveBootstrapScript,
	registerHydrationDirective,
} from "../hydration-directives.ts";

afterEach(() => {
	clearDirectives();
});

describe("directive registry", () => {
	it("stores registrations on globalThis so duplicate module copies share them", () => {
		registerHydrationDirective("on:shared", {
			name: "on:shared",
			script: () => {},
		});
		const bag = (
			globalThis as typeof globalThis & {
				__AVALON_HYDRATION_DIRECTIVE_REGISTRY__?: Map<string, unknown>;
			}
		).__AVALON_HYDRATION_DIRECTIVE_REGISTRY__;
		expect(bag?.has("on:shared")).toBe(true);
	});
});

describe("customDirectiveBootstrapScript", () => {
	it("returns null when nothing is registered", () => {
		expect(customDirectiveBootstrapScript()).toBeNull();
	});

	it("emits a module that assigns the directive function", () => {
		registerHydrationDirective("on:countdown", {
			name: "on:countdown",
			script: (_el, hydrate, arg) => {
				setTimeout(hydrate, Number.parseInt(arg || "5", 10));
			},
		});
		const html = customDirectiveBootstrapScript();
		expect(html).toContain('<script type="module">');
		expect(html).toContain("globalThis.__AVALON_DIRECTIVES__");
		expect(html).toContain('"on:countdown"');
		expect(html).toContain("setTimeout");
		expect(html).not.toContain("new Function");
		expect(html).not.toContain("eval(");
	});

	it("escapes script breakout in serialized source", () => {
		registerHydrationDirective("on:xss", {
			name: "on:xss",
			script: "</script><script>alert(1)",
		});
		const html = customDirectiveBootstrapScript();
		expect(html).not.toMatch(/<\/script><script>/i);
		expect(html).toContain("<\\/script");
	});

	it("escapes script breakout in the directive name", () => {
		registerHydrationDirective("on:x</script><script>alert(1)", {
			name: "on:x</script><script>alert(1)",
			script: (_el, hydrate) => {
				hydrate();
			},
		});
		const html = customDirectiveBootstrapScript();
		expect(html).not.toMatch(/<\/script><script>/i);
		expect(html).toContain("<\\/script");
	});

	it("adds a CSP nonce on the inline module", () => {
		registerHydrationDirective("on:delay", {
			name: "on:delay",
			script: (_el, hydrate) => {
				hydrate();
			},
		});
		const html = customDirectiveBootstrapScript({ nonce: 'abc"<>' });
		expect(html).toContain('nonce="abc&quot;&lt;&gt;"');
		expect(html).toContain("globalThis.__AVALON_DIRECTIVES__");
	});

	it("wraps a string body in a function expression", () => {
		registerHydrationDirective("on:delay", {
			name: "on:delay",
			script: "setTimeout(hydrate, 1000)",
		});
		const html = customDirectiveBootstrapScript();
		expect(html).toContain("(function(el,hydrate,arg){setTimeout(hydrate, 1000)})");
		expect(html).not.toContain(":(setTimeout(hydrate, 1000))");
	});

	it("rewrites method-shorthand toString output into a function expression", () => {
		const method = {
			script(_el: HTMLElement, hydrate: () => void) {
				hydrate();
			},
		}.script;
		registerHydrationDirective("on:method", {
			name: "on:method",
			script: method,
		});
		const html = customDirectiveBootstrapScript();
		expect(html).toContain("(function(");
		expect(html).not.toMatch(/:\(script\(/);
	});

	it("emits an external module tag when src is set", () => {
		registerHydrationDirective("on:delay", {
			name: "on:delay",
			script: (_el, hydrate) => {
				hydrate();
			},
		});
		const html = customDirectiveBootstrapScript({ src: "/_avalon/directives.js", nonce: "n1" });
		expect(html).toBe('<script type="module" src="/_avalon/directives.js" nonce="n1"></script>');
		expect(html).not.toContain("globalThis.__AVALON_DIRECTIVES__");
	});
});

describe("custom-directives client runtime", () => {
	it("does not evaluate strings as JavaScript", () => {
		const src = readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), "../../client/custom-directives.js"),
			"utf8",
		);
		expect(src).not.toContain("new Function");
		expect(src).not.toContain("eval(");
	});
});
