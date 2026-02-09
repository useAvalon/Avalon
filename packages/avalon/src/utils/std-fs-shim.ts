/**
 * Shim for @std/fs functions used in the codebase.
 * Provides Node.js-compatible implementations of Deno standard library
 * filesystem functions so they work in Vite's SSR module runner.
 */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface WalkEntry {
  path: string;
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
}

export interface WalkOptions {
  maxDepth?: number;
  includeFiles?: boolean;
  includeDirs?: boolean;
  includeSymlinks?: boolean;
  match?: RegExp[];
  skip?: RegExp[];
  exts?: string[];
}

/**
 * Walks a directory tree yielding entries, compatible with @std/fs walk().
 */
export async function* walk(
  root: string,
  options: WalkOptions = {},
): AsyncIterableIterator<WalkEntry> {
  const {
    maxDepth = Infinity,
    includeFiles = true,
    includeDirs = true,
    exts,
    match,
    skip,
  } = options;

  yield* walkSync(root, 0, maxDepth, includeFiles, includeDirs, exts, match, skip);
}

function* walkSync(
  dir: string,
  depth: number,
  maxDepth: number,
  includeFiles: boolean,
  includeDirs: boolean,
  exts?: string[],
  match?: RegExp[],
  skip?: RegExp[],
): Generator<WalkEntry> {
  if (depth > maxDepth) return;

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (skip?.some((r) => r.test(fullPath))) continue;

    const walkEntry: WalkEntry = {
      path: fullPath,
      name: entry.name,
      isFile: entry.isFile(),
      isDirectory: entry.isDirectory(),
      isSymlink: entry.isSymbolicLink(),
    };

    if (entry.isDirectory()) {
      if (includeDirs) {
        if (!match || match.some((r) => r.test(fullPath))) {
          yield walkEntry;
        }
      }
      yield* walkSync(fullPath, depth + 1, maxDepth, includeFiles, includeDirs, exts, match, skip);
    } else if (entry.isFile() && includeFiles) {
      if (exts && !exts.some((ext) => entry.name.endsWith(ext))) continue;
      if (match && !match.some((r) => r.test(fullPath))) continue;
      yield walkEntry;
    }
  }
}

/**
 * Ensures a directory exists, creating it recursively if needed.
 */
export async function ensureDir(dir: string): Promise<void> {
  const { mkdirSync } = await import("node:fs");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // Directory already exists
  }
}

/**
 * Check if a file or directory exists.
 */
export function exists(path: string): Promise<boolean> {
  try {
    statSync(path);
    return Promise.resolve(true);
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Synchronous check if a file or directory exists.
 */
export function existsSync(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Empties a directory by removing all contents.
 */
export async function emptyDir(dir: string): Promise<void> {
  const { rmSync, mkdirSync } = await import("node:fs");
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Directory doesn't exist
  }
  mkdirSync(dir, { recursive: true });
}
