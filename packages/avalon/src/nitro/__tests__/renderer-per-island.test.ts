import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearDirectives, registerHydrationDirective } from "../../islands/hydration-directives.ts";
import { injectHydrationScript } from "../renderer.ts";

describe("injectHydrationScript — per-island mode", () => {
	const savedMode = globalThis.__avalonHydrationMode;

	beforeEach(() => {
		globalThis.__avalonHydrationMode = "per-island";
	});

	afterEach(() => {
		globalThis.__avalonHydrationMode = savedMode;
	});

	it("does not inject a shared hydration script in per-island mode", () => {
		const html = `<html><body>
<avalon-island data-framework="solid" data-src="/islands/Counter.js"></avalon-island>
</body></html>`;

		const result = injectHydrationScript(html, false);
		expect(result).not.toContain("/dist/client.js");
		expect(result).not.toContain("/src/client/main.js");
	});

	it("unwraps per-island script wrappers from the HTML", () => {
		const html = `<html><body>
<avalon-island id="island-Counter" data-framework="solid"></avalon-island>
<div data-island-script=""><script type="module">console.log("hydrate")</script></div>
</body></html>`;

		const result = injectHydrationScript(html, false);
		// The wrapper div should be removed
		expect(result).not.toContain("data-island-script");
		// But the script tag should remain
		expect(result).toContain('<script type="module">console.log("hydrate")</script>');
	});

	it("unwraps multiple per-island script wrappers", () => {
		const html = `<html><body>
<avalon-island id="island-A" data-framework="solid"></avalon-island>
<div data-island-script=""><script type="module">hydrate("A")</script></div>
<avalon-island id="island-B" data-framework="preact"></avalon-island>
<div data-island-script=""><script type="module">hydrate("B")</script></div>
</body></html>`;

		const result = injectHydrationScript(html, false);
		expect(result).toContain('<script type="module">hydrate("A")</script>');
		expect(result).toContain('<script type="module">hydrate("B")</script>');
		expect(result).not.toContain("data-island-script");
	});
});

describe("injectHydrationScript — entry-client mode (dev mode default)", () => {
	const savedMode = globalThis.__avalonHydrationMode;

	beforeEach(() => {
		globalThis.__avalonHydrationMode = undefined;
	});

	afterEach(() => {
		globalThis.__avalonHydrationMode = savedMode;
	});

	it("injects shared script in production when hydration mode is entry-client", () => {
		globalThis.__avalonHydrationMode = "entry-client";
		const html = `<html><body>
<avalon-island data-framework="solid" data-src="/islands/Counter.js"></avalon-island>
</body></html>`;

		const result = injectHydrationScript(html, false);
		expect(result).toContain('<script type="module" src="/dist/client.js"></script>');
	});

	it("forces per-island mode in production regardless of the hydration flag", () => {
		const html = `<html><body>
<avalon-island data-framework="solid" data-src="/islands/Counter.js"></avalon-island>
</body></html>`;

		// In production (isDev=false), per-island mode is always used even when the
		// __avalonHydrationMode flag is unset (the Nitro SSR runtime is a separate JS
		// realm where the flag may not propagate). No shared runtime script is injected.
		const result = injectHydrationScript(html, false);
		expect(result).not.toContain("/dist/client.js");
		expect(result).not.toContain("/src/client/main.js");
	});

	it("injects dev script in development mode", () => {
		const html = `<html><body>
<avalon-island data-framework="solid" data-src="/islands/Counter.js"></avalon-island>
</body></html>`;

		const result = injectHydrationScript(html, true);
		expect(result).toContain('<script type="module" src="/src/client/main.js"></script>');
	});

	it("does not inject when no islands are present", () => {
		const html = `<html><body><div>No islands</div></body></html>`;

		const result = injectHydrationScript(html, false);
		expect(result).toBe(html);
	});
});

describe("injectHydrationScript — custom directive bootstrap", () => {
	const savedMode = globalThis.__avalonHydrationMode;

	beforeEach(() => {
		globalThis.__avalonHydrationMode = "entry-client";
		registerHydrationDirective("on:countdown", {
			name: "on:countdown",
			script: (_el, hydrate) => {
				hydrate();
			},
		});
	});

	afterEach(() => {
		clearDirectives();
		globalThis.__avalonHydrationMode = savedMode;
	});

	it("injects the directive module before the hashed entry-client script", () => {
		const html = `<html><body>
<avalon-island data-framework="preact"></avalon-island>
<script type="module" src="/assets/entry-client-abc.js"></script>
</body></html>`;
		const result = injectHydrationScript(html, false);
		const bootstrapAt = result.indexOf("globalThis.__AVALON_DIRECTIVES__");
		const entryAt = result.indexOf("/assets/entry-client-abc.js");
		expect(bootstrapAt).toBeGreaterThan(-1);
		expect(entryAt).toBeGreaterThan(bootstrapAt);
		expect(result).toContain('"on:countdown"');
	});

	it("injects the bootstrap even when the page has no islands", () => {
		const html = `<html><body><div>Home</div></body></html>`;
		const result = injectHydrationScript(html, false);
		expect(result).toContain("globalThis.__AVALON_DIRECTIVES__");
	});

	it("puts a nonce on the inline bootstrap when scriptNonce is set", () => {
		const html = `<html><body><div>Home</div></body></html>`;
		const result = injectHydrationScript(html, false, { scriptNonce: "n-1" });
		expect(result).toContain('<script type="module" nonce="n-1">');
	});

	it("loads the bootstrap from a same-origin src when set", () => {
		const html = `<html><body>
<script type="module" src="/assets/entry-client-abc.js"></script>
</body></html>`;
		const result = injectHydrationScript(html, false, {
			directiveBootstrapSrc: "/_avalon/directives.js",
		});
		expect(result).toContain('<script type="module" src="/_avalon/directives.js"></script>');
		expect(result.indexOf("/_avalon/directives.js")).toBeLessThan(
			result.indexOf("/assets/entry-client-abc.js"),
		);
		expect(result).not.toContain("globalThis.__AVALON_DIRECTIVES__");
	});
});
