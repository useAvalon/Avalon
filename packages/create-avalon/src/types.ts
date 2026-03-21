export type Integration = 'preact' | 'react' | 'vue' | 'svelte' | 'solid' | 'lit' | 'qwik';

export type StylingOption = 'css-modules' | 'tailwind' | 'shadcn';

export type Plugin = 'agent-optimization' | 'syntax-highlighting';

export type MiddlewareOption = 'h3' | 'hono' | 'elysia';

export type DeployTarget = 'netlify' | 'none';

export interface ProjectConfig {
	projectName: string;
	integrations: Integration[];
	styling: StylingOption;
	plugins: Plugin[];
	middleware: MiddlewareOption;
	deploy: DeployTarget;
}

export const INTEGRATION_PACKAGES: Record<Integration, string> = {
	preact: '@useavalon/preact',
	react: '@useavalon/react',
	vue: '@useavalon/vue',
	svelte: '@useavalon/svelte',
	solid: '@useavalon/solid',
	lit: '@useavalon/lit',
	qwik: '@useavalon/qwik',
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
