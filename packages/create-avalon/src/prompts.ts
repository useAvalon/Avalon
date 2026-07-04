import { cancel, intro, isCancel, multiselect, select, text } from "@clack/prompts";
import type {
	DeployTarget,
	Integration,
	MiddlewareOption,
	Plugin,
	ProjectConfig,
	RenderEngine,
	StylingOption,
} from "./types";

export async function collectProjectConfig(initialName?: string): Promise<ProjectConfig> {
	intro("create-avalon");

	let projectName = initialName;

	if (!projectName) {
		const nameResult = await text({
			message: "What is your project name?",
			placeholder: "my-avalon-app",
			validate(value = "") {
				if (!value.trim()) return "Project name is required.";
			},
		});

		if (isCancel(nameResult)) {
			cancel("Operation cancelled.");
			process.exit(1);
		}

		projectName = nameResult;
	}

	const coreResult = await select({
		message: "Which rendering engine should render your pages (the shell)?",
		options: [
			{
				value: "preact",
				label: "Preact",
				hint: "Smallest runtime (default). React libs run via preact/compat.",
			},
			{
				value: "react",
				label: "React",
				hint: "Real react-dom/server. React libs like Radix/shadcn work natively.",
			},
		],
		initialValue: "preact",
	});

	if (isCancel(coreResult)) {
		cancel("Operation cancelled.");
		process.exit(1);
	}

	const integrationsResult = await multiselect({
		message:
			"Which integrations would you like to include? (use space to toggle, enter to confirm)",
		options: [
			{ value: "preact", label: "preact", hint: "Preact 10" },
			{ value: "react", label: "react", hint: "React 19" },
			{ value: "vue", label: "vue", hint: "Vue 3" },
			{ value: "svelte", label: "svelte", hint: "Svelte 5" },
			{ value: "solid", label: "solid", hint: "SolidJS" },
			{ value: "lit", label: "lit", hint: "Lit 3" },
			{ value: "qwik", label: "qwik", hint: "Qwik" },
		],
		required: false,
	});

	if (isCancel(integrationsResult)) {
		cancel("Operation cancelled.");
		process.exit(1);
	}

	// shadcn is built on Radix (React), so it only makes sense on the React engine.
	const stylingOptions: Array<{ value: StylingOption; label: string; hint?: string }> = [
		{ value: "css-modules", label: "CSS Modules" },
		{ value: "tailwind", label: "Tailwind CSS" },
	];
	if (coreResult === "react") {
		stylingOptions.push({
			value: "shadcn",
			label: "shadcn",
			hint: "Radix-based components — requires the React engine",
		});
	}

	const stylingResult = await select({
		message: "Which styling approach would you like to use?",
		options: stylingOptions,
	});

	if (isCancel(stylingResult)) {
		cancel("Operation cancelled.");
		process.exit(1);
	}

	const pluginsResult = await multiselect({
		message: "Which plugins would you like to include? (use space to toggle, enter to confirm)",
		options: [
			{
				value: "seo",
				label: "seo",
				hint: "Auto-injects OG, Twitter cards, JSON-LD, canonical URLs",
			},
			{
				value: "agent-optimization",
				label: "agent-optimization",
				hint: "LLM/AI optimization (llms.txt, markdown, sitemap)",
			},
			{
				value: "syntax-highlighting",
				label: "syntax-highlighting",
				hint: "Code block highlighting for MDX (rehype-highlight)",
			},
		],
		initialValues: ["seo"],
		required: false,
	});

	if (isCancel(pluginsResult)) {
		cancel("Operation cancelled.");
		process.exit(1);
	}

	const middlewareResult = await select({
		message: "Which middleware framework would you like to use?",
		options: [
			{ value: "h3", label: "h3" },
			{ value: "hono", label: "hono" },
			{ value: "elysia", label: "elysia" },
		],
	});

	if (isCancel(middlewareResult)) {
		cancel("Operation cancelled.");
		process.exit(1);
	}

	const deployResult = await select({
		message: "Where will you deploy?",
		options: [
			{
				value: "netlify",
				label: "Netlify",
				hint: "Generates netlify.toml, build.mjs, post-build.mjs",
			},
			{ value: "none", label: "None / Other", hint: "Node server preset, no deploy config" },
		],
	});

	if (isCancel(deployResult)) {
		cancel("Operation cancelled.");
		process.exit(1);
	}

	const core = coreResult as RenderEngine;
	// A React shell requires the React integration; ensure it's present.
	const integrations = integrationsResult as Integration[];
	if (core === "react" && !integrations.includes("react")) {
		integrations.push("react");
	}

	return {
		projectName,
		core,
		integrations,
		styling: stylingResult as StylingOption,
		plugins: pluginsResult as Plugin[],
		middleware: middlewareResult as MiddlewareOption,
		deploy: deployResult as DeployTarget,
	};
}
