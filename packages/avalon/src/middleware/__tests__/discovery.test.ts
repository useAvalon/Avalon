import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { discoverScopedMiddleware, getMatchingMiddleware } from '../discovery.ts';

describe('discoverScopedMiddleware', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'middleware-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('discovers _middleware.ts files in pages subdirectories', async () => {
    // Create pages directory structure with middleware files
    await mkdir(join(tempDir, 'pages', 'admin'), { recursive: true });
    await mkdir(join(tempDir, 'pages', 'blog'), { recursive: true });
    await writeFile(join(tempDir, 'pages', 'admin', '_middleware.ts'), 'export default () => {};');
    await writeFile(join(tempDir, 'pages', 'blog', '_middleware.ts'), 'export default () => {};');

    const routes = await discoverScopedMiddleware({ baseDir: tempDir });

    expect(routes).toHaveLength(2);
    expect(routes.every(r => r.type === 'pages')).toBe(true);
    expect(routes.map(r => r.filePath)).toEqual(
      expect.arrayContaining([
        join(tempDir, 'pages', 'admin', '_middleware.ts'),
        join(tempDir, 'pages', 'blog', '_middleware.ts'),
      ])
    );
  });

  it('discovers nested _middleware.ts files with correct priority ordering', async () => {
    await mkdir(join(tempDir, 'pages', 'admin', 'users'), { recursive: true });
    await writeFile(join(tempDir, 'pages', 'admin', '_middleware.ts'), 'export default () => {};');
    await writeFile(join(tempDir, 'pages', 'admin', 'users', '_middleware.ts'), 'export default () => {};');

    const routes = await discoverScopedMiddleware({ baseDir: tempDir });

    expect(routes).toHaveLength(2);
    // Parent middleware (depth 1) should come before child (depth 2)
    expect(routes[0].priority).toBeLessThan(routes[1].priority);
    expect(routes[0].filePath).toContain(join('admin', '_middleware.ts'));
    expect(routes[1].filePath).toContain(join('admin', 'users', '_middleware.ts'));
  });

  it('does NOT scan api directory for middleware', async () => {
    await mkdir(join(tempDir, 'pages', 'admin'), { recursive: true });
    await mkdir(join(tempDir, 'api', 'admin'), { recursive: true });
    await writeFile(join(tempDir, 'pages', 'admin', '_middleware.ts'), 'export default () => {};');
    await writeFile(join(tempDir, 'api', 'admin', '_middleware.ts'), 'export default () => {};');

    const routes = await discoverScopedMiddleware({ baseDir: tempDir });

    expect(routes).toHaveLength(1);
    expect(routes[0].type).toBe('pages');
    expect(routes[0].filePath).toContain(join('pages', 'admin', '_middleware.ts'));
  });

  it('returns empty array when no middleware files exist', async () => {
    await mkdir(join(tempDir, 'pages'), { recursive: true });

    const routes = await discoverScopedMiddleware({ baseDir: tempDir });

    expect(routes).toHaveLength(0);
  });

  it('returns empty array when pages directory does not exist', async () => {
    const routes = await discoverScopedMiddleware({ baseDir: tempDir });

    expect(routes).toHaveLength(0);
  });
});

describe('getMatchingMiddleware', () => {
  it('matches page middleware for page routes', () => {
    const routes = [
      {
        pattern: new URLPattern({ pathname: '/admin{/*}?' }),
        filePath: '/src/pages/admin/_middleware.ts',
        priority: 51,
        type: 'pages' as const,
      },
    ];

    const matches = getMatchingMiddleware(routes, new URL('http://localhost/admin/dashboard'));
    expect(matches).toHaveLength(1);
  });

  it('does not match page middleware for API routes', () => {
    const routes = [
      {
        pattern: new URLPattern({ pathname: '/*' }),
        filePath: '/src/pages/_middleware.ts',
        priority: 50,
        type: 'pages' as const,
      },
    ];

    const matches = getMatchingMiddleware(routes, new URL('http://localhost/api/users'));
    expect(matches).toHaveLength(0);
  });
});
