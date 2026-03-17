import { describe, it, expect } from 'vitest';
import { generateViteConfig } from './vite-config';
import type { ProjectConfig } from '../types';

describe('generateViteConfig', () => {
  const baseConfig: ProjectConfig = {
    projectName: 'my-app',
    integrations: [],
    styling: 'css-modules',
    plugins: [],
    middleware: 'h3',
  };

  it('imports defineConfig from vite and avalon from @avalon/avalon', () => {
    const result = generateViteConfig(baseConfig);
    expect(result).toContain(`import { defineConfig } from 'vite';`);
    expect(result).toContain(`import { avalon } from '@avalon/avalon';`);
  });

  it('exports a defineConfig call', () => {
    const result = generateViteConfig(baseConfig);
    expect(result).toContain('export default defineConfig({');
  });

  it('configures modules and layoutsDir in avalon plugin', () => {
    const result = generateViteConfig(baseConfig);
    expect(result).toContain(`modules: 'app/modules'`);
    expect(result).toContain(`layoutsDir: 'app/shared/layouts'`);
  });

  it('includes selected integrations as imports and in the integrations array', () => {
    const config: ProjectConfig = {
      ...baseConfig,
      integrations: ['react', 'vue'],
    };
    const result = generateViteConfig(config);
    expect(result).toContain(`import { react } from '@avalon/react';`);
    expect(result).toContain(`import { vue } from '@avalon/vue';`);
    expect(result).toContain('react()');
    expect(result).toContain('vue()');
  });

  it('always includes preact in integrations array when none selected', () => {
    const result = generateViteConfig(baseConfig);
    expect(result).toContain('integrations: [preact()]');
  });

  it('includes tailwindcss plugin when styling is tailwind', () => {
    const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
    const result = generateViteConfig(config);
    expect(result).toContain(`import tailwindcss from '@tailwindcss/vite';`);
    expect(result).toContain('tailwindcss()');
  });

  it('includes tailwindcss plugin when styling is shadcn', () => {
    const config: ProjectConfig = { ...baseConfig, styling: 'shadcn' };
    const result = generateViteConfig(config);
    expect(result).toContain(`import tailwindcss from '@tailwindcss/vite';`);
    expect(result).toContain('tailwindcss()');
  });

  it('does not include tailwindcss plugin when styling is css-modules', () => {
    const result = generateViteConfig(baseConfig);
    expect(result).not.toContain('tailwindcss');
    expect(result).not.toContain('@tailwindcss/vite');
  });

  it('includes agentOptimization plugin when agent-optimization is selected', () => {
    const config: ProjectConfig = {
      ...baseConfig,
      plugins: ['agent-optimization'],
    };
    const result = generateViteConfig(config);
    expect(result).toContain(`import { agentOptimization } from '@avalon/agent-optimization';`);
    expect(result).toContain('agentOptimization()');
  });

  it('does not include agentOptimization when plugin not selected', () => {
    const result = generateViteConfig(baseConfig);
    expect(result).not.toContain('agentOptimization');
    expect(result).not.toContain('@avalon/agent-optimization');
  });

  it('configures nitro middleware with h3', () => {
    const result = generateViteConfig(baseConfig);
    expect(result).toContain(`middleware: 'h3'`);
  });

  it('configures nitro middleware with hono', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'hono' };
    const result = generateViteConfig(config);
    expect(result).toContain(`middleware: 'hono'`);
  });

  it('configures nitro middleware with elysia', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'elysia' };
    const result = generateViteConfig(config);
    expect(result).toContain(`middleware: 'elysia'`);
  });

  it('generates a full config with all options selected', () => {
    const config: ProjectConfig = {
      projectName: 'full-app',
      integrations: ['react', 'svelte', 'qwik'],
      styling: 'shadcn',
      plugins: ['agent-optimization'],
      middleware: 'hono',
    };
    const result = generateViteConfig(config);

    // Imports
    expect(result).toContain(`import { react } from '@avalon/react';`);
    expect(result).toContain(`import { svelte } from '@avalon/svelte';`);
    expect(result).toContain(`import { qwik } from '@avalon/qwik';`);
    expect(result).toContain(`import tailwindcss from '@tailwindcss/vite';`);
    expect(result).toContain(`import { agentOptimization } from '@avalon/agent-optimization';`);

    // Plugins
    expect(result).toContain('react(), svelte(), qwik()');
    expect(result).toContain('tailwindcss()');
    expect(result).toContain('agentOptimization()');

    // Config
    expect(result).toContain(`modules: 'app/modules'`);
    expect(result).toContain(`layoutsDir: 'app/shared/layouts'`);
    expect(result).toContain(`middleware: 'hono'`);
  });
});
