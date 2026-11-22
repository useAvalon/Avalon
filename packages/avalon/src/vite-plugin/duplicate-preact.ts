import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/** Directory of the `preact` package that `fromFile` resolves, or null when it cannot be found. */
function preactRootFrom(fromFile: string): string | null {
	try {
		return realpathSync(dirname(createRequire(fromFile).resolve("preact/package.json")));
	} catch {
		return null;
	}
}

/**
 * Whether the string renderer and the JSX runtime would load two different copies of Preact.
 * Precompiled templates are recognised by `Fragment` identity, so with two copies every template
 * renders empty; the plugin turns precompilation off instead of letting pages break.
 */
export function hasDuplicatePreact(): boolean {
	try {
		const own = createRequire(import.meta.url);
		const runtime = preactRootFrom(import.meta.url);
		const rendererDir = dirname(realpathSync(own.resolve("preact-render-to-string")));
		const renderer = preactRootFrom(join(rendererDir, "noop.js"));
		return runtime !== null && renderer !== null && runtime !== renderer;
	} catch {
		return false;
	}
}
