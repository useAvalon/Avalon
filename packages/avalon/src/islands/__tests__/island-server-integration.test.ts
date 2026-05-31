import preactRenderToString from "preact-render-to-string";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateKey } from "../../server-islands/encryption.ts";
import { clearManifest, generateComponentId, getManifest } from "../../server-islands/manifest.ts";
import { renderIsland } from "../island.tsx";

// Use a stable key for tests
const testKey = generateKey();
const originalKey = process.env.AVALON_KEY;

beforeAll(() => {
	process.env.AVALON_KEY = testKey;
});

afterAll(() => {
	if (originalKey === undefined) {
		delete process.env.AVALON_KEY;
	} else {
		process.env.AVALON_KEY = originalKey;
	}
});

describe("renderIsland - server island integration", () => {
	beforeAll(() => {
		clearManifest();
	});

	it("delegates to renderServerIsland when server prop is present", async () => {
		clearManifest();
		const result = await renderIsland({
			src: "/islands/UserAvatar.tsx",
			server: {},
			props: { userId: 42 },
		});

		const html = preactRenderToString(result);
		expect(html).toContain("avalon-server-island");
		expect(html).toContain("/_server-islands/");
		expect(html).toContain('<script type="module">');
	});

	it("registers the component in the manifest", async () => {
		clearManifest();
		const src = "/islands/TestComponent.tsx";
		await renderIsland({
			src,
			server: {},
			props: {},
		});

		const manifest = getManifest();
		const expectedId = generateComponentId(src);
		expect(manifest[expectedId]).toBe(src);
	});

	it("passes component props to the server island renderer", async () => {
		clearManifest();
		const result = await renderIsland({
			src: "/islands/Cart.tsx",
			server: {},
			props: { count: 5, label: "items" },
		});

		const html = preactRenderToString(result);
		// The encrypted props should be in the data-p attribute
		expect(html).toContain("data-p=");
	});

	it("passes island directive for combined server+client islands", async () => {
		clearManifest();
		const result = await renderIsland({
			src: "/islands/NotificationBell.tsx",
			server: {},
			island: { condition: "on:visible" },
			props: { userId: 1 },
		});

		const html = preactRenderToString(result);
		// Combined islands include hydration script execution logic
		expect(html).toContain("querySelectorAll");
		expect(html).toContain("replaceWith");
	});

	it("does not include hydration logic for pure server islands (no island prop)", async () => {
		clearManifest();
		const result = await renderIsland({
			src: "/islands/PureServer.tsx",
			server: {},
			props: {},
		});

		const html = preactRenderToString(result);
		expect(html).not.toContain("querySelectorAll");
	});

	it("skips normal island rendering when server prop is present", async () => {
		clearManifest();
		const result = await renderIsland({
			src: "/islands/ServerOnly.tsx",
			server: {},
			props: { data: "test" },
		});

		const html = preactRenderToString(result);
		// Should NOT contain normal island markers
		expect(html).not.toContain("<avalon-island");
		// Should contain server island markers
		expect(html).toContain("avalon-server-island");
	});

	it("renders normally when server prop is absent", async () => {
		clearManifest();
		const result = await renderIsland({
			src: "/islands/NormalIsland.tsx",
			props: {},
			condition: "on:client",
		});

		const html = preactRenderToString(result);
		// Should contain normal island element, not server island
		expect(html).toContain("avalon-island");
		expect(html).not.toContain("avalon-server-island");
	});
});
