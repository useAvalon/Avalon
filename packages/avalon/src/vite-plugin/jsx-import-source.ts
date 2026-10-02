/**
 * Filename → JSX runtime.
 *
 * Pages and islands share one OXC transform. The extension already selects the
 * framework, so Avalon injects `@jsxImportSource` before that transform runs.
 * An in-file pragma still wins.
 */

export type JsxCore = "preact" | "react";

const EXTENSION_SOURCES: ReadonlyArray<{ test: RegExp; source: string }> = [
	{ test: /\.react\.[jt]sx$/, source: "react" },
	{ test: /\.solid\.[jt]sx$/, source: "solid-js" },
	{ test: /\.qwik\.[jt]sx$/, source: "@builder.io/qwik" },
	{ test: /\.preact\.[jt]sx$/, source: "preact" },
];

/**
 * JSX import source for `id`, or null when the file should be left alone.
 * `core` is the page-shell runtime (plain `.tsx` / `.jsx`).
 */
export function jsxImportSourceForFilename(id: string, core: JsxCore = "preact"): string | null {
	if (id.startsWith("\0")) return null;
	const path = id.split("?", 1)[0] ?? id;
	if (path.includes("node_modules")) return null;
	if (path.endsWith(".d.ts")) return null;
	if (!/\.[jt]sx$/.test(path)) return null;
	for (const entry of EXTENSION_SOURCES) {
		if (entry.test.test(path)) return entry.source;
	}
	return core;
}

/** Prepends the pragma when the file does not already set `@jsxImportSource`. */
export function withJsxImportSource(code: string, source: string): string | null {
	if (code.includes("@jsxImportSource")) return null;
	return `/** @jsxImportSource ${source} */\n${code}`;
}
