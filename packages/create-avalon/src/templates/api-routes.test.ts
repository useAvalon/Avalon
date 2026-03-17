import { describe, it, expect } from 'vitest';
import { generateHelloRoute } from './api-routes';
import type { ProjectConfig } from '../types';

describe('generateHelloRoute', () => {
  const baseConfig: ProjectConfig = {
    projectName: 'my-app',
    integrations: [],
    styling: 'css-modules',
    plugins: [],
    middleware: 'h3',
  };

  // --- h3 ---

  it('generates h3 route using defineHandler from nitro/h3', () => {
    const result = generateHelloRoute(baseConfig);
    expect(result).toContain("import { defineHandler } from 'nitro/h3';");
    expect(result).toContain('defineHandler(');
  });

  it('h3 route returns JSON with hello message', () => {
    const result = generateHelloRoute(baseConfig);
    expect(result).toContain("message: 'Hello from Avalon!'");
  });

  it('h3 route exports default handler', () => {
    const result = generateHelloRoute(baseConfig);
    expect(result).toContain('export default defineHandler');
  });

  // --- hono ---

  it('generates hono route using Hono', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'hono' };
    const result = generateHelloRoute(config);
    expect(result).toContain("import { Hono } from 'hono';");
    expect(result).toContain('new Hono()');
  });

  it('hono route uses app.get with root path', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'hono' };
    const result = generateHelloRoute(config);
    expect(result).toContain("app.get('/'");
  });

  it('hono route returns JSON via c.json', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'hono' };
    const result = generateHelloRoute(config);
    expect(result).toContain("c.json({ message: 'Hello from Avalon!' })");
  });

  it('hono route exports default app', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'hono' };
    const result = generateHelloRoute(config);
    expect(result).toContain('export default app');
  });

  // --- elysia ---

  it('generates elysia route using Elysia', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'elysia' };
    const result = generateHelloRoute(config);
    expect(result).toContain("import { Elysia } from 'elysia';");
    expect(result).toContain('new Elysia()');
  });

  it('elysia route uses .get with root path', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'elysia' };
    const result = generateHelloRoute(config);
    expect(result).toContain(".get('/'");
  });

  it('elysia route returns object with hello message', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'elysia' };
    const result = generateHelloRoute(config);
    expect(result).toContain("message: 'Hello from Avalon!'");
  });

  it('elysia route exports default Elysia instance', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'elysia' };
    const result = generateHelloRoute(config);
    expect(result).toContain('export default new Elysia()');
  });

  // --- common ---

  it('all middleware options return a JSON response with hello message', () => {
    for (const middleware of ['h3', 'hono', 'elysia'] as const) {
      const config: ProjectConfig = { ...baseConfig, middleware };
      const result = generateHelloRoute(config);
      expect(result).toContain('Hello from Avalon!');
    }
  });

  it('all middleware options include an export default', () => {
    for (const middleware of ['h3', 'hono', 'elysia'] as const) {
      const config: ProjectConfig = { ...baseConfig, middleware };
      const result = generateHelloRoute(config);
      expect(result).toContain('export default');
    }
  });
});
