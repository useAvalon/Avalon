import { describe, expect, it } from "vitest";
import type { Integration, ProjectConfig } from "../types";
import {
	generateEnvDts,
	generateFrameworkTsConfigs,
	generateTsConfig,
	generateViteEnvDts,
} from "./tsconfig";

describe("generateTsConfig", () => {
	it("returns valid JSON with 2-space indent", () => {
		const result = generateTsConfig();
		expect(() => JSON.parse(result)).not.toThrow();
		expect(result).toContain('  "compilerOptions"');
	});

	it("sets compilerOptions correctly", () => {
		const tsconfig = JSON.parse(generateTsConfig());
		const opts = tsconfig.compilerOptions;
		expect(opts.target).toBe("ESNext");
		expect(opts.module).toBe("ESNext");
		expect(opts.moduleResolution).toBe("bundler");
		expect(opts.strict).toBe(true);
		expect(opts.esModuleInterop).toBe(true);
		expect(opts.skipLibCheck).toBe(true);
		expect(opts.allowArbitraryExtensions).toBe(true);
		expect(opts.allowImportingTsExtensions).toBe(true);
		expect(opts.noEmit).toBe(true);
		expect(opts.jsx).toBe("react-jsx");
	});

	it("does not include types array (uses env.d.ts triple-slash reference instead)", () => {
		const tsconfig = JSON.parse(generateTsConfig());
		expect(tsconfig.compilerOptions.types).toBeUndefined();
	});

	it("includes @shared/* and @modules/* path aliases", () => {
		const tsconfig = JSON.parse(generateTsConfig());
		const paths = tsconfig.compilerOptions.paths;
		expect(paths["@shared/*"]).toEqual(["./app/shared/*"]);
		expect(paths["@modules/*"]).toEqual(["./app/modules/*"]);
	});

	it("includes .d.ts files in include array", () => {
		const tsconfig = JSON.parse(generateTsConfig());
		expect(tsconfig.include).toContain("app/**/*.d.ts");
	});

	it("includes all required glob patterns in include array", () => {
		const tsconfig = JSON.parse(generateTsConfig());
		expect(tsconfig.include).toEqual([
			"app/**/*.ts",
			"app/**/*.tsx",
			"app/**/*.d.ts",
			"server/**/*.ts",
			"routes/**/*.ts",
			"middleware/**/*.ts",
			"vite.config.ts",
			"vite-env.d.ts",
		]);
	});

	it("has exactly 2 path aliases", () => {
		const tsconfig = JSON.parse(generateTsConfig());
		expect(Object.keys(tsconfig.compilerOptions.paths)).toHaveLength(2);
	});

	it("has exactly 8 include patterns", () => {
		const tsconfig = JSON.parse(generateTsConfig());
		expect(tsconfig.include).toHaveLength(8);
	});

	it("does not exclude or reference JSX island projects when no JSX integrations are selected", () => {
		const tsconfig = JSON.parse(generateTsConfig("preact", ["preact", "svelte"]));
		expect(tsconfig.exclude).toEqual([]);
		expect(tsconfig.references).toEqual([]);
	});

	it("excludes only selected JSX island extensions from the page-shell project", () => {
		const integrations: Integration[] = ["preact", "react", "solid", "qwik"];
		const tsconfig = JSON.parse(generateTsConfig("preact", integrations));
		expect(tsconfig.exclude).toEqual([
			"app/**/*.react.tsx",
			"app/**/*.react.jsx",
			"app/**/*.solid.tsx",
			"app/**/*.solid.jsx",
			"app/**/*.qwik.tsx",
			"app/**/*.qwik.jsx",
		]);
		expect(tsconfig.references).toEqual([
			{ path: "./tsconfig.react.json" },
			{ path: "./tsconfig.solid.json" },
			{ path: "./tsconfig.qwik.json" },
		]);
	});
});

describe("generateFrameworkTsConfigs", () => {
	it("gives each island extension its own jsxImportSource", () => {
		const files = generateFrameworkTsConfigs(["react", "solid", "qwik"]);
		expect(JSON.parse(files["tsconfig.react.json"]).compilerOptions.jsxImportSource).toBe("react");
		expect(JSON.parse(files["tsconfig.solid.json"]).compilerOptions.jsxImportSource).toBe(
			"solid-js",
		);
		expect(JSON.parse(files["tsconfig.qwik.json"]).compilerOptions.jsxImportSource).toBe(
			"@builder.io/qwik",
		);
	});

	it("emits only tsconfigs for selected JSX integrations", () => {
		const files = generateFrameworkTsConfigs(["preact", "svelte"]);
		expect(Object.keys(files)).toEqual([]);
	});
});

describe("generateViteEnvDts", () => {
	const baseConfig: ProjectConfig = {
		projectName: "my-app",
		core: "preact",
		integrations: [],
		styling: "css-modules",
		plugins: ["seo"],
		middleware: "h3",
		deploy: "none",
	};

	it("references Node types for vite.config.ts", () => {
		expect(generateViteEnvDts(baseConfig)).toContain('/// <reference types="node" />');
	});

	it("declares @useavalon/seo when the seo plugin is selected", () => {
		expect(generateViteEnvDts(baseConfig)).toContain("declare module '@useavalon/seo'");
		expect(generateViteEnvDts({ ...baseConfig, plugins: [] })).not.toContain(
			"declare module '@useavalon/seo'",
		);
	});

	it("declares @tailwindcss/vite when tailwind styling is selected", () => {
		const config: ProjectConfig = { ...baseConfig, styling: "tailwind" };
		expect(generateViteEnvDts(config)).toContain("declare module '@tailwindcss/vite'");
	});
});

describe("generateEnvDts", () => {
	it("includes triple-slash reference to avalon types", () => {
		const result = generateEnvDts();
		expect(result).toContain('/// <reference types="@useavalon/avalon/types" />');
	});

	it("includes auto-generated header", () => {
		const result = generateEnvDts();
		expect(result).toContain("Auto-generated by create-avalon");
	});

	it("always includes plain and CSS module declarations", () => {
		const result = generateEnvDts();
		expect(result).toContain("declare module '*.css';");
		expect(result).toContain("declare module '*.module.css'");
	});

	it("always includes Nitro asset manifest declarations", () => {
		const result = generateEnvDts();
		expect(result).toContain("declare module '*?assets=client'");
		expect(result).toContain("declare module '*?assets=ssr'");
	});

	it("only includes module declarations for selected integrations", () => {
		const result = generateEnvDts(["vue", "solid"]);
		expect(result).toContain("declare module '*.vue'");
		expect(result).toContain("declare module '*.solid.tsx'");
		expect(result).not.toContain("declare module '*.svelte'");
		expect(result).not.toContain("declare module '*.lit.ts'");
		expect(result).not.toContain("declare module '*.qwik.tsx'");
	});

	it("includes no framework module declarations when no integrations selected", () => {
		const result = generateEnvDts([]);
		expect(result).not.toContain("declare module '*.vue'");
		expect(result).not.toContain("declare module '*.svelte'");
		expect(result).not.toContain("declare module '*.solid.tsx'");
		expect(result).not.toContain("declare module '*.lit.ts'");
		expect(result).not.toContain("declare module '*.qwik.tsx'");
	});
});
