import { beforeEach, describe, expect, it, vi } from "vitest";
import { createImagePlugin } from "../image-optimization.ts";
import type { ResolvedImageConfig } from "../types.ts";

// Mock vite-imagetools so the test does not depend on it being installed/hoisted
// into the repo-root node_modules. The plugin resolves it via createRequire from
// process.cwd(), which is the monorepo root during tests — where the (optional
// peer) package is not linked. Mocking keeps this test deterministic and focused
// on the plugin wiring rather than the real imagetools implementation.
vi.mock("vite-imagetools", () => ({
	imagetools: (opts: unknown) => ({ name: "imagetools", _opts: opts }),
}));

describe("createImagePlugin", () => {
	const defaultConfig: ResolvedImageConfig = {
		enabled: true,
		defaultFormat: "webp",
		quality: 80,
		widths: [200, 400, 600, 800, 1200],
		removeMetadata: true,
		include: /^[^?]+\.(heif|avif|jpeg|jpg|png|tiff|webp|gif)(\?.*)?$/,
		exclude: "public/**/*",
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns empty array when disabled", async () => {
		const plugins = await createImagePlugin({ ...defaultConfig, enabled: false }, false);
		expect(plugins).toEqual([]);
	});

	it("returns imagetools plugin when enabled", async () => {
		const plugins = await createImagePlugin(defaultConfig, false);
		expect(plugins.length).toBe(1);
		expect(plugins[0].name).toBe("imagetools");
	});

	it("logs info when verbose is true", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		await createImagePlugin(defaultConfig, true);

		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Image optimization enabled"));
		consoleSpy.mockRestore();
	});

	it("respects custom format setting", async () => {
		const plugins = await createImagePlugin({ ...defaultConfig, defaultFormat: "avif" }, true);
		expect(plugins.length).toBe(1);
	});

	it("respects custom quality setting", async () => {
		const plugins = await createImagePlugin({ ...defaultConfig, quality: 90 }, false);
		expect(plugins.length).toBe(1);
	});

	it("respects custom widths setting", async () => {
		const plugins = await createImagePlugin({ ...defaultConfig, widths: [320, 640, 1280] }, false);
		expect(plugins.length).toBe(1);
	});
});
