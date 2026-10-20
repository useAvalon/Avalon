import { describe, expect, it } from "vitest";
import { ensureDevClientScripts } from "../../render/dev-css-select.ts";

describe("ensureDevClientScripts", () => {
	it("adds project entry when only /@vite/client is in the head", () => {
		const html =
			'<html><head><script type="module" src="/@vite/client"></script></head><body><main /></body></html>';
		const out = ensureDevClientScripts(html, "app/entry-client");
		expect(out).toContain("/@vite/client");
		expect(out).toContain('src="/app/entry-client"');
		expect(out).not.toContain('src="/app/entry-client.ts"');
		const mainScript = out.indexOf('src="/app/entry-client"');
		const bodyClose = out.indexOf("</body>");
		expect(mainScript).toBeGreaterThan(-1);
		expect(bodyClose).toBeGreaterThan(mainScript);
	});

	it("adds /@vite/client when only main.js is present", () => {
		const html =
			'<html><head></head><body><script type="module" src="/src/client/main.js"></script></body></html>';
		const out = ensureDevClientScripts(html, "app/entry-client");
		expect(out).toContain("/@vite/client");
		expect(out.match(/\/@vite\/client/g)?.length).toBe(1);
	});

	it("does not duplicate scripts when both are already present", () => {
		const html =
			'<html><head><script type="module" src="/@vite/client"></script></head><body><script type="module" src="/app/entry-client"></script></body></html>';
		const out = ensureDevClientScripts(html, "app/entry-client");
		expect(out.match(/\/@vite\/client/g)?.length).toBe(1);
		expect(out.match(/entry-client/g)?.length).toBe(1);
	});

	it("leaves extensionless client entries unchanged", () => {
		const html = "<html><head></head><body></body></html>";
		const out = ensureDevClientScripts(html, "src/entry-client");
		expect(out).toContain('src="/src/entry-client"');
		expect(out).not.toContain("/src/entry-client.ts");
	});

	it("keeps an explicit client-entry extension", () => {
		const html = "<html><head></head><body></body></html>";
		const out = ensureDevClientScripts(html, "app/entry-client.tsx");
		expect(out).toContain('src="/app/entry-client.tsx"');
	});
});
