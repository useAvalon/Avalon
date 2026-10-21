import { commandsFor, packageManagerOf } from "./package-manager";
import type { ProjectConfig } from "./types";
import { projectTemplate } from "./types";

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
	const run = commandsFor(packageManagerOf(config)).run;
	if (config.deploy === "cloudflare") {
		return [
			`    ${run("build")}`,
			`    ${run("preview")}   # wrangler pages dev`,
			"    # See DEPLOY.md for Cloudflare Pages deploy steps",
		];
	}
	if (config.deploy === "netlify") {
		return [
			`    ${run("build")}`,
			`    ${run("preview")}   # netlify dev (dist + SSR functions)`,
			"    # Connect the repo in Netlify, or see DEPLOY.md",
		];
	}
	return [`    ${run("build")}`, `    ${run("preview")}`];
}

export function formatSummary(config: ProjectConfig, scaffoldedInPlace = false): string {
	const integrations = config.integrations.length > 0 ? config.integrations.join(", ") : "none";
	const styling = STYLING_LABELS[config.styling] ?? config.styling;
	const plugins = config.plugins.length > 0 ? config.plugins.join(", ") : "none";
	const deploy = DEPLOY_LABELS[config.deploy] ?? config.deploy;
	const template = projectTemplate(config);
	const templateLabel =
		template === "blog"
			? "blog (MDX + Pages CMS)"
			: template === "storefront"
				? "storefront (Atelier Kō catalogue)"
				: "default";
	const { install, run } = commandsFor(packageManagerOf(config));

	const cmsSteps =
		template === "blog"
			? [
					"    # Pages CMS: push to GitHub, then connect at https://app.pagescms.org",
					"    # See PAGES-CMS.md and .pages.yml in the project root",
				]
			: template === "storefront"
				? ["    # See STOREFRONT.md and ATTRIBUTION.md (theme: xocothemes/atelier-ko, MIT)"]
				: [];

	const nextSteps = scaffoldedInPlace
		? [`    ${install}`, `    ${run("dev")}`, ...cmsSteps, ...deployNextSteps(config)]
		: [
				`    cd ${config.projectName}`,
				`    ${install}`,
				`    ${run("dev")}`,
				...cmsSteps,
				...deployNextSteps(config),
			];

	return [
		"",
		`  Project:        ${config.projectName}`,
		`  Template:       ${templateLabel}`,
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
