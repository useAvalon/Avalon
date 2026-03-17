export type Integration = 'react' | 'vue' | 'svelte' | 'solid' | 'lit' | 'qwik';

/** Preact is always included as the core rendering framework */
export const DEFAULT_INTEGRATION = 'preact' as const;
export const DEFAULT_INTEGRATION_PACKAGE = '@avalon/preact';

export type StylingOption = 'css-modules' | 'tailwind' | 'shadcn';

export type Plugin = 'agent-optimization';

export type MiddlewareOption = 'h3' | 'hono' | 'elysia';

export interface ProjectConfig {
  projectName: string;
  integrations: Integration[];
  styling: StylingOption;
  plugins: Plugin[];
  middleware: MiddlewareOption;
}

export const INTEGRATION_PACKAGES: Record<Integration, string> = {
  react:   '@avalon/react',
  vue:     '@avalon/vue',
  svelte:  '@avalon/svelte',
  solid:   '@avalon/solid',
  lit:     '@avalon/lit',
  qwik:    '@avalon/qwik',
};

export const BASE_DIRS = [
  'app/modules/home/pages',
  'app/modules/home/components',
  'app/modules/home/layouts',
  'app/shared/layouts',
  'app/shared/components',
  'app/shared/styles',
  'middleware',
  'routes/api',
  'public',
  'server',
] as const;
