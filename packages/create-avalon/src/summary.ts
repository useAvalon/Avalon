import type { ProjectConfig } from './types';

const STYLING_LABELS: Record<string, string> = {
	'css-modules': 'CSS Modules',
	tailwind: 'Tailwind CSS',
	shadcn: 'shadcn',
};

const DEPLOY_LABELS: Record<string, string> = {
	netlify: 'Netlify',
	none: 'None',
};

export function formatSummary(config: ProjectConfig, scaffoldedInPlace = false): string {
	const integrations = config.integrations.length > 0 ? config.integrations.join(', ') : 'none';
	const styling = STYLING_LABELS[config.styling] ?? config.styling;
	const plugins = config.plugins.length > 0 ? config.plugins.join(', ') : 'none';
	const deploy = DEPLOY_LABELS[config.deploy] ?? config.deploy;

	const nextSteps = scaffoldedInPlace
		? ['    bun install', '    bun run dev']
		: [`    cd ${config.projectName}`, '    bun install', '    bun run dev'];

	return [
		'',
		`  Project:        ${config.projectName}`,
		`  Integrations:   ${integrations}`,
		`  Styling:        ${styling}`,
		`  Plugins:        ${plugins}`,
		`  Middleware:     ${config.middleware}`,
		`  Deploy:        ${deploy}`,
		'',
		'  Next steps:',
		...nextSteps,
		'',
	].join('\n');
}

export function printSummary(config: ProjectConfig, scaffoldedInPlace = false): void {
	console.log(formatSummary(config, scaffoldedInPlace));
}
