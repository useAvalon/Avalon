import type { ProjectConfig } from './types';

const STYLING_LABELS: Record<string, string> = {
  'css-modules': 'CSS Modules',
  tailwind: 'Tailwind CSS',
  shadcn: 'shadcn',
};

export function formatSummary(config: ProjectConfig, scaffoldedInPlace = false): string {
  const integrations = config.integrations.length > 0 ? config.integrations.join(', ') : 'none';
  const styling = STYLING_LABELS[config.styling] ?? config.styling;
  const plugins = config.plugins.length > 0 ? config.plugins.join(', ') : 'none';

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
    '',
    '  Next steps:',
    ...nextSteps,
    '',
  ].join('\n');
}

export function printSummary(config: ProjectConfig, scaffoldedInPlace = false): void {
  console.log(formatSummary(config, scaffoldedInPlace));
}
