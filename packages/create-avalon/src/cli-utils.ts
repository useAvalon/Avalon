import { parseArgs } from 'node:util';
import { existsSync, readdirSync } from 'node:fs';

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
