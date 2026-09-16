import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	CliArgError,
	parseCliArgs,
	resolveConfigNonInteractive,
	validateDirectory,
} from "./cli-utils";

describe("parseCliArgs", () => {
	it("returns defaults when no args provided", () => {
		const result = parseCliArgs([]);
		expect(result).toEqual({
			projectName: undefined,
			help: false,
			version: false,
			yes: false,
			core: undefined,
			integrations: undefined,
			styling: undefined,
			plugins: undefined,
			middleware: undefined,
			deploy: undefined,
			cron: false,
		});
	});

	it("extracts project name from positional argument", () => {
		const result = parseCliArgs(["my-app"]);
		expect(result.projectName).toBe("my-app");
		expect(result.help).toBe(false);
		expect(result.version).toBe(false);
	});

	it("parses --help flag", () => {
		const result = parseCliArgs(["--help"]);
		expect(result.help).toBe(true);
		expect(result.version).toBe(false);
		expect(result.projectName).toBeUndefined();
	});

	it("parses -h short flag", () => {
		const result = parseCliArgs(["-h"]);
		expect(result.help).toBe(true);
	});

	it("parses --version flag", () => {
		const result = parseCliArgs(["--version"]);
		expect(result.version).toBe(true);
		expect(result.help).toBe(false);
		expect(result.projectName).toBeUndefined();
	});

	it("parses -v short flag", () => {
		const result = parseCliArgs(["-v"]);
		expect(result.version).toBe(true);
	});

	it("handles project name with --version flag", () => {
		const result = parseCliArgs(["my-app", "--version"]);
		expect(result.projectName).toBe("my-app");
		expect(result.version).toBe(true);
	});

	it("handles project name with --help flag", () => {
		const result = parseCliArgs(["--help", "my-app"]);
		expect(result.projectName).toBe("my-app");
		expect(result.help).toBe(true);
	});

	it("uses only the first positional as project name", () => {
		const result = parseCliArgs(["first", "second"]);
		expect(result.projectName).toBe("first");
	});

	it("handles project name with hyphens and numbers", () => {
		const result = parseCliArgs(["my-cool-app-2"]);
		expect(result.projectName).toBe("my-cool-app-2");
	});

	it("throws on unknown flags", () => {
		expect(() => parseCliArgs(["--unknown"])).toThrow();
	});

	it("parses --yes and -y", () => {
		expect(parseCliArgs(["--yes"]).yes).toBe(true);
		expect(parseCliArgs(["-y"]).yes).toBe(true);
	});

	it("parses per-prompt string flags", () => {
		const result = parseCliArgs([
			"my-app",
			"--core",
			"react",
			"--integrations",
			"react,vue",
			"--styling",
			"shadcn",
			"--plugins",
			"seo,agent-optimization",
			"--middleware",
			"hono",
			"--deploy",
			"netlify",
			"--cron",
		]);
		expect(result).toMatchObject({
			projectName: "my-app",
			core: "react",
			integrations: "react,vue",
			styling: "shadcn",
			plugins: "seo,agent-optimization",
			middleware: "hono",
			deploy: "netlify",
			cron: true,
		});
	});
});

describe("resolveConfigNonInteractive", () => {
	const base = parseCliArgs([]);

	it("applies interactive defaults when no flags are set", () => {
		const config = resolveConfigNonInteractive({ ...base, projectName: "my-app" });
		expect(config).toEqual({
			projectName: "my-app",
			core: "preact",
			integrations: ["preact"],
			styling: "css-modules",
			plugins: ["seo"],
			middleware: "h3",
			deploy: "none",
			cron: false,
		});
	});

	it("forces the preact integration when core is preact", () => {
		const config = resolveConfigNonInteractive({ ...base, projectName: "my-app" });
		expect(config.core).toBe("preact");
		expect(config.integrations).toContain("preact");
	});

	it("defaults projectName to '.' when omitted", () => {
		expect(resolveConfigNonInteractive(base).projectName).toBe(".");
	});

	it("parses comma lists and trims whitespace", () => {
		const config = resolveConfigNonInteractive({
			...base,
			integrations: "react, vue ,svelte",
			plugins: "seo, syntax-highlighting",
		});
		expect(config.integrations).toEqual(["react", "vue", "svelte", "preact"]);
		expect(config.plugins).toEqual(["seo", "syntax-highlighting"]);
	});

	it("forces the react integration when core is react", () => {
		const config = resolveConfigNonInteractive({ ...base, core: "react" });
		expect(config.core).toBe("react");
		expect(config.integrations).toContain("react");
	});

	it("does not duplicate react when already listed", () => {
		const config = resolveConfigNonInteractive({
			...base,
			core: "react",
			integrations: "react,vue",
		});
		expect(config.integrations.filter((i) => i === "react")).toHaveLength(1);
	});

	it("rejects an unknown enum value", () => {
		expect(() => resolveConfigNonInteractive({ ...base, styling: "bootstrap" })).toThrow(
			CliArgError,
		);
	});

	it("rejects an unknown value inside a comma list", () => {
		expect(() => resolveConfigNonInteractive({ ...base, integrations: "react,angular" })).toThrow(
			/angular/,
		);
	});

	it("rejects shadcn without the react engine", () => {
		expect(() => resolveConfigNonInteractive({ ...base, styling: "shadcn" })).toThrow(CliArgError);
		// but allows it with core=react
		expect(resolveConfigNonInteractive({ ...base, core: "react", styling: "shadcn" }).styling).toBe(
			"shadcn",
		);
	});
});

describe("validateDirectory", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(
			tmpdir(),
			`create-avalon-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
	});

	afterEach(() => {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// ignore cleanup errors
		}
	});

	it("returns valid for a non-existent directory", () => {
		const result = validateDirectory(testDir);
		expect(result).toEqual({ valid: true });
	});

	it("returns valid for an empty existing directory", () => {
		mkdirSync(testDir, { recursive: true });
		const result = validateDirectory(testDir);
		expect(result).toEqual({ valid: true });
	});

	it("returns invalid for a non-empty directory", () => {
		mkdirSync(testDir, { recursive: true });
		writeFileSync(join(testDir, "file.txt"), "content");
		const result = validateDirectory(testDir);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error).toContain(testDir);
		}
	});

	it("returns invalid when directory has subdirectories", () => {
		mkdirSync(join(testDir, "subdir"), { recursive: true });
		const result = validateDirectory(testDir);
		expect(result.valid).toBe(false);
	});

	it("returns invalid when directory has multiple files", () => {
		mkdirSync(testDir, { recursive: true });
		writeFileSync(join(testDir, "a.ts"), "");
		writeFileSync(join(testDir, "b.ts"), "");
		const result = validateDirectory(testDir);
		expect(result.valid).toBe(false);
		if (!result.valid) {
			expect(result.error).toContain("not empty");
		}
	});
});
