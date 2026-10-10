#!/usr/bin/env node
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import {
	CliArgError,
	parseCliArgs,
	parseTemplateFlag,
	resolveConfigNonInteractive,
	validateDirectory,
} from "./cli-utils";
import { collectProjectConfig } from "./prompts";
import { scaffoldProject } from "./scaffold";
import { printSummary } from "./summary";

async function main(): Promise<void> {
	const args = parseCliArgs(process.argv.slice(2));

	if (args.version) {
		const require = createRequire(import.meta.url);
		const pkg = require("../package.json") as { version: string };
		console.log(pkg.version);
		process.exit(0);
	}

	if (args.help) {
		console.log(
			[
				"Usage: create-avalon [project-name] [options]",
				"",
				"Runs interactively by default. Pass --yes (or run without a TTY, e.g. in",
				"CI/Docker) to scaffold non-interactively from flags + defaults.",
				"",
				"Options:",
				"  -v, --version        Show version number",
				"  -h, --help           Show help",
				"  -y, --yes            Skip prompts; use flags and defaults",
				"      --core           Rendering engine: preact (default) | react",
				"      --integrations   Comma list: preact,react,vue,svelte,solid,lit,qwik",
				"      --styling        css-modules (default) | tailwind | shadcn",
				"      --plugins        Comma list: seo (default),agent-optimization",
				"      --middleware     h3 (default) | hono | elysia",
				"      --deploy         cloudflare | netlify | none (default)",
				"      --cron           Scaffold an example cron task + config",
				"      --template       default (default) | blog — MDX blog + Pages CMS config",
				"",
				"Example:",
				"  create-avalon my-app --template blog",
				"  create-avalon my-app --yes --core react --integrations react,vue --styling shadcn",
			].join("\n"),
		);
		process.exit(0);
	}

	// If a project name was provided via CLI, validate the directory early
	// Skip validation for "." — user explicitly wants to scaffold in current dir
	if (args.projectName && args.projectName !== ".") {
		const dirResult = validateDirectory(resolve(args.projectName));
		if (!dirResult.valid) {
			console.error(dirResult.error);
			process.exit(1);
		}
	}

	// Skip interactive prompts when --yes is passed or stdin isn't a TTY
	// (CI/Docker). This is what makes non-interactive builds truly reliable —
	// a prompt would otherwise hang forever with no way to answer it.
	const nonInteractive = args.yes || !process.stdin.isTTY;

	parseTemplateFlag(args.template);

	// Collect all prompts before any filesystem work
	const config = nonInteractive
		? resolveConfigNonInteractive(args)
		: await collectProjectConfig(args.projectName, parseTemplateFlag(args.template));

	// If the project name came from the prompt (not CLI arg), validate now
	if (!args.projectName && config.projectName !== ".") {
		const dirResult = validateDirectory(resolve(config.projectName));
		if (!dirResult.valid) {
			console.error(dirResult.error);
			process.exit(1);
		}
	}

	// Resolve the target directory and normalize the project name.
	// "." means scaffold into the current directory — use its basename
	// as the package name instead of a literal ".".
	const targetDir = resolve(config.projectName);
	const scaffoldedInPlace = config.projectName === ".";
	if (scaffoldedInPlace) {
		config.projectName = basename(targetDir);
	}

	await scaffoldProject(config, targetDir);
	printSummary(config, scaffoldedInPlace);
	process.exit(0);
}

// Run CLI
try {
	await main();
} catch (error) {
	// Invalid-flag errors get a clean one-line message; anything unexpected
	// prints in full for debugging.
	console.error(error instanceof CliArgError ? error.message : error);
	process.exit(1);
}
