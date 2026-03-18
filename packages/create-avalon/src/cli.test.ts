import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseCliArgs, validateDirectory } from './cli-utils';

describe('parseCliArgs', () => {
  it('returns defaults when no args provided', () => {
    const result = parseCliArgs([]);
    expect(result).toEqual({
      projectName: undefined,
      help: false,
      version: false,
    });
  });

  it('extracts project name from positional argument', () => {
    const result = parseCliArgs(['my-app']);
    expect(result.projectName).toBe('my-app');
    expect(result.help).toBe(false);
    expect(result.version).toBe(false);
  });

  it('parses --help flag', () => {
    const result = parseCliArgs(['--help']);
    expect(result.help).toBe(true);
    expect(result.version).toBe(false);
    expect(result.projectName).toBeUndefined();
  });

  it('parses -h short flag', () => {
    const result = parseCliArgs(['-h']);
    expect(result.help).toBe(true);
  });

  it('parses --version flag', () => {
    const result = parseCliArgs(['--version']);
    expect(result.version).toBe(true);
    expect(result.help).toBe(false);
    expect(result.projectName).toBeUndefined();
  });

  it('parses -v short flag', () => {
    const result = parseCliArgs(['-v']);
    expect(result.version).toBe(true);
  });

  it('handles project name with --version flag', () => {
    const result = parseCliArgs(['my-app', '--version']);
    expect(result.projectName).toBe('my-app');
    expect(result.version).toBe(true);
  });

  it('handles project name with --help flag', () => {
    const result = parseCliArgs(['--help', 'my-app']);
    expect(result.projectName).toBe('my-app');
    expect(result.help).toBe(true);
  });

  it('uses only the first positional as project name', () => {
    const result = parseCliArgs(['first', 'second']);
    expect(result.projectName).toBe('first');
  });

  it('handles project name with hyphens and numbers', () => {
    const result = parseCliArgs(['my-cool-app-2']);
    expect(result.projectName).toBe('my-cool-app-2');
  });

  it('throws on unknown flags', () => {
    expect(() => parseCliArgs(['--unknown'])).toThrow();
  });
});

describe('validateDirectory', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `create-avalon-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('returns valid for a non-existent directory', () => {
    const result = validateDirectory(testDir);
    expect(result).toEqual({ valid: true });
  });

  it('returns valid for an empty existing directory', () => {
    mkdirSync(testDir, { recursive: true });
    const result = validateDirectory(testDir);
    expect(result).toEqual({ valid: true });
  });

  it('returns invalid for a non-empty directory', () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'file.txt'), 'content');
    const result = validateDirectory(testDir);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain(testDir);
    }
  });

  it('returns invalid when directory has subdirectories', () => {
    mkdirSync(join(testDir, 'subdir'), { recursive: true });
    const result = validateDirectory(testDir);
    expect(result.valid).toBe(false);
  });

  it('returns invalid when directory has multiple files', () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'a.ts'), '');
    writeFileSync(join(testDir, 'b.ts'), '');
    const result = validateDirectory(testDir);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('not empty');
    }
  });
});
