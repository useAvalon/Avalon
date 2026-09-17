import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scaffoldProject } from "./scaffold";
import type { ProjectConfig } from "./types";
import { BASE_DIRS } from "./types";

describe("scaffoldProject", () => {
	let tempDir: string;

	const baseConfig: ProjectConfig = {
		projectName: "test-project",
		core: "preact",
		integrations: ["react"],
		styling: "css-modules",
		plugins: [],
		middleware: "h3",
		deploy: "none",
	};

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "scaffold-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	async function exists(path: string): Promise<boolean> {
		try {
			await stat(path);
			return true;
		} catch {
			return false;
		}
	}

	async function read(relativePath: string): Promise<string> {
		return readFile(join(tempDir, "out", relativePath), "utf-8");
	}

	it("creates all BASE_DIRS inside the target directory", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		for (const dir of BASE_DIRS) {
			const dirStat = await stat(join(target, dir));
			expect(dirStat.isDirectory(), `${dir} should be a directory`).toBe(true);
		}
	});

	it("generates package.json with correct project name", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		const pkg = JSON.parse(await read("package.json"));
		expect(pkg.name).toBe("test-project");
		expect(pkg.type).toBe("module");
		expect(pkg.private).toBe(true);
	});

	it("generates tsconfig.json with path aliases", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		const tsconfig = JSON.parse(await read("tsconfig.json"));
		expect(tsconfig.compilerOptions.paths["@shared/*"]).toEqual(["./app/shared/*"]);
		expect(tsconfig.compilerOptions.paths["@modules/*"]).toEqual(["./app/modules/*"]);
	});

	it("generates vite.config.ts", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		const content = await read("vite.config.ts");
		expect(content).toContain("import { avalon } from '@useavalon/avalon'");
		expect(content).toContain("modules: 'app/modules'");
	});

	it("generates root layout, main layout, and main page", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		const rootLayout = await read("app/shared/layouts/_layout.tsx");
		expect(rootLayout).toContain("RootLayout");

		const mainLayout = await read("app/modules/main/layouts/_layout.tsx");
		expect(mainLayout).toContain("MainLayout");

		const mainPage = await read("app/modules/main/pages/index.tsx");
		expect(mainPage).toContain("HomePage");
	});

	it("scaffolds an about module that maps to /about", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		const aboutPage = await read("app/modules/about/pages/index.tsx");
		expect(aboutPage).toContain("AboutPage");
		expect(aboutPage).toContain("/about");

		const aboutLayout = await read("app/modules/about/layouts/_layout.tsx");
		expect(aboutLayout).toContain("AboutLayout");
	});

	it("generates middleware and API route", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		const middleware = await read("middleware/01.logger.ts");
		expect(middleware).toContain("defineHandler");

		const apiRoute = await read("routes/api/hello.ts");
		expect(apiRoute).toContain("Hello from Avalon!");
	});

	it("generates styling files for css-modules", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		expect(await exists(join(target, "app/shared/styles/main.css"))).toBe(true);
		expect(await exists(join(target, "app/shared/styles/reset.css"))).toBe(true);
		expect(await exists(join(target, "app/shared/styles/tokens.css"))).toBe(true);
		expect(await exists(join(target, "app/shared/layouts/_layout.module.css"))).toBe(true);
		expect(await exists(join(target, "app/modules/main/pages/index.module.css"))).toBe(true);
	});

	it("generates tailwind files when styling is tailwind", async () => {
		const config: ProjectConfig = { ...baseConfig, styling: "tailwind" };
		const target = join(tempDir, "out");
		await scaffoldProject(config, target);

		expect(await exists(join(target, "tailwind.config.js"))).toBe(true);
		expect(await exists(join(target, "app/shared/styles/global.css"))).toBe(true);
		// Should NOT have css-modules files
		expect(await exists(join(target, "app/shared/styles/tokens.css"))).toBe(false);
		// Should NOT have reset.css — Tailwind preflight handles resets
		expect(await exists(join(target, "app/shared/styles/reset.css"))).toBe(false);
	});

	it("generates shadcn files including components.json and cn utility", async () => {
		const config: ProjectConfig = { ...baseConfig, styling: "shadcn" };
		const target = join(tempDir, "out");
		await scaffoldProject(config, target);

		expect(await exists(join(target, "tailwind.config.js"))).toBe(true);
		expect(await exists(join(target, "components.json"))).toBe(true);
		// Should NOT have reset.css — Tailwind preflight handles resets
		expect(await exists(join(target, "app/shared/styles/reset.css"))).toBe(false);
		// Should have cn utility
		expect(await exists(join(target, "app/shared/utils/cn.ts"))).toBe(true);
		const cn = await read("app/shared/utils/cn.ts");
		expect(cn).toContain("twMerge");
		expect(cn).toContain("clsx");
	});

	it("creates favicon.ico with Avalon icon", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		const buf = await readFile(join(target, "public/favicon.ico"));
		expect(buf.length).toBeGreaterThan(0);
		// ICO magic bytes: 00 00 01 00
		expect(buf[0]).toBe(0);
		expect(buf[1]).toBe(0);
		expect(buf[2]).toBe(1);
		expect(buf[3]).toBe(0);
	});

	it("creates server/env.d.ts with nitro reference", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		const content = await read("server/env.d.ts");
		expect(content).toContain('/// <reference types="nitro" />');
	});

	it("creates app/env.d.ts with avalon types reference and auto-generated header", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		const content = await read("app/env.d.ts");
		expect(content).toContain('/// <reference types="@useavalon/avalon/types" />');
		expect(content).toContain("Auto-generated by create-avalon");
		expect(content).toContain("declare module '*.module.css'");
	});

	it("creates server/renderer.ts with virtual module export", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		const content = await read("server/renderer.ts");
		expect(content).toContain("virtual:avalon/renderer");
		expect(content).toContain("useavalon.dev/docs/ssr-renderer");
	});

	it("does not generate index.html", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		expect(await exists(join(target, "index.html"))).toBe(false);
	});

	it("does not generate platform config when deploy is none", async () => {
		const target = join(tempDir, "out");
		await scaffoldProject(baseConfig, target);

		expect(await exists(join(target, "netlify.toml"))).toBe(false);
		expect(await exists(join(target, "wrangler.toml"))).toBe(false);
		expect(await exists(join(target, "public/_headers"))).toBe(false);
		// build.mjs and post-build.mjs are always generated (Vite hangs without the wrapper)
		expect(await exists(join(target, "build.mjs"))).toBe(true);
		expect(await exists(join(target, "post-build.mjs"))).toBe(true);
		expect(await exists(join(target, "DEPLOY.md"))).toBe(true);
		expect(await exists(join(target, ".gitignore"))).toBe(true);
	});

	it("generates netlify.toml, build.mjs, and post-build.mjs when deploy is netlify", async () => {
		const config: ProjectConfig = { ...baseConfig, deploy: "netlify" };
		const target = join(tempDir, "out");
		await scaffoldProject(config, target);

		const toml = await read("netlify.toml");
		expect(toml).toContain('NITRO_PRESET = "netlify"');
		expect(toml).toContain('publish = "dist"');

		const buildMjs = await read("build.mjs");
		expect(buildMjs).toContain("vite build");
		expect(buildMjs).toContain("cloudflare_pages");

		const postBuild = await read("post-build.mjs");
		expect(postBuild).toContain("post-build");

		const deployMd = await read("DEPLOY.md");
		expect(deployMd).toContain("Netlify");
	});

	it("generates wrangler.toml, _headers, and CF scripts when deploy is cloudflare", async () => {
		const config: ProjectConfig = { ...baseConfig, projectName: "Demo Site", deploy: "cloudflare" };
		const target = join(tempDir, "out");
		await scaffoldProject(config, target);

		const toml = await read("wrangler.toml");
		expect(toml).toContain('name = "demo-site"');
		expect(toml).toContain("nodejs_compat");
		expect(toml).toContain('pages_build_output_dir = "./dist"');

		const headers = await read("public/_headers");
		expect(headers).toContain("/islands/*");

		const pkg = JSON.parse(await read("package.json"));
		expect(pkg.scripts.preview).toContain("wrangler@4 pages dev");
		expect(pkg.scripts.deploy).toContain("--project-name=demo-site");

		const vite = await read("vite.config.ts");
		expect(vite).toContain("compatibilityDate: '2026-09-04'");

		const deployMd = await read("DEPLOY.md");
		expect(deployMd).toContain("Cloudflare Pages");
		expect(deployMd).toContain("pages project create demo-site");

		expect(await exists(join(target, "netlify.toml"))).toBe(false);
	});

	it("uses hono patterns when middleware is hono", async () => {
		const config: ProjectConfig = { ...baseConfig, middleware: "hono" };
		const target = join(tempDir, "out");
		await scaffoldProject(config, target);

		// Middleware and routes always use defineHandler
		const middleware = await read("middleware/01.logger.ts");
		expect(middleware).toContain("defineHandler");

		const apiRoute = await read("routes/api/hello.ts");
		expect(apiRoute).toContain("defineHandler");

		// Hono goes in server.ts entry file
		const serverEntry = await read("server.ts");
		expect(serverEntry).toContain("Hono");
	});

	it("uses elysia patterns when middleware is elysia", async () => {
		const config: ProjectConfig = { ...baseConfig, middleware: "elysia" };
		const target = join(tempDir, "out");
		await scaffoldProject(config, target);

		// Middleware and routes always use defineHandler
		const middleware = await read("middleware/01.logger.ts");
		expect(middleware).toContain("defineHandler");

		const apiRoute = await read("routes/api/hello.ts");
		expect(apiRoute).toContain("defineHandler");

		// Elysia goes in server.ts entry file
		const serverEntry = await read("server.ts");
		expect(serverEntry).toContain("Elysia");
	});
});
