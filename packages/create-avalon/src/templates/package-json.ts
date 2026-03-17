import type { ProjectConfig } from '../types';
import { INTEGRATION_PACKAGES, DEFAULT_INTEGRATION_PACKAGE } from '../types';

export function generatePackageJson(config: ProjectConfig): string {
  const dependencies: Record<string, string> = {
    '@avalon/avalon': 'latest',
    [DEFAULT_INTEGRATION_PACKAGE]: 'latest',
  };

  for (const integration of config.integrations) {
    dependencies[INTEGRATION_PACKAGES[integration]] = 'latest';
  }

  if (config.plugins.includes('agent-optimization')) {
    dependencies['@avalon/agent-optimization'] = 'latest';
  }

  // Middleware dependencies
  switch (config.middleware) {
    case 'hono':
      dependencies['hono'] = 'latest';
      break;
    case 'elysia':
      dependencies['elysia'] = 'latest';
      break;
    // h3 is included via nitro, no extra dep needed
  }

  // Styling dependencies
  const devDependencies: Record<string, string> = {
    vite: 'latest',
    typescript: 'latest',
    nitro: 'latest',
  };

  switch (config.styling) {
    case 'tailwind':
      devDependencies['tailwindcss'] = 'latest';
      devDependencies['@tailwindcss/vite'] = 'latest';
      break;
    case 'shadcn':
      devDependencies['tailwindcss'] = 'latest';
      devDependencies['@tailwindcss/vite'] = 'latest';
      dependencies['@shadcn/ui'] = 'latest';
      break;
  }

  const pkg = {
    name: config.projectName,
    type: 'module',
    private: true,
    scripts: {
      dev: 'bunx --bun vite dev',
      build: 'bunx --bun vite build',
      preview: 'bunx --bun vite preview',
    },
    dependencies,
    devDependencies,
  };

  return JSON.stringify(pkg, null, 2);
}
