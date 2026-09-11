import { h } from "preact";
import { describe, expect, it } from "vitest";
import { decrypt, generateKey } from "../encryption.ts";
import { renderServerIsland } from "../renderer.ts";

// Use a stable key for tests
const testKey = generateKey();

// Set the key in env so encrypt/decrypt use it
const originalKey = process.env.AVALON_KEY;
process.env.AVALON_KEY = testKey;

describe("renderServerIsland", () => {
	it("renders a wrapper element with the correct id", () => {
		const html = renderServerIsland("abc123", { userId: 1 }, {});
		// Element IDs include a per-instance suffix (si-<componentId>-<n>)
		expect(html).toMatch(/<avalon-server-island id="si-abc123-\d+"/);
		expect(html).toContain("</avalon-server-island>");
	});

	it("includes encoded props in data-p attribute", () => {
		const props = { userId: 42, name: "test" };
		const html = renderServerIsland("comp1", props, {});

		// Extract data-p value from the HTML
		const match = html.match(/data-p="([^"]+)"/);
		expect(match).not.toBeNull();

		const encodedValue = match![1];
		// Vite serve uses `dev.` + base64url; production/prerender uses AES ciphertext.
		expect(encodedValue).toMatch(/^(dev\.)?[A-Za-z0-9_-]+$/);

		// Decode the payload back to the original props
		let decoded: string;
		if (encodedValue.startsWith("dev.")) {
			decoded = Buffer.from(encodedValue.slice(4), "base64url").toString("utf8");
		} else {
			decoded = decrypt(encodedValue);
		}
		expect(JSON.parse(decoded)).toEqual(props);
	});

	it("never emits a bare Rolldown-fragile always-dev NODE_ENV check", async () => {
		// Regression: `const IS_DEV = (globalThis.process?.env ?? {}).NODE_ENV !== "production"`
		// was compiled to `IS_DEV = {}.NODE_ENV !== "production"` (always true), so prerendered
		// HTML shipped `dev.` payloads that production endpoints reject.
		const { readFileSync } = await import("node:fs");
		const { fileURLToPath } = await import("node:url");
		const src = readFileSync(fileURLToPath(new URL("../renderer.ts", import.meta.url)), "utf8");
		expect(src).not.toContain("globalThis.process?.env ?? {}");
		expect(src).toContain("import.meta.env");
	});

	it("renders fallback content inside the wrapper", () => {
		const fallback = h("div", { class: "skeleton" }, "Loading...");
		const html = renderServerIsland("comp2", {}, { fallback });

		expect(html).toContain("Loading...");
		expect(html).toContain('class="skeleton"');
	});

	it("renders empty fallback when none is provided", () => {
		const html = renderServerIsland("comp3", {}, {});
		// The wrapper should be present but with no fallback content
		expect(html).toMatch(/<avalon-server-island id="si-comp3-\d+"/);
		expect(html).toMatch(/data-p="[^"]+"><\/avalon-server-island>/);
	});

	it("generates an inline fetch script", () => {
		const html = renderServerIsland("comp4", { x: 1 }, {});
		expect(html).toContain('<script type="module">');
		expect(html).toContain("/_server-islands/comp4");
		expect(html).toContain("fetch(");
		expect(html).toContain("</script>");
	});

	it("uses default timeout of 10000ms", () => {
		const html = renderServerIsland("comp5", {}, {});
		expect(html).toContain('data-timeout="10000"');
		expect(html).toContain("Number(el.dataset.timeout)||10000");
	});

	it("uses custom timeout when specified", () => {
		const html = renderServerIsland("comp6", {}, { timeout: 5000 });
		expect(html).toContain('data-timeout="5000"');
		expect(html).toContain("Number(el.dataset.timeout)||5000");
	});

	it("puts the endpoint on the wrapper and guards against double-fetch", () => {
		const html = renderServerIsland("comp4b", {}, {});
		expect(html).toContain('data-endpoint="/_server-islands/comp4b"');
		expect(html).toContain("el.dataset.siStarted");
	});

	it("uses GET for small payloads and POST threshold at 2048", () => {
		const html = renderServerIsland("comp7", { small: true }, {});
		// The script should contain the 2048 threshold check
		expect(html).toContain("url.length>2048");
	});

	it("includes hydration script execution for combined islands", () => {
		const html = renderServerIsland("comp8", { data: "test" }, {}, { condition: "on:visible" });
		// Should include script re-execution logic for hydration
		expect(html).toContain("querySelectorAll('script[type=\"module\"]')");
		expect(html).toContain("replaceWith");
	});

	it("does not include hydration logic for pure server islands", () => {
		const html = renderServerIsland("comp9", {}, {});
		expect(html).not.toContain("querySelectorAll");
		expect(html).not.toContain("replaceWith");
	});

	it("uses AbortController for timeout handling", () => {
		const html = renderServerIsland("comp10", {}, {});
		expect(html).toContain("AbortController");
		expect(html).toContain("ctrl.abort()");
		expect(html).toContain("signal:ctrl.signal");
	});

	it("clears timeout on success and error", () => {
		const html = renderServerIsland("comp11", {}, {});
		// clearTimeout should appear twice: once after successful fetch, once in catch
		const clearTimeoutCount = (html.match(/clearTimeout\(t\)/g) || []).length;
		expect(clearTimeoutCount).toBe(2);
	});

	it("escapes HTML-sensitive characters in encrypted props attribute", () => {
		// Props that when encrypted might produce characters needing escaping
		const html = renderServerIsland("comp12", { html: "<script>alert('xss')</script>" }, {});
		// The data-p attribute should not contain unescaped < or >
		const attrMatch = html.match(/data-p="([^"]+)"/);
		expect(attrMatch).not.toBeNull();
		expect(attrMatch![1]).not.toContain("<");
		expect(attrMatch![1]).not.toContain(">");
	});
});

// Restore env
if (originalKey === undefined) {
	delete process.env.AVALON_KEY;
} else {
	process.env.AVALON_KEY = originalKey;
}
