import { createRequire } from "node:module";
import type { Integration } from "./types";

/**
 * Dependency versions written into a scaffolded `package.json`.
 *
 * Every entry is a version (or a patch/minor range) that was built and run
 * with the Avalon release this create-avalon ships with. `latest` would let a
 * fresh scaffold resolve a release Avalon has never been tested against, so a
 * project created today could fail to build even though nothing in Avalon
 * changed.
 */

const require = createRequire(import.meta.url);

/**
 * create-avalon is versioned together with `@useavalon/avalon`, `core`,
 * `preact` and `seo` (changesets `fixed` group), so its own version is the
 * Avalon release it was tested with. `../package.json` resolves from both
 * `src/` and the bundled `dist/cli.js`.
 */
export function avalonReleaseVersion(): string {
	return (require("../package.json") as { version: string }).version;
}

/** Caret range on the Avalon release, for the packages versioned with it. */
export function avalonReleaseRange(): string {
	return `^${avalonReleaseVersion()}`;
}

/**
 * Integration wrappers released on their own version line. Caret ranges stay
 * within the tested 0.x minor.
 */
export const INTEGRATION_PACKAGE_VERSIONS: Record<Exclude<Integration, "preact">, string> = {
	react: "^0.1.14",
	vue: "^0.1.14",
	svelte: "^0.1.14",
	solid: "^0.1.20",
	lit: "^0.1.15",
	qwik: "^0.1.15",
};

export const AGENT_OPTIMIZATION_VERSION = "^0.2.6";

/**
 * Third-party packages. Tilde ranges take patch releases only; Nitro is a
 * prerelease and stays exact. Vite must satisfy Nitro's peer range
 * (`nitro@3.0.260903-beta` needs `vite ^8.2.2`). React is held at 19.2:
 * `react-dom` 19.3 fails to load `react-dom/server` under Bun 1.3.
 */
export const THIRD_PARTY_VERSIONS = {
	react: "~19.2.7",
	"react-dom": "~19.2.7",
	vite: "~8.3.2",
	nitro: "3.0.260903-beta",
	tailwindcss: "~4.3.2",
	"@tailwindcss/vite": "~4.3.2",
	"rehype-highlight": "^7.0.2",
	hono: "^4.13.0",
	elysia: "^1.4.0",
	"@shadcn/ui": "0.0.4",
} as const;
