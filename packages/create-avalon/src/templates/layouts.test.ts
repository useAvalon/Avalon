import { describe, it, expect } from 'vitest';
import { generateRootLayout, generateHomeLayout } from './layouts';
import type { ProjectConfig } from '../types';

describe('generateRootLayout', () => {
  const baseConfig: ProjectConfig = {
    projectName: 'my-app',
    integrations: [],
    styling: 'css-modules',
    plugins: [],
    middleware: 'h3',
  };

  // --- HTML shell ---

  it('generates an HTML shell with <html>, <head>, and <body>', () => {
    const result = generateRootLayout(baseConfig);
    expect(result).toContain('<html lang="en">');
    expect(result).toContain('<head>');
    expect(result).toContain('<body');
    expect(result).toContain('</html>');
  });

  it('includes charset and viewport meta tags', () => {
    const result = generateRootLayout(baseConfig);
    expect(result).toContain('<meta charset="UTF-8"');
    expect(result).toContain('<meta name="viewport"');
  });

  it('includes a {children} slot', () => {
    const result = generateRootLayout(baseConfig);
    expect(result).toContain('{children}');
  });

  it('sets the title to the project name', () => {
    const result = generateRootLayout(baseConfig);
    expect(result).toContain('<title>my-app</title>');
  });

  it('uses the provided project name in the title', () => {
    const config: ProjectConfig = { ...baseConfig, projectName: 'cool-project' };
    const result = generateRootLayout(config);
    expect(result).toContain('<title>cool-project</title>');
  });

  it('imports main.css stylesheet', () => {
    const result = generateRootLayout(baseConfig);
    expect(result).toContain("import '../styles/main.css'");
  });

  it('exports a default async function', () => {
    const result = generateRootLayout(baseConfig);
    expect(result).toContain('export default async function RootLayout');
  });

  it('imports LayoutProps from @avalon/avalon and uses Readonly<LayoutProps>', () => {
    const result = generateRootLayout(baseConfig);
    expect(result).toContain("import type { LayoutProps } from '@avalon/avalon'");
    expect(result).toContain('Readonly<LayoutProps>');
  });

  // --- CSS Modules ---

  it('imports .module.css when styling is css-modules', () => {
    const result = generateRootLayout(baseConfig);
    expect(result).toContain("import styles from './_layout.module.css'");
  });

  it('applies styles.layout className on body when styling is css-modules', () => {
    const result = generateRootLayout(baseConfig);
    expect(result).toContain('className={styles.layout}');
  });

  // --- Tailwind ---

  it('does not import .module.css when styling is tailwind', () => {
    const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
    const result = generateRootLayout(config);
    expect(result).not.toContain('.module.css');
  });

  it('does not apply styles.layout className when styling is tailwind', () => {
    const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
    const result = generateRootLayout(config);
    expect(result).not.toContain('className={styles.layout}');
  });

  // --- shadcn ---

  it('does not import .module.css when styling is shadcn', () => {
    const config: ProjectConfig = { ...baseConfig, styling: 'shadcn' };
    const result = generateRootLayout(config);
    expect(result).not.toContain('.module.css');
  });

  // --- common across all styling options ---

  it('always imports main.css regardless of styling option', () => {
    for (const styling of ['css-modules', 'tailwind', 'shadcn'] as const) {
      const config: ProjectConfig = { ...baseConfig, styling };
      const result = generateRootLayout(config);
      expect(result).toContain("import '../styles/main.css'");
    }
  });

  it('always includes favicon link', () => {
    const result = generateRootLayout(baseConfig);
    expect(result).toContain('href="/favicon.ico"');
  });
});

describe('generateHomeLayout', () => {
  const baseConfig: ProjectConfig = {
    projectName: 'my-app',
    integrations: [],
    styling: 'css-modules',
    plugins: [],
    middleware: 'h3',
  };

  // --- Basic structure ---

  it('generates a wrapper with a {children} slot', () => {
    const result = generateHomeLayout(baseConfig);
    expect(result).toContain('{children}');
  });

  it('exports a default async function', () => {
    const result = generateHomeLayout(baseConfig);
    expect(result).toContain('export default async function HomeLayout');
  });

  it('imports LayoutProps from @avalon/avalon and uses Readonly<LayoutProps>', () => {
    const result = generateHomeLayout(baseConfig);
    expect(result).toContain("import type { LayoutProps } from '@avalon/avalon'");
    expect(result).toContain('Readonly<LayoutProps>');
  });

  it('wraps children in a div', () => {
    const result = generateHomeLayout(baseConfig);
    expect(result).toContain('<div');
    expect(result).toContain('</div>');
  });

  // --- CSS Modules ---

  it('imports .module.css when styling is css-modules', () => {
    const result = generateHomeLayout(baseConfig);
    expect(result).toContain("import styles from './_layout.module.css'");
  });

  it('applies styles.layout className when styling is css-modules', () => {
    const result = generateHomeLayout(baseConfig);
    expect(result).toContain('className={styles.layout}');
  });

  // --- Tailwind ---

  it('does not import .module.css when styling is tailwind', () => {
    const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
    const result = generateHomeLayout(config);
    expect(result).not.toContain('.module.css');
  });

  it('does not apply styles.layout className when styling is tailwind', () => {
    const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
    const result = generateHomeLayout(config);
    expect(result).not.toContain('className={styles.layout}');
  });

  // --- shadcn ---

  it('does not import .module.css when styling is shadcn', () => {
    const config: ProjectConfig = { ...baseConfig, styling: 'shadcn' };
    const result = generateHomeLayout(config);
    expect(result).not.toContain('.module.css');
  });

  // --- Does NOT include full HTML shell ---

  it('does not include <html> or <head> tags', () => {
    const result = generateHomeLayout(baseConfig);
    expect(result).not.toContain('<html');
    expect(result).not.toContain('<head');
  });
});
