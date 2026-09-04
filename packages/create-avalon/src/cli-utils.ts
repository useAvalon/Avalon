import { existsSync, readdirSync } from "node:fs";
import { parseArgs } from "node:util";
import {
	DEPLOY_TARGETS,
	type DeployTarget,
	INTEGRATIONS,
	type Integration,
	MIDDLEWARE_OPTIONS,
	type MiddlewareOption,
	PLUGINS,
	type Plugin,
	type ProjectConfig,
	RENDER_ENGINES,
	type RenderEngine,
	STYLING_OPTIONS,
	type StylingOption,
} from "./types";

export interface CLIArgs {
	projectName: string | undefined;
	help: boolean;
	version: boolean;
	/** Skip interactive prompts and use flags + defaults. */
	yes: boolean;
	core: string | undefined;
	integrations: string | undefined;
	styling: string | undefined;
	plugins: string | undefined;
	middleware: string | undefined;
	deploy: string | undefined;
	cron: boolean;
}

/** Thrown for invalid CLI flag values; the CLI prints `.message` and exits 1. */
export class CliArgError extends Error {}

export type DirectoryValidationResult = { valid: true } | { valid: false; error: string };

export function validateDirectory(dir: string): DirectoryValidationResult {
	if (!existsSync(dir)) {
		return { valid: true };
	}

	const entries = readdirSync(dir);
	if (entries.length === 0) {
		return { valid: true };
	}

	return {
		valid: false,
		error: `Directory "${dir}" already exists and is not empty.`,
	};
}

export function parseCliArgs(argv: string[]): CLIArgs {
	const { values, positionals } = parseArgs({
		args: argv,
		options: {
			help: { type: "boolean", default: false, short: "h" },
			version: { type: "boolean", default: false, short: "v" },
			yes: { type: "boolean", default: false, short: "y" },
			core: { type: "string" }, // preact | react
			integrations: { type: "string" }, // comma list: react,vue
			styling: { type: "string" }, // css-modules | tailwind | shadcn
			plugins: { type: "string" }, // comma list: seo,agent-optimization
			middleware: { type: "string" }, // h3 | hono | elysia
			deploy: { type: "string" }, // cloudflare | netlify | none
			cron: { type: "boolean", default: false },
		},
		strict: true,
		allowPositionals: true,
	});

	return {
		projectName: positionals[0] ?? undefined,
		help: values.help ?? false,
		version: values.version ?? false,
		yes: values.yes ?? false,
		core: values.core,
		integrations: values.integrations,
		styling: values.styling,
		plugins: values.plugins,
		middleware: values.middleware,
		deploy: values.deploy,
		cron: values.cron ?? false,
	};
}

/** Split a comma-separated flag into trimmed, non-empty values. */
const csv = (value?: string): string[] | undefined =>
	value
		? value
				.split(",")
				.map((v) => v.trim())
				.filter(Boolean)
		: undefined;

/** Validate a single value against an allowed set, or throw a clear error. */
function assertOneOf<T extends string>(
	value: string | undefined,
	allowed: readonly T[],
	flag: string,
): T | undefined {
	if (value === undefined) return undefined;
	if (!(allowed as readonly string[]).includes(value)) {
		throw new CliArgError(
			`Invalid value "${value}" for --${flag}. Allowed: ${allowed.join(", ")}.`,
		);
	}
	return value as T;
}

/** Validate every value in a list against an allowed set, or throw. */
function assertAllOf<T extends string>(
	values: string[] | undefined,
	allowed: readonly T[],
	flag: string,
): T[] | undefined {
	if (values === undefined) return undefined;
	for (const value of values) {
		if (!(allowed as readonly string[]).includes(value)) {
			throw new CliArgError(
				`Invalid value "${value}" for --${flag}. Allowed: ${allowed.join(", ")}.`,
			);
		}
	}
	return values as T[];
}

/**
 * Build a ProjectConfig from CLI flags without prompting. Missing flags fall
 * back to the same defaults the interactive prompts use. Invalid values throw
 * a {@link CliArgError}. Used for `--yes` runs and non-TTY (CI/Docker) builds.
 */
export function resolveConfigNonInteractive(args: CLIArgs): ProjectConfig {
	const core: RenderEngine = assertOneOf(args.core, RENDER_ENGINES, "core") ?? "preact";
	const integrations: Integration[] =
		assertAllOf(csv(args.integrations), INTEGRATIONS, "integrations") ?? [];
	const styling: StylingOption =
		assertOneOf(args.styling, STYLING_OPTIONS, "styling") ?? "css-modules";
	const plugins: Plugin[] = assertAllOf(csv(args.plugins), PLUGINS, "plugins") ?? ["seo"];
	const middleware: MiddlewareOption =
		assertOneOf(args.middleware, MIDDLEWARE_OPTIONS, "middleware") ?? "h3";
	const deploy: DeployTarget = assertOneOf(args.deploy, DEPLOY_TARGETS, "deploy") ?? "none";

	// shadcn is Radix-based and only works on the React engine.
	if (styling === "shadcn" && core !== "react") {
		throw new CliArgError("--styling=shadcn requires --core=react (shadcn is Radix/React based).");
	}

	// A React shell requires the React integration; ensure it's present.
	if (core === "react" && !integrations.includes("react")) {
		integrations.push("react");
	}

	return {
		projectName: args.projectName ?? ".",
		core,
		integrations,
		styling,
		plugins,
		middleware,
		deploy,
		cron: args.cron,
	};
}
