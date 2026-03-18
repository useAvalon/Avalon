#!/usr/bin/env node
import { basename, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { parseCliArgs, validateDirectory } from './cli-utils';
import { collectProjectConfig } from './prompts';
import { scaffoldProject } from './scaffold';
import { printSummary } from './summary';

async function main(): Promise<void> {
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

// Run CLI
main();
