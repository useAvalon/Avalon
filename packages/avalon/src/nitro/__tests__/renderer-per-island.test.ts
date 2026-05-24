import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

	it("injects the shared hydration script when islands are present", () => {
		const html = `<html><body>
<avalon-island data-framework="solid" data-src="/islands/Counter.js"></avalon-island>
</body></html>`;

		const result = injectHydrationScript(html, false);
		expect(result).toContain('<script type="module" src="/dist/client.js"></script>');
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
