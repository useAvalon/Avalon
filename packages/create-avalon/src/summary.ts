import type { ProjectConfig } from "./types";

const STYLING_LABELS: Record<string, string> = {
	"css-modules": "CSS Modules",
	tailwind: "Tailwind CSS",
	shadcn: "shadcn",
};

const DEPLOY_LABELS: Record<string, string> = {
	cloudflare: "Cloudflare Pages",
	netlify: "Netlify",
	none: "None",
};

function deployNextSteps(config: ProjectConfig): string[] {
	if (config.deploy === "cloudflare") {
		return [
			"    bun run build",
			"    bun run preview   # wrangler pages dev",
			"    # See DEPLOY.md for Cloudflare Pages deploy steps",
		];
	}
	if (config.deploy === "netlify") {
		return ["    bun run build", "    # Connect the repo in Netlify, or see DEPLOY.md"];
	}
	return ["    bun run build"];
}

export function formatSummary(config: ProjectConfig, scaffoldedInPlace = false): string {
	const integrations = config.integrations.length > 0 ? config.integrations.join(", ") : "none";
	const styling = STYLING_LABELS[config.styling] ?? config.styling;
	const plugins = config.plugins.length > 0 ? config.plugins.join(", ") : "none";
	const deploy = DEPLOY_LABELS[config.deploy] ?? config.deploy;

	const nextSteps = scaffoldedInPlace
		? ["    bun install", "    bun run dev", ...deployNextSteps(config)]
		: [
				`    cd ${config.projectName}`,
				"    bun install",
				"    bun run dev",
				...deployNextSteps(config),
			];

	return [
		"",
		`  Project:        ${config.projectName}`,
		`  Integrations:   ${integrations}`,
		`  Styling:        ${styling}`,
		`  Plugins:        ${plugins}`,
		`  Middleware:     ${config.middleware}`,
		`  Deploy:         ${deploy}`,
		`  Cron:           ${config.cron ? "yes" : "no"}`,
		"",
		"  Next steps:",
		...nextSteps,
		"",
	].join("\n");
}

export function printSummary(config: ProjectConfig, scaffoldedInPlace = false): void {
	console.log(formatSummary(config, scaffoldedInPlace));
}
