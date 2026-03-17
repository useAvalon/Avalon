import { describe, it, expect } from 'vitest';
import { generateSampleMiddleware } from './middleware';
import type { ProjectConfig } from '../types';

describe('generateSampleMiddleware', () => {
  const baseConfig: ProjectConfig = {
    projectName: 'my-app',
    integrations: [],
    styling: 'css-modules',
    plugins: [],
    middleware: 'h3',
  };

  // --- h3 ---

  it('generates h3 middleware using defineHandler from nitro/h3', () => {
    const result = generateSampleMiddleware(baseConfig);
    expect(result).toContain("import { defineHandler } from 'nitro/h3';");
    expect(result).toContain('defineHandler((event)');
  });

  it('h3 middleware logs method and path from event', () => {
    const result = generateSampleMiddleware(baseConfig);
    expect(result).toContain('event.method');
    expect(result).toContain('event.path');
  });

  it('h3 middleware exports default handler', () => {
    const result = generateSampleMiddleware(baseConfig);
    expect(result).toContain('export default defineHandler');
  });

  // --- hono ---

  it('generates hono middleware using Hono pattern', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'hono' };
    const result = generateSampleMiddleware(config);
    expect(result).toContain("import { Hono } from 'hono';");
    expect(result).toContain('new Hono()');
  });

  it('hono middleware uses app.use with wildcard route', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'hono' };
    const result = generateSampleMiddleware(config);
    expect(result).toContain("app.use('*'");
    expect(result).toContain('await next()');
  });

  it('hono middleware logs method and path from context', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'hono' };
    const result = generateSampleMiddleware(config);
    expect(result).toContain('c.req.method');
    expect(result).toContain('c.req.path');
  });

  it('hono middleware exports default app', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'hono' };
    const result = generateSampleMiddleware(config);
    expect(result).toContain('export default app');
  });

  // --- elysia ---

  it('generates elysia middleware using Elysia plugin pattern', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'elysia' };
    const result = generateSampleMiddleware(config);
    expect(result).toContain("import { Elysia } from 'elysia';");
    expect(result).toContain('new Elysia()');
  });

  it('elysia middleware uses onBeforeHandle hook', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'elysia' };
    const result = generateSampleMiddleware(config);
    expect(result).toContain('.onBeforeHandle(');
  });

  it('elysia middleware logs method and pathname from request', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'elysia' };
    const result = generateSampleMiddleware(config);
    expect(result).toContain('request.method');
    expect(result).toContain('new URL(request.url).pathname');
  });

  it('elysia middleware exports default Elysia instance', () => {
    const config: ProjectConfig = { ...baseConfig, middleware: 'elysia' };
    const result = generateSampleMiddleware(config);
    expect(result).toContain('export default new Elysia()');
  });

  // --- common ---

  it('all middleware options include a timestamp in the log', () => {
    for (const middleware of ['h3', 'hono', 'elysia'] as const) {
      const config: ProjectConfig = { ...baseConfig, middleware };
      const result = generateSampleMiddleware(config);
      expect(result).toContain('new Date().toISOString()');
    }
  });

  it('all middleware options include console.log', () => {
    for (const middleware of ['h3', 'hono', 'elysia'] as const) {
      const config: ProjectConfig = { ...baseConfig, middleware };
      const result = generateSampleMiddleware(config);
      expect(result).toContain('console.log');
    }
  });
});
