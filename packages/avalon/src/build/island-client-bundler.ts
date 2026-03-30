/**
 * Island Client Bundler Plugin
 *
 * Discovers components used with the `island` prop in page/layout files and
 * emits them as separate client-side chunks so the hydration runtime can
 * dynamically import them in production.
 *
 * Note: Component CSS from these chunks is injected into the HTML by the
 * post-build script (post-build.mjs), which patches the SSR bundle to
 * include all CSS files from the client build output.
 */

import type { Plugin } from "vite";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import type { ResolvedAvalonConfig } from "../vite-plugin/types.ts";
import type { AvalonNitroConfig } from "../nitro/config.ts";

interface IslandSource {
	filePath: string;
	bundleKey: string;
}

/**
 * Creates a Vite plugin that emits island components as separate client chunks.
 */
export function islandClientBundlerPlugin(
	config: ResolvedAvalonConfig,
	nitroConfig?: AvalonNitroConfig,
): Plugin {
	const cwd = process.cwd();
	const discoveredIslands = new Map<string, IslandSource>();
	// Hydration mode is automatic: dev uses entry-client (HMR), prod uses per-island.
	// Determined in configResolved from the Vite command.
	let isPerIsland = false;

	// Discover islands synchronously at plugin creation time
	const pageDirs = getPageAndLayoutDirsSync(config, cwd);
	for (const dir of pageDirs) {
		scanDirectorySync(dir, cwd, discoveredIslands);
	}

	// Virtual module prefix for island wrappers that preserve exports
	const ISLAND_WRAPPER_PREFIX = "\0avalon-island-entry:";

	let isServeMode = false;

	return {
		name: "avalon:island-client-bundler",
		enforce: "pre",

		configResolved(resolvedConfig) {
			isServeMode = resolvedConfig.command === "serve";
			isPerIsland = resolvedConfig.command === "build";
		},

		resolveId(id) {
			if (id.startsWith(ISLAND_WRAPPER_PREFIX)) return id;
			return null;
		},

		load(id) {
			if (!id.startsWith(ISLAND_WRAPPER_PREFIX)) return null;
			const filePath = id.slice(ISLAND_WRAPPER_PREFIX.length);
			const escaped = JSON.stringify(filePath);

			// Qwik components need ALL named exports preserved — the qwikloader
			// fetches the bundle and looks up QRL symbols (s_xxx) as named exports.
			// Also re-export _hW from @builder.io/qwik for useVisibleTask$/useTask$.
			if (filePath.includes(".qwik.")) {
				if (isPerIsland) {
					// Qwik uses resumability — the Qwikloader (inline script in SSR HTML)
					// handles event interception and lazily loads QRL handler symbols.
					// We only re-export the named symbols (s_xxx) that the Qwikloader
					// fetches on demand. No default import, no eager Qwik runtime load.
					// The _hW export is needed for useVisibleTask$/useTask$.
					return [`export * from ${escaped};`, `export { _hW } from "@builder.io/qwik";`].join(
						"\n",
					);
				}
				// Dev mode: full wrapper for HMR support
				const lines = [
					`export * from ${escaped};`,
					`export { _hW } from "@builder.io/qwik";`,
					`import __C from ${escaped};`,
					`export default __C;`,
					`if(typeof globalThis<"u")globalThis.__avalonIsland=__C;`,
				];
				return lines.join("\n");
			}

			// Create a wrapper that imports the component and explicitly exports it.
			// We use both a default export AND a named 'Component' export, plus a
			// globalThis side-effect to prevent aggressive tree-shaking by Rolldown.
			const isLit = filePath.includes(".lit.");
			const lines: string[] = [];

			// For Lit islands, hydration support MUST be loaded before the component.
			if (isLit && isPerIsland) {
				lines.push(`import "@useavalon/lit/client";`);
			}

			lines.push(
				`import __C from ${escaped};`,
				`var Component = __C;`,
				`export { Component as default, Component };`,
				`if(typeof globalThis<"u")globalThis.__avalonIsland=Component;`,
			);
			// In per-island mode, re-export the integration loader so it gets
			// bundled into this island chunk (eliminates separate runtime chunk)
			if (isPerIsland) {
				lines.push(`export { loadIntegrationModule } from "virtual:avalon/integration-loader";`);
			}
			return lines.join("\n");
		},

		async buildStart() {
			// emitFile() is only available during build, not serve mode
			if (isServeMode) return;

			// Only emit island chunks for the client build environment
			const env = (this as any).environment;
			if (env && env.name !== "client") return;

			// Emit island component chunks via virtual wrapper modules
			// that explicitly re-export the default export, preventing
			// Rolldown from tree-shaking the component away.
			if (discoveredIslands.size > 0) {
				for (const [, island] of discoveredIslands) {
					this.emitFile({
						type: "chunk",
						id: ISLAND_WRAPPER_PREFIX + island.filePath,
						fileName: `islands/${island.bundleKey}.js`,
						preserveSignature: "exports-only",
					} as any);
				}

				if (config.verbose) {
					console.log(`🏝️  Emitting ${discoveredIslands.size} island client bundles`);
				}
			}
		},

		// Island inlining is handled as a post-build step.
		// See packages/avalon/src/post-build/inline-islands.ts
	};
}

// ─── Directory scanning ──────────────────────────────────────────────────────

function getPageAndLayoutDirsSync(config: ResolvedAvalonConfig, cwd: string): string[] {
	const dirs: string[] = [];

	if (config.pagesDir) {
		const p = resolve(cwd, config.pagesDir);
		if (existsSync(p)) dirs.push(p);
	}
	if (config.layoutsDir) {
		const p = resolve(cwd, config.layoutsDir);
		if (existsSync(p)) dirs.push(p);
	}
	if (config.modules) {
		const absModules = resolve(cwd, config.modules.dir);
		if (existsSync(absModules)) {
			try {
				for (const entry of readdirSync(absModules, { withFileTypes: true })) {
					if (!entry.isDirectory()) continue;
					for (const sub of ["pages", "layouts", "components"]) {
						const subDir = resolve(absModules, entry.name, sub);
						if (existsSync(subDir)) dirs.push(subDir);
					}
				}
			} catch {
				/* ignore */
			}
		}
	}
	return dirs;
}

/** Auto-island framework file patterns — components from these are bundled even without `island` prop */
const AUTO_ISLAND_PATTERNS = [".qwik."];

function isAutoIslandImport(importPath: string): boolean {
	return AUTO_ISLAND_PATTERNS.some((p) => importPath.includes(p));
}

function scanDirectorySync(dir: string, cwd: string, islands: Map<string, IslandSource>): void {
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		const fullPath = resolve(dir, entry.name);
		if (entry.isDirectory()) {
			scanDirectorySync(fullPath, cwd, islands);
			continue;
		}
		if (!/\.(tsx?|jsx?|mdx?)$/.test(entry.name)) continue;

		try {
			const content = readFileSync(fullPath, "utf-8");
			const hasExplicitIsland = content.includes("island=") || content.includes("island ");
			const hasAutoIslandImport = /import\s+\w+\s+from\s+['"][^'"]*\.qwik\.[^'"]*['"]/m.test(
				content,
			);
			if (!hasExplicitIsland && !hasAutoIslandImport) continue;
			extractIslandComponents(content, fullPath, cwd, islands);
		} catch {
			/* skip */
		}
	}
}

function extractIslandComponents(
	content: string,
	fileId: string,
	cwd: string,
	islands: Map<string, IslandSource>,
): void {
	// Find components used with explicit island prop
	const islandUsageRe = /<([A-Z]\w*)\s+[^>]*\bisland\b/g;
	const usedComponents = new Set<string>();
	let match;
	while ((match = islandUsageRe.exec(content)) !== null) usedComponents.add(match[1]);

	// Find auto-island components used as JSX elements (e.g. <QwikCounter />)
	const importRe = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
	const autoIslandNames = new Set<string>();
	const imports: Array<[string, string]> = [];
	while ((match = importRe.exec(content)) !== null) {
		imports.push([match[1], match[2]]);
		if (isAutoIslandImport(match[2])) {
			// Check if this component is used as a JSX element
			const jsxRe = new RegExp("<" + match[1] + "[\\s/>]");
			if (jsxRe.test(content)) {
				autoIslandNames.add(match[1]);
			}
		}
	}

	if (usedComponents.size === 0 && autoIslandNames.size === 0) return;

	for (const [name, importPath] of imports) {
		if (!usedComponents.has(name) && !autoIslandNames.has(name)) continue;
		const resolved = resolveImport(importPath, fileId, cwd);
		if (!resolved) continue;
		const relPath = relative(cwd, resolved)
			.replaceAll("\\", "/")
			.replace(/\.(tsx?|jsx?)$/, "");
		if (!islands.has(resolved)) islands.set(resolved, { filePath: resolved, bundleKey: relPath });
	}
}

function resolveImport(importPath: string, fromFile: string, cwd: string): string | null {
	let resolved: string;
	if (importPath.startsWith("@shared/")) resolved = resolve(cwd, "app/shared", importPath.slice(8));
	else if (importPath.startsWith("@modules/"))
		resolved = resolve(cwd, "app/modules", importPath.slice(9));
	else if (importPath.startsWith("@/")) resolved = resolve(cwd, "app", importPath.slice(2));
	else if (importPath.startsWith(".")) resolved = resolve(dirname(fromFile), importPath);
	else return null;

	if (existsSync(resolved) && statSync(resolved).isFile()) return resolved;
	for (const ext of [".tsx", ".ts", ".jsx", ".js", ".vue", ".svelte"]) {
		if (existsSync(resolved + ext)) return resolved + ext;
	}
	return null;
}
