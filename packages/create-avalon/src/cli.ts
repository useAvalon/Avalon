#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { existsSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { collectProjectConfig } from './prompts';
import { scaffoldProject } from './scaffold';
import { printSummary } from './summary';

export interface CLIArgs {
  projectName: string | undefined;
  help: boolean;
  version: boolean;
}

export type DirectoryValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export function validateDirectory(dir: string): DirectoryValidationResult {
  if (!existsSync(dir)) {
    return { valid: true };
  }

  const entries = readdirSync(dir);
  if (entries.length === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Directory "${dir}" already exists and is not empty.`,
  };
}

export function parseCliArgs(argv: string[]): CLIArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', default: false, short: 'h' },
      version: { type: 'boolean', default: false, short: 'v' },
    },
    strict: true,
    allowPositionals: true,
  });

  return {
    projectName: positionals[0] ?? undefined,
    help: values.help ?? false,
    version: values.version ?? false,
  };
}

export async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.version) {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as { version: string };
    console.log(pkg.version);
    process.exit(0);
  }

  if (args.help) {
    console.log(
      'Usage: create-avalon [project-name]\n\nOptions:\n  -v, --version  Show version number\n  -h, --help     Show help',
    );
    process.exit(0);
  }

  // If a project name was provided via CLI, validate the directory early
  // Skip validation for "." — user explicitly wants to scaffold in current dir
  if (args.projectName && args.projectName !== '.') {
    const dirResult = validateDirectory(resolve(args.projectName));
    if (!dirResult.valid) {
      console.error(dirResult.error);
      process.exit(1);
    }
  }

  // Collect all prompts before any filesystem work
  const config = await collectProjectConfig(args.projectName);

  // If the project name came from the prompt (not CLI arg), validate now
  if (!args.projectName && config.projectName !== '.') {
    const dirResult = validateDirectory(resolve(config.projectName));
    if (!dirResult.valid) {
      console.error(dirResult.error);
      process.exit(1);
    }
  }

  // Resolve the target directory and normalize the project name.
  // "." means scaffold into the current directory — use its basename
  // as the package name instead of a literal ".".
  const targetDir = resolve(config.projectName);
  const scaffoldedInPlace = config.projectName === '.';
  if (scaffoldedInPlace) {
    config.projectName = basename(targetDir);
  }

  await scaffoldProject(config, targetDir);
  printSummary(config, scaffoldedInPlace);
  process.exit(0);
}

// Run when executed as CLI entry point.
// The bun bundler inlines this into dist/cli.js where it always runs.
// When imported by tests, import.meta.url won't match process.argv[1].
const entryPath = new URL(import.meta.url).pathname;
if (process.argv[1] && entryPath === process.argv[1]) {
  main();
}
