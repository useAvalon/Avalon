import { describe, it, expect } from 'vitest';
import { formatSummary } from './summary';
import type { ProjectConfig } from './types';

describe('formatSummary', () => {
	const baseConfig: ProjectConfig = {
		projectName: 'my-app',
		integrations: [],
		styling: 'css-modules',
		plugins: [],
		middleware: 'h3',
		deploy: 'none',
	};

	// --- Project name ---

	it('includes the project name', () => {
		const result = formatSummary(baseConfig);
		expect(result).toContain('my-app');
	});

	it('includes a different project name', () => {
		const result = formatSummary({ ...baseConfig, projectName: 'cool-project' });
		expect(result).toContain('cool-project');
	});

	// --- Integrations ---

	it('shows "none" when no integrations are selected', () => {
		const result = formatSummary(baseConfig);
		expect(result).toContain('Integrations:   none');
	});

	it('lists selected integrations', () => {
		const config: ProjectConfig = { ...baseConfig, integrations: ['react', 'vue'] };
		const result = formatSummary(config);
		expect(result).toContain('react, vue');
	});

	it('lists a single integration', () => {
		const config: ProjectConfig = { ...baseConfig, integrations: ['svelte'] };
		const result = formatSummary(config);
		expect(result).toContain('Integrations:   svelte');
	});

	// --- Styling ---

	it('shows "CSS Modules" label for css-modules', () => {
		const result = formatSummary(baseConfig);
		expect(result).toContain('Styling:        CSS Modules');
	});

	it('shows "Tailwind CSS" label for tailwind', () => {
		const result = formatSummary({ ...baseConfig, styling: 'tailwind' });
		expect(result).toContain('Styling:        Tailwind CSS');
	});

	it('shows "shadcn" label for shadcn', () => {
		const result = formatSummary({ ...baseConfig, styling: 'shadcn' });
		expect(result).toContain('Styling:        shadcn');
	});

	// --- Plugins ---

	it('shows "none" when no plugins are selected', () => {
		const result = formatSummary(baseConfig);
		expect(result).toContain('Plugins:        none');
	});

	it('lists selected plugins', () => {
		const config: ProjectConfig = { ...baseConfig, plugins: ['agent-optimization'] };
		const result = formatSummary(config);
		expect(result).toContain('agent-optimization');
	});

	// --- Middleware ---

	it('shows the selected middleware', () => {
		const result = formatSummary(baseConfig);
		expect(result).toContain('Middleware:     h3');
	});

	it('shows hono middleware', () => {
		const result = formatSummary({ ...baseConfig, middleware: 'hono' });
		expect(result).toContain('Middleware:     hono');
	});

	it('shows elysia middleware', () => {
		const result = formatSummary({ ...baseConfig, middleware: 'elysia' });
		expect(result).toContain('Middleware:     elysia');
	});

	// --- Next steps ---

	it('includes cd command with project name', () => {
		const result = formatSummary(baseConfig);
		expect(result).toContain('cd my-app');
	});

	it('includes bun install command', () => {
		const result = formatSummary(baseConfig);
		expect(result).toContain('bun install');
	});

	it('includes bun run dev command', () => {
		const result = formatSummary(baseConfig);
		expect(result).toContain('bun run dev');
	});

	it('cd command uses the actual project name', () => {
		const result = formatSummary({ ...baseConfig, projectName: 'another-project' });
		expect(result).toContain('cd another-project');
	});

	it('omits cd command when scaffolded in place', () => {
		const result = formatSummary(baseConfig, true);
		expect(result).not.toContain('cd ');
		expect(result).toContain('bun install');
		expect(result).toContain('bun run dev');
	});

	// --- Full config ---

	it('includes all selections for a fully configured project', () => {
		const config: ProjectConfig = {
			projectName: 'full-app',
			integrations: ['react', 'solid', 'lit'],
			styling: 'tailwind',
			plugins: ['agent-optimization'],
			middleware: 'hono',
			deploy: 'netlify',
		};
		const result = formatSummary(config);
		expect(result).toContain('full-app');
		expect(result).toContain('react, solid, lit');
		expect(result).toContain('Tailwind CSS');
		expect(result).toContain('agent-optimization');
		expect(result).toContain('hono');
		expect(result).toContain('cd full-app');
		expect(result).toContain('bun install');
		expect(result).toContain('bun run dev');
	});
});
