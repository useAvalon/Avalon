import type { ProjectConfig } from './types';

const STYLING_LABELS: Record<string, string> = {
  'css-modules': 'CSS Modules',
  tailwind: 'Tailwind CSS',
  shadcn: 'shadcn',
};

export function formatSummary(config: ProjectConfig): string {
  const allIntegrations = ['preact', ...config.integrations];
  const integrations = allIntegrations.join(', ');
  const styling = STYLING_LABELS[config.styling] ?? config.styling;
  const plugins = config.plugins.length > 0 ? config.plugins.join(', ') : 'none';

  return [
    '',
    `  Project:        ${config.projectName}`,
    `  Integrations:   ${integrations}`,
    `  Styling:        ${styling}`,
    `  Plugins:        ${plugins}`,
    `  Middleware:     ${config.middleware}`,
    '',
    '  Next steps:',
    `    cd ${config.projectName}`,
    '    bun install',
    '    bun run dev',
    '',
  ].join('\n');
}

export function printSummary(config: ProjectConfig): void {
  console.log(formatSummary(config));
}
