import type { ProjectConfig } from '../types';

export function generateViteConfig(config: ProjectConfig): string {
  const imports: string[] = [
    `import { defineConfig } from 'vite';`,
    `import { avalon } from '@avalon/avalon';`,
    `import { preact } from '@avalon/preact';`,
  ];

  // Additional integration imports
  for (const integration of config.integrations) {
    imports.push(`import { ${integration} } from '@avalon/${integration}';`);
  }

  // Tailwind import
  const needsTailwind = config.styling === 'tailwind' || config.styling === 'shadcn';
  if (needsTailwind) {
    imports.push(`import tailwindcss from '@tailwindcss/vite';`);
  }

  // Agent optimization import
  const hasAgentOptimization = config.plugins.includes('agent-optimization');
  if (hasAgentOptimization) {
    imports.push(`import { agentOptimization } from '@avalon/agent-optimization';`);
  }

  // Build integrations array — preact is always first
  const allIntegrations = ['preact', ...config.integrations];
  const integrationsList = allIntegrations.map((i) => `${i}()`).join(', ');

  // Build plugins array
  const pluginEntries: string[] = [];

  // Avalon plugin
  const avalonLines = [
    `    avalon({`,
    `      integrations: [${integrationsList}],`,
    `      modules: 'app/modules',`,
    `      layoutsDir: 'app/shared/layouts',`,
    `    }),`,
  ];
  pluginEntries.push(avalonLines.join('\n'));

  if (needsTailwind) {
    pluginEntries.push(`    tailwindcss(),`);
  }

  if (hasAgentOptimization) {
    pluginEntries.push(`    agentOptimization(),`);
  }

  const lines = [
    imports.join('\n'),
    '',
    `export default defineConfig({`,
    `  plugins: [`,
    pluginEntries.join('\n'),
    `  ],`,
    `  server: {`,
    `    nitro: {`,
    `      middleware: '${config.middleware}',`,
    `    },`,
    `  },`,
    `});`,
    '',
  ];

  return lines.join('\n');
}
