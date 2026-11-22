import type { Plugin } from "vite";
import {
	isLayoutFile,
	isPageFile,
	type PageIslandTransformOptions,
} from "../build/page-island-transform.ts";
import { precompileJsx } from "../build/precompile-jsx.ts";
import { jsxImportSourceForFilename } from "./jsx-import-source.ts";

export interface PrecompileJsxPluginOptions {
	/** Whether precompilation is on (`precompileJsx` in the Avalon config). */
	enabled: boolean;
	core: "preact" | "react";
	pagesDir: string;
	layoutsDir: string;
	modules?: PageIslandTransformOptions["modules"];
}

/**
 * Precompiles static JSX in page and layout files to templates (see `build/precompile-jsx.ts`).
 *
 * Runs after the island transform, so `island` usages are already expression children, and before
 * Vite's JSX transform. Only the server build is touched: templates cannot be rendered on the client.
 * Islands live in other files and are never changed.
 */
export function precompileJsxPlugin(options: PrecompileJsxPluginOptions): Plugin {
	const { enabled, core, pagesDir, layoutsDir, modules } = options;
	return {
		name: "avalon:precompile-jsx",
		enforce: "pre",
		transform(code, id) {
			if (!enabled || core !== "preact") return null;
			if (this.environment?.name === "client") return null;
			if (id.includes("?")) return null;
			// Framework-specific files (.react.tsx, .solid.tsx, ...) use other runtimes.
			if (jsxImportSourceForFilename(id, "preact") !== "preact") return null;
			if (!isPageFile(id, pagesDir, modules) && !isLayoutFile(id, layoutsDir, modules)) return null;
			const result = precompileJsx(code, id);
			return result ? { code: result.code, map: null } : null;
		},
	};
}
