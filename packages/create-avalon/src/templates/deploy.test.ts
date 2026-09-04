import { describe, expect, it } from "vitest";
import type { ProjectConfig } from "../types";
import {
	cloudflareProjectName,
	generateBuildMjs,
	generateCloudflareHeaders,
	generateDeployReadme,
	generateGitignore,
	generateNetlifyToml,
	generateWranglerToml,
} from "./deploy";

const baseConfig: ProjectConfig = {
	projectName: "My Cool App",
	core: "preact",
	integrations: [],
	styling: "css-modules",
	plugins: [],
	middleware: "h3",
	deploy: "none",
};

describe("cloudflareProjectName", () => {
	it("slugifies project names for Pages", () => {
		expect(cloudflareProjectName("My Cool App")).toBe("my-cool-app");
		expect(cloudflareProjectName("Avalon!!!")).toBe("avalon");
		expect(cloudflareProjectName("---")).toBe("avalon-app");
	});
});

describe("generateWranglerToml", () => {
	it("emits Pages output dir and nodejs_compat flags", () => {
		const toml = generateWranglerToml({ ...baseConfig, deploy: "cloudflare" });
		expect(toml).toContain('name = "my-cool-app"');
		expect(toml).toContain('compatibility_date = "2026-09-04"');
		expect(toml).toContain("nodejs_compat");
		expect(toml).toContain("enable_nodejs_fs_module");
		expect(toml).toContain('pages_build_output_dir = "./dist"');
	});
});

describe("generateCloudflareHeaders", () => {
	it("sets cache headers for HTML and islands", () => {
		const headers = generateCloudflareHeaders();
		expect(headers).toContain("/*.html");
		expect(headers).toContain("/islands/*");
		expect(headers).toContain("must-revalidate");
	});
});

describe("generateNetlifyToml", () => {
	it("sets NITRO_PRESET and soft SSR redirect", () => {
		const toml = generateNetlifyToml({ ...baseConfig, deploy: "netlify" });
		expect(toml).toContain('NITRO_PRESET = "netlify"');
		expect(toml).toContain('publish = "dist"');
		expect(toml).toContain("/.netlify/functions/server");
	});
});

describe("generateBuildMjs", () => {
	it("auto-detects Cloudflare and Netlify presets and waits for CF worker", () => {
		const src = generateBuildMjs();
		expect(src).toContain("wrangler.toml");
		expect(src).toContain("cloudflare_pages");
		expect(src).toContain("netlify.toml");
		expect(src).toContain("isCloudflareWorkerReady");
		expect(src).toContain("post-build failed");
	});
});

describe("generateDeployReadme", () => {
	it("documents Cloudflare Pages create + deploy", () => {
		const md = generateDeployReadme({ ...baseConfig, deploy: "cloudflare" });
		expect(md).toContain("Cloudflare Pages");
		expect(md).toContain("pages project create my-cool-app");
		expect(md).toContain("post-build");
	});

	it("documents Netlify soft redirect behavior", () => {
		const md = generateDeployReadme({ ...baseConfig, deploy: "netlify" });
		expect(md).toContain("Netlify");
		expect(md).toContain("netlify.toml");
	});
});

describe("generateGitignore", () => {
	it("ignores platform build dirs", () => {
		const gi = generateGitignore(baseConfig);
		expect(gi).toContain(".wrangler/");
		expect(gi).toContain(".netlify/");
		expect(gi).toContain("dist/");
	});
});
