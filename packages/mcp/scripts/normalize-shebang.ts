/**
 * Shebang normalisation for the build's binary output.
 *
 * A shebang (`#!...`) is only valid on the very first line of a file; a second
 * one is a runtime `SyntaxError`. The minifier can preserve the shebang from
 * the TypeScript source, so before we prepend our own we must strip any that
 * survived — otherwise the published binary crashes on launch.
 *
 * @module scripts/normalize-shebang
 */

const SHEBANG = "#!/usr/bin/env node";
const LEADING_SHEBANG = /^#![^\n]*\n?/;

/** Remove a leading shebang line, if present. */
export function stripShebang(code: string): string {
	return code.replace(LEADING_SHEBANG, "");
}

/**
 * Produce the final contents for a compiled file.
 *
 * For the binary entry, guarantees exactly one leading shebang. For any other
 * file, strips a stray shebang (there should never be one).
 */
export function applyShebang(code: string, isBin: boolean): string {
	const body = stripShebang(code);
	return isBin ? `${SHEBANG}\n${body}` : body;
}
