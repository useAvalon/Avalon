import { describe, expect, it } from "vitest";
import type { ProjectConfig } from "../types";
import { generateViteConfig } from "./vite-config";

describe("generateViteConfig", () => {
	const baseConfig: ProjectConfig = {
		projectName: "my-app",
		integrations: [],
		styling: "css-modules",
		plugins: [],
		middleware: "h3",
		deploy: "none",
	};

	it("imports defineConfig from vite and avalon from @useavalon/avalon", () => {
		const result = generateViteConfig(baseConfig);
		expect(result).toContain(`import { resolve } from 'node:path';`);
		expect(result).toContain(`import { defineConfig, type UserConfig } from 'vite';`);
		expect(result).toContain(`import { avalon } from '@useavalon/avalon';`);
	});

	it("exports an async defineConfig call", () => {
		const result = generateViteConfig(baseConfig);
		expect(result).toContain("export default defineConfig(async ()");
	});

	it("calls avalon() as async and spreads the result into plugins", () => {
		const result = generateViteConfig(baseConfig);
		expect(result).toContain("const avalonPlugins = await avalon({");
		expect(result).toContain("...avalonPlugins,");
	});

	it("configures modules and layoutsDir in avalon plugin", () => {
		const result = generateViteConfig(baseConfig);
		expect(result).toContain(`modules: 'app/modules'`);
		expect(result).toContain(`layoutsDir: 'app/shared/layouts'`);
	});

	it("includes nitro config with preset, streaming, clientEntry, and globalCSS", () => {
		const result = generateViteConfig(baseConfig);
		expect(result).toContain(`nitro: {`);
		expect(result).toContain(`process.env.NITRO_PRESET || 'node_server'`);
		expect(result).toContain(`streaming: true`);
		expect(result).toContain(`clientEntry: 'app/entry-client'`);
		expect(result).toContain(`globalCSS: ['app/shared/styles/main.css']`);
	});

	it("includes environments block for client and SSR builds", () => {
		const result = generateViteConfig(baseConfig);
		expect(result).toContain(`environments: {`);
		expect(result).toContain(`input: './app/entry-client.ts'`);
		expect(result).toContain(`input: './server/renderer.ts'`);
	});

	it("uses resolve alias array format", () => {
		const result = generateViteConfig(baseConfig);
		expect(result).toContain(`alias: [`);
		expect(result).toContain(`find: '@shared'`);
		expect(result).toContain(`find: '@modules'`);
		expect(result).toContain(`find: '@/'`);
	});

	it("includes selected integrations as strings in the integrations array", () => {
		const config: ProjectConfig = {
			...baseConfig,
			integrations: ["react", "vue"],
		};
		const result = generateViteConfig(config);
		// Integrations are strings, not function calls
		expect(result).toContain(`'react'`);
		expect(result).toContain(`'vue'`);
		// Should NOT import integration packages
		expect(result).not.toContain(`from '@useavalon/react'`);
		expect(result).not.toContain(`from '@useavalon/vue'`);
	});

	it("uses empty integrations array when none selected", () => {
		const result = generateViteConfig(baseConfig);
		expect(result).toContain(`integrations: []`);
	});

	it("includes tailwindcss plugin when styling is tailwind", () => {
		const config: ProjectConfig = { ...baseConfig, styling: "tailwind" };
		const result = generateViteConfig(config);
		expect(result).toContain(`import tailwindcss from '@tailwindcss/vite';`);
		expect(result).toContain("tailwindcss()");
	});

	it("includes tailwindcss plugin when styling is shadcn", () => {
		const config: ProjectConfig = { ...baseConfig, styling: "shadcn" };
		const result = generateViteConfig(config);
		expect(result).toContain(`import tailwindcss from '@tailwindcss/vite';`);
		expect(result).toContain("tailwindcss()");
	});

	it("does not include tailwindcss plugin when styling is css-modules", () => {
		const result = generateViteConfig(baseConfig);
		expect(result).not.toContain("tailwindcss");
		expect(result).not.toContain("@tailwindcss/vite");
	});

	it("includes agentOptimization plugin with config when agent-optimization is selected", () => {
		const config: ProjectConfig = {
			...baseConfig,
			plugins: ["agent-optimization"],
		};
		const result = generateViteConfig(config);
		expect(result).toContain(`import { agentOptimization } from '@useavalon/agent-optimization';`);
		expect(result).toContain("agentOptimization({");
		expect(result).toContain("sitemap:");
		expect(result).toContain("markdown: true");
	});

	it("does not include agentOptimization when plugin not selected", () => {
		const result = generateViteConfig(baseConfig);
		expect(result).not.toContain("agentOptimization");
		expect(result).not.toContain("@useavalon/agent-optimization");
	});

	it("generates a full config with all options selected", () => {
		const config: ProjectConfig = {
			projectName: "full-app",
			integrations: ["react", "svelte", "qwik"],
			styling: "shadcn",
			plugins: ["agent-optimization"],
			middleware: "hono",
		};
		const result = generateViteConfig(config);

		// Imports — only avalon, tailwind, and agent-optimization (no integration imports)
		expect(result).toContain(`import { avalon } from '@useavalon/avalon';`);
		expect(result).toContain(`import tailwindcss from '@tailwindcss/vite';`);
		expect(result).toContain(`import { agentOptimization } from '@useavalon/agent-optimization';`);

		// Integrations as strings
		expect(result).toContain(`'react'`);
		expect(result).toContain(`'svelte'`);
		expect(result).toContain(`'qwik'`);

		// Plugins
		expect(result).toContain("tailwindcss()");
		expect(result).toContain("agentOptimization({");

		// Config
		expect(result).toContain(`modules: 'app/modules'`);
		expect(result).toContain(`layoutsDir: 'app/shared/layouts'`);
	});
});
