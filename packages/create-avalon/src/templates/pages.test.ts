import { describe, it, expect } from 'vitest';
import { generateHomePage } from './pages';
import type { ProjectConfig } from '../types';

describe('generateHomePage', () => {
  const baseConfig: ProjectConfig = {
    projectName: 'my-app',
    integrations: [],
    styling: 'css-modules',
    plugins: [],
    middleware: 'h3',
  };

  // --- Basic structure ---

  it('exports a default async function', () => {
    const result = generateHomePage(baseConfig);
    expect(result).toContain('export default async function HomePage');
  });

  it('includes a welcome heading with the project name', () => {
    const result = generateHomePage(baseConfig);
    expect(result).toContain('Welcome to my-app');
  });

  it('uses the provided project name in the heading', () => {
    const config: ProjectConfig = { ...baseConfig, projectName: 'cool-project' };
    const result = generateHomePage(config);
    expect(result).toContain('Welcome to cool-project');
  });

  it('includes a get-started paragraph', () => {
    const result = generateHomePage(baseConfig);
    expect(result).toContain('Get started by editing this page');
  });

  // --- CSS Modules ---

  it('imports .module.css when styling is css-modules', () => {
    const result = generateHomePage(baseConfig);
    expect(result).toContain("import styles from './index.module.css'");
  });

  it('applies styles.page className when styling is css-modules', () => {
    const result = generateHomePage(baseConfig);
    expect(result).toContain('className={styles.page}');
  });

  it('applies styles.title className when styling is css-modules', () => {
    const result = generateHomePage(baseConfig);
    expect(result).toContain('className={styles.title}');
  });

  // --- Tailwind ---

  it('does not import .module.css when styling is tailwind', () => {
    const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
    const result = generateHomePage(config);
    expect(result).not.toContain('.module.css');
  });

  it('uses Tailwind utility classes when styling is tailwind', () => {
    const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
    const result = generateHomePage(config);
    expect(result).toContain('className="max-w-3xl');
    expect(result).toContain('className="text-4xl');
  });

  // --- shadcn ---

  it('does not import .module.css when styling is shadcn', () => {
    const config: ProjectConfig = { ...baseConfig, styling: 'shadcn' };
    const result = generateHomePage(config);
    expect(result).not.toContain('.module.css');
  });

  it('uses Tailwind utility classes when styling is shadcn', () => {
    const config: ProjectConfig = { ...baseConfig, styling: 'shadcn' };
    const result = generateHomePage(config);
    expect(result).toContain('className="max-w-3xl');
    expect(result).toContain('className="text-4xl');
  });

  // --- common ---

  it('always includes a welcome heading regardless of styling', () => {
    for (const styling of ['css-modules', 'tailwind', 'shadcn'] as const) {
      const config: ProjectConfig = { ...baseConfig, styling };
      const result = generateHomePage(config);
      expect(result).toContain('<h1');
      expect(result).toContain('Welcome to my-app');
    }
  });
});
