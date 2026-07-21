/**
 * Nitro Integration Module for Avalon Vite Plugin
 *
 * Provides coordination between Avalon's Vite plugin and Nitro:
 * - API routes: Auto-discovered by Nitro from `api/` directory
 * - Page routes: Virtual module for SSR page component discovery
 * - Middleware: Auto-discovered by Nitro from `middleware/` directory
 */

import { type Dirent, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { stat as fsStat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import type { H3Event } from "h3";
import { nitro as nitroVitePlugin } from "nitro/vite";
import type { Plugin, ViteDevServer } from "vite";
import { isRunnableDevEnvironment } from "vite";
import { generateActionTypes } from "../build/actions-types-generator.ts";
import { createCronDevSchedulerPlugin } from "../cron/dev-scheduler.ts";
import { getUniversalCSSForHead } from "../islands/universal-css-collector.ts";
import {
	getUniversalHeadForInjection,
	injectSolidHydrationScriptIfNeeded,
} from "../islands/universal-head-collector.ts";
import {
	clearMiddlewareCache,
	discoverScopedMiddleware,
	executeScopedMiddleware,
} from "../middleware/index.ts";
import type { MiddlewareRoute } from "../middleware/types.ts";
import {
	type AvalonNitroConfig,
	createNitroConfig,
	type NitroConfigOutput,
} from "../nitro/config.ts";
import {
	createIslandManifestPlugin,
	createNitroBuildPlugin,
	createSourceMapConfig,
	createSourceMapPlugin,
} from "../nitro/index.ts";
import type { PageModule } from "../nitro/types.ts";
import { collectCssFromModuleGraph, injectSsrCss } from "../render/collect-css.ts";
import { generateErrorPage, generateFallback404 } from "../render/error-pages.ts";
import { generateComponentId } from "../server-islands/manifest.ts";
import { resolveToRelativePath } from "./server-islands-plugin.ts";
import type { ResolvedAvalonConfig } from "./types.ts";

/**
 * Generates the source for the `virtual:server-island-manifest` module by
 * SCANNING the project's source files from disk. This is provided to the Nitro
 * server bundle via Nitro's `virtual` option (the Nitro bundle is a separate
 * Rolldown pass that does not run Avalon's Vite `serverIslandsPlugin`, so the
 * module must be seeded here).
 *
 * IMPORTANT: this MUST NOT depend on Vite `transform`-hook timing. The Nitro
 * env evaluates this virtual module BEFORE the page-transform registrations run,
 * so reading the in-memory `getManifest()` Map returns 0 entries at eval time.
 * Instead we recompute the manifest by scanning `.tsx`/`.jsx` files under the
 * project's `app/` and `src/` dirs, mirroring the detection logic in
 * `serverIslandsPlugin` (PascalCase default imports used with a `server` prop).
 *
 * The resolved module path uses the EXACT same `resolveToRelativePath` logic the
 * runtime uses, so `generateComponentId(relativePath)` here matches the id that
 * `island.tsx` computes at runtime from `src`.
 */
function generateServerIslandManifestModule(projectRoot: string): string {
	const manifest = scanServerIslandManifest(projectRoot);
	const entries = Object.entries(manifest);
	let code = `export const serverIslandManifest = ${JSON.stringify(manifest)};\n\n`;
	code += "export const serverIslandLoaders = {\n";
	for (const [componentId, modulePath] of entries) {
		code += `  ${JSON.stringify(componentId)}: () => import(${JSON.stringify(modulePath)}),\n`;
	}
	code += "};\n\n";

	// Extract and embed CSS for Svelte components (their SSR render doesn't
	// return CSS in production, and the source files aren't on disk at runtime).
	const cssMap: Record<string, string> = {};
	for (const [componentId, modulePath] of entries) {
		if (!modulePath.endsWith(".svelte")) continue;
		try {
			const absPath = join(
				projectRoot,
				modulePath.startsWith("/") ? modulePath.slice(1) : modulePath,
			);
			const source = readFileSync(absPath, "utf8");
			const styleMatch = source.match(/<style[^>]*>([\s\S]*?)<\/style>/);
			if (styleMatch) {
				cssMap[componentId] = styleMatch[1].trim();
			}
		} catch {}
	}
	code += `export const serverIslandCSS = ${JSON.stringify(cssMap)};\n`;

	return code;
}

/**
 * Reads the full body of a Node request as a UTF-8 string, with a 15s timeout.
 * Shared by the dev server-islands and server-actions middleware handlers.
 */
function readRequestBody(req: IncomingMessage, timeoutMessage: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const chunks: Buffer[] = [];
		const onData = (chunk: Buffer) => chunks.push(chunk);
		const onEnd = () => {
			cleanup();
			resolve(Buffer.concat(chunks).toString("utf8"));
		};
		const onError = (err: Error) => {
			cleanup();
			reject(err);
		};
		const timer = setTimeout(() => {
			cleanup();
			reject(new Error(timeoutMessage));
		}, 15000);
		function cleanup() {
			clearTimeout(timer);
			req.off("data", onData);
			req.off("end", onEnd);
			req.off("error", onError);
		}
		req.on("data", onData);
		req.on("end", onEnd);
		req.on("error", onError);
	});
}

/** Regex for PascalCase default imports — `import Foo from "..."`. Multiline. */
const PASCAL_DEFAULT_IMPORT_RE = /^[ \t]*import\s+([A-Z]\w*)\s+from\s+(['"][^'"]+['"])/gm;

/** Directory names skipped while scanning for server islands. */
const SCAN_SKIP_DIRS = new Set([
	"node_modules",
	"dist",
	".output",
	".netlify",
	".vercel",
	".cloudflare",
	".wrangler",
	".firebase",
	".amplify-hosting",
	".git",
]);

/** Checks whether `localName` is used with a `server` prop in raw JSX. */
function usesServerProp(code: string, localName: string): boolean {
	// Non-greedy [\s\S]*? span (not [^>]*) so it still matches when an earlier
	// attribute value contains a `>` character (e.g. label="a>b").
	const pattern = new RegExp(String.raw`<${localName}\s[\s\S]*?\bserver\s*[={/>]`);
	return pattern.test(code);
}

/** True for `.tsx`/`.jsx` source files that aren't tests. */
function isCollectableSourceFile(name: string, full: string): boolean {
	if (!/\.(tsx|jsx)$/.test(name)) return false;
	// Skip test files
	if (/\.(test|spec)\.[jt]sx$/.test(name)) return false;
	if (full.includes("__tests__")) return false;
	return true;
}

/**
 * Recursively collects `.tsx`/`.jsx` source files under `dir`, skipping build
 * output, dependency, and test files.
 */
function collectSourceFiles(dir: string, out: string[]): void {
	let entries: Dirent[];
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!SCAN_SKIP_DIRS.has(entry.name)) collectSourceFiles(full, out);
		} else if (entry.isFile() && isCollectableSourceFile(entry.name, full)) {
			out.push(full);
		}
	}
}

/**
 * Scans a single file's source for PascalCase default imports used with a
 * `server` prop and records each as a server island in `manifest`.
 */
function collectIslandsFromFile(
	file: string,
	code: string,
	projectRoot: string,
	manifest: Record<string, string>,
): void {
	PASCAL_DEFAULT_IMPORT_RE.lastIndex = 0;
	let m: RegExpExecArray | null = PASCAL_DEFAULT_IMPORT_RE.exec(code);
	for (; m !== null; m = PASCAL_DEFAULT_IMPORT_RE.exec(code)) {
		const localName = m[1];
		const importPath = m[2].slice(1, -1);
		if (!usesServerProp(code, localName)) continue;

		const relativePath = resolveToRelativePath(importPath, file, projectRoot);
		const componentId = generateComponentId(relativePath);
		// De-duplicate by componentId (first writer wins; paths are identical).
		if (!(componentId in manifest)) {
			manifest[componentId] = relativePath;
		}
	}
}

/**
 * Scans the project's source files and builds the server-island manifest
 * (componentId → project-relative module path). De-duplicated by componentId.
 */
function scanServerIslandManifest(projectRoot: string): Record<string, string> {
	const manifest: Record<string, string> = {};
	const files: string[] = [];
	for (const baseName of ["app", "src"]) {
		const baseDir = join(projectRoot, baseName);
		if (existsSync(baseDir)) collectSourceFiles(baseDir, files);
	}

	for (const file of files) {
		let code: string;
		try {
			code = readFileSync(file, "utf8");
		} catch {
			continue;
		}
		// Quick bail — file must mention a `server` prop somewhere.
		if (!/\bserver\s*[={/>]/.test(code)) continue;

		collectIslandsFromFile(file, code, projectRoot, manifest);
	}

	return manifest;
}

/**
 * Locates the project's server-actions entry file, if any. Checks
 * `app/actions/index.*` then `src/actions/index.*` under the project root and
 * returns the path as a project-relative specifier (`/app/...` or `/src/...`),
 * matching the convention Rolldown resolves in the Nitro bundle. Returns
 * `undefined` when no actions entry exists.
 */
function findActionsEntry(projectRoot: string): string | undefined {
	const exts = ["ts", "tsx", "js", "jsx", "mts", "mjs"];
	for (const baseName of ["app", "src"]) {
		for (const ext of exts) {
			const rel = `/${baseName}/actions/index.${ext}`;
			if (existsSync(join(projectRoot, rel.slice(1)))) return rel;
		}
	}
	return undefined;
}

/**
 * Generates the source for `virtual:avalon-actions-manifest`. Provided to the
 * Nitro server bundle via Nitro's `virtual` option (a separate Rolldown pass
 * that does not run Avalon's Vite plugins). When an actions entry exists it
 * statically re-exports the project's `server` object so the handlers are
 * bundled into the server function; otherwise it emits an empty registry.
 */
function generateActionsManifestModule(projectRoot: string): string {
	const entry = findActionsEntry(projectRoot);
	if (!entry) {
		return "export const server = {};\n";
	}
	return `export { server } from ${JSON.stringify(entry)};\n`;
}

/**
 * Generates the runtime `virtual:avalon/actions` module: a ready-to-use typed
 * action client proxy. Contains ONLY the fetch proxy (no handler source), so it
 * is safe to include in the browser bundle. Types are supplied by the generated
 * `avalon-actions.d.ts` ambient declaration.
 */
function generateActionsClientModule(): string {
	return [
		`import { createActionClient } from "@useavalon/avalon/actions";`,
		`export const actions = createActionClient();`,
		`export default actions;`,
		"",
	].join("\n");
}

/** Decoded server-island payload (dev handler). */
type DecodedIslandPayload =
	| { ok: true; props: Record<string, unknown>; srcPath?: string; islandMeta: any }
	| { ok: false };

/**
 * Decrypts (or, in dev, base64url-decodes) a server-island payload and extracts
 * the island metadata + source path. Returns `{ ok: false }` on any failure.
 */
function decodeIslandPayload(
	payload: string,
	decrypt: (p: string) => string,
): DecodedIslandPayload {
	try {
		let decrypted: string;
		if (payload.startsWith("dev.")) {
			// Dev mode: base64url-encoded (no encryption)
			const encoded = payload.slice(4);
			decrypted = Buffer.from(encoded, "base64url").toString("utf8");
		} else {
			decrypted = decrypt(payload);
		}
		const parsed = JSON.parse(decrypted);
		let islandMeta: any;
		let srcPath: string | undefined;
		if (parsed.__island) {
			islandMeta = parsed.__island;
			delete parsed.__island;
		}
		if (parsed.__src) {
			srcPath = parsed.__src;
			delete parsed.__src;
		}
		return { ok: true, props: parsed, srcPath, islandMeta };
	} catch {
		return { ok: false };
	}
}

/** Builds the dev-mode hydration `<script>` appended to a combined island render. */
function buildDevIslandHydrationScript(
	url: string,
	islandMeta: any,
	srcPath: string,
	props: Record<string, unknown>,
): string {
	const pathSegments = url.split("/");
	const cId = pathSegments[2]?.split("?")[0] || "";
	const islandId = islandMeta.elementId ?? `si-${cId}`;
	const componentPath = islandMeta.componentSrc ?? srcPath;
	const propsJson = JSON.stringify(props);
	const condition = islandMeta.condition ?? "on:client";
	const fw = islandMeta.framework ?? "preact";
	const helperPath = resolveAvalonPackagePath("src/client/server-island-hydrate.ts");
	return `<script type="module">
import{hydrateServerIsland}from"/@fs${helperPath}";
hydrateServerIsland(${JSON.stringify(islandId)},${JSON.stringify(componentPath)},${propsJson},${JSON.stringify(condition)},${JSON.stringify(fw)});
</script>`;
}

/**
 * Resolves the absolute path to a file inside @useavalon/avalon's source tree.
 * Handles both workspace (.ts source) and published (.js compiled) layouts.
 */
function resolveAvalonPackagePath(relativePath: string): string {
	const require = createRequire(import.meta.url);
	const modEntry = require.resolve("@useavalon/avalon");
	const pkgRoot = dirname(modEntry);
	const resolved = join(pkgRoot, relativePath);
	// Published package ships .js in dist/, workspace has .ts source
	if (relativePath.endsWith(".ts") && !existsSync(resolved)) {
		const jsPath = resolved.replace(/\.ts$/, ".js");
		if (existsSync(jsPath)) return jsPath;
	}
	return resolved;
}

/**
 * Resolves the absolute path to a file inside an @useavalon/<name> integration package.
 * Handles both workspace (.ts source) and published (.js compiled) layouts.
 */
function resolveIntegrationPackagePath(name: string, relativePath: string): string {
	const require = createRequire(join(process.cwd(), "package.json"));
	const modEntry = require.resolve(`@useavalon/${name}`);
	const pkgRoot = dirname(modEntry);
	const resolved = join(pkgRoot, relativePath);
	if (relativePath.endsWith(".ts") && !existsSync(resolved)) {
		const jsPath = resolved.replace(/\.ts$/, ".js");
		if (existsSync(jsPath)) return jsPath;
	}
	return resolved;
}

export const VIRTUAL_MODULE_IDS = {
	PAGE_ROUTES: "virtual:avalon/page-routes",
	PAGE_LOADER: "virtual:avalon/page-loader",
	ISLAND_MANIFEST: "virtual:avalon/island-manifest",
	RUNTIME_CONFIG: "virtual:avalon/runtime-config",
	CONFIG: "virtual:avalon/config",
	LAYOUTS: "virtual:avalon/layouts",
	ASSETS: "virtual:avalon/assets",
	RENDERER: "virtual:avalon/renderer",
	CLIENT_ENTRY: "virtual:avalon/client-entry",
	INTEGRATION_LOADER: "virtual:avalon/integration-loader",
	ACTIONS: "virtual:avalon/actions",
} as const;

export const RESOLVED_VIRTUAL_IDS = {
	PAGE_ROUTES: `\0${VIRTUAL_MODULE_IDS.PAGE_ROUTES}`,
	PAGE_LOADER: `\0${VIRTUAL_MODULE_IDS.PAGE_LOADER}`,
	ISLAND_MANIFEST: `\0${VIRTUAL_MODULE_IDS.ISLAND_MANIFEST}`,
	RUNTIME_CONFIG: `\0${VIRTUAL_MODULE_IDS.RUNTIME_CONFIG}`,
	CONFIG: `\0${VIRTUAL_MODULE_IDS.CONFIG}`,
	LAYOUTS: `\0${VIRTUAL_MODULE_IDS.LAYOUTS}`,
	ASSETS: `\0${VIRTUAL_MODULE_IDS.ASSETS}`,
	RENDERER: `\0${VIRTUAL_MODULE_IDS.RENDERER}`,
	CLIENT_ENTRY: `\0${VIRTUAL_MODULE_IDS.CLIENT_ENTRY}`,
	INTEGRATION_LOADER: `\0${VIRTUAL_MODULE_IDS.INTEGRATION_LOADER}`,
	ACTIONS: `\0${VIRTUAL_MODULE_IDS.ACTIONS}`,
} as const;

export interface NitroIntegrationResult {
	nitroOptions: NitroConfigOutput;
	plugins: Plugin[];
}

export interface NitroCoordinationPluginOptions {
	avalonConfig: ResolvedAvalonConfig;
	nitroConfig: AvalonNitroConfig;
	verbose?: boolean;
}

/**
 * Creates the Nitro integration for Avalon — configuration, virtual modules,
 * build plugins, and SSR coordination.
 *
 * Uses the Nitro v3 Vite plugin from `nitro/vite` for server route discovery,
 * SSR rendering pipeline, and Rolldown-optimized bundling.
 */
/**
 * Packages Nitro should NOT inline for the configured shell engine.
 *
 * React is kept external (Node handles its CommonJS entry) when it's the shell
 * engine; under the Preact engine `react` is aliased to preact/compat, so these
 * patterns are moot. Extracted to keep `createNitroIntegration` simple.
 */
function shellEngineNoExternals(core: ResolvedAvalonConfig["core"]): Array<string | RegExp> {
	return core === "react" ? [] : [/^react/, /^react-dom/];
}

/** Import lines for the layout renderer, per shell engine. */
function layoutEngineImportLines(core: ResolvedAvalonConfig["core"]): string[] {
	if (core === "react") {
		return [
			`import { createElement as h } from 'react';`,
			`import { renderToString as preactRenderToString } from 'react-dom/server';`,
		];
	}
	return [
		`import { h } from 'preact';`,
		`import preactRenderToString from 'preact-render-to-string';`,
	];
}

/** Renderer-module lines that switch the shell engine to React (empty for Preact). */
function reactShellSetupLines(core: ResolvedAvalonConfig["core"]): string[] {
	if (core !== "react") return [];
	return [
		`import { setShellRenderToString, setShellElementFactory } from '@useavalon/avalon/render/shell-engine';`,
		`import { renderToString as __reactRenderToString } from 'react-dom/server';`,
		`import { createElement as __reactCreateElement, Fragment as __reactFragment } from 'react';`,
		`setShellRenderToString((vnode) => __reactRenderToString(vnode));`,
		`setShellElementFactory(__reactCreateElement, __reactFragment);`,
	];
}

/** Client module used to hydrate React islands, per shell engine. */
function reactClientModule(core: ResolvedAvalonConfig["core"]): string {
	// React islands hydrate via preact/compat under the Preact engine, but on
	// real React (@useavalon/react/client) when React is the shell engine.
	return core === "react" ? "@useavalon/react/client" : "@useavalon/preact/client";
}

/**
 * Generate the `virtual:server-island-integrations` module. Only statically
 * registers the server-capable framework integrations the project actually
 * configured — importing packages that aren't installed (e.g. @useavalon/solid
 * in a React-only app) would break the bundle. react/preact are registered by
 * the generated renderer module; this covers the rest.
 */
function generateServerIslandIntegrationsModule(integrations: readonly string[]): string {
	const registryPath = resolveAvalonPackagePath("src/core/integrations/registry.ts");
	const frameworks = (["solid", "vue", "svelte", "lit"] as const).filter((fw) =>
		integrations.includes(fw),
	);
	const lines = [
		`import { registry } from "${registryPath}";`,
		...frameworks.map((fw) => `import { ${fw}Integration } from "@useavalon/${fw}";`),
		...frameworks.map((fw) => `if (${fw}Integration) registry.register(${fw}Integration);`),
	];
	return `${lines.join("\n")}\n`;
}

export function createNitroIntegration(
	avalonConfig: ResolvedAvalonConfig,
	nitroConfig: AvalonNitroConfig = {},
): NitroIntegrationResult {
	const nitroOptions = createNitroConfig(nitroConfig, avalonConfig);

	// Project root used by the server-island source scanner. `ResolvedAvalonConfig`
	// carries no explicit root, and the Vite build runs from the project directory,
	// so `process.cwd()` is the correct base for resolving `app/` and `src/`.
	const serverIslandProjectRoot = process.cwd();

	// Nitro v3 Vite plugin — only pass keys that Nitro actually accepts.
	// Spreading the full nitroOptions leaks Avalon-specific keys (staticAssets,
	// publicAssets, etc.) which Nitro forwards to Rolldown, causing
	// "Invalid input options" warnings (e.g. "jsx" key errors).

	// Resolve the server islands route handler path from the @useavalon/avalon package.
	// This ensures the route is available in all Avalon projects regardless of
	// whether they have a routes/ directory.
	// NOTE: Only registered for production builds. In dev mode, the server islands
	// endpoint is handled by the coordination plugin's SSR middleware.
	const serverIslandsRoutePath = resolveAvalonPackagePath("src/server-islands/route.ts");
	const actionsRoutePath = resolveAvalonPackagePath("src/actions/route.ts");

	const nitroVitePluginOptions: Record<string, unknown> = {
		preset: nitroOptions.preset,
		serverDir: nitroConfig.serverDir ?? nitroOptions.serverDir ?? "./server",
		routeRules: nitroOptions.routeRules,
		runtimeConfig: nitroOptions.runtimeConfig,
		compatibilityDate: nitroOptions.compatibilityDate,
		// Tell Nitro to scan the project root so it discovers routes/ and middleware/
		// alongside the serverDir (./server) which contains the catch-all renderer.
		scanDirs: ["."],
		// Inline ESM-only packages that fail at runtime when Nitro leaves
		// them as external CJS require() calls. estree-walker v3 is the
		// primary offender — it only exports via ESM "import" condition.
		// Also inline @useavalon packages so their server renderers are
		// bundled directly (they ship .ts source, not CJS).
		//
		// React is deliberately NOT inlined when it's the shell engine: React 19
		// ships CommonJS, and inlining it makes Vite's dev SSR module runner
		// execute its `module.exports`/`require` entry, which fails. Leaving it
		// external lets Node's loader handle the CJS↔ESM interop in both dev and
		// the node server preset. (For preact-core apps `react` is aliased to
		// preact/compat, so these entries are moot there.)
		noExternals: [
			"estree-walker",
			/^@useavalon\//,
			/^estree-util/,
			/^preact/,
			...shellEngineNoExternals(avalonConfig.core),
			/^vue/,
			/^@vue\//,
		],
		// Register the server islands endpoint as a framework-provided route.
		// In dev mode when Nitro owns SSR, Nitro handles these requests directly.
		// When SSR is runnable (Avalon owns SSR), the middleware handles them instead.
		handlers: [
			{
				route: "/_server-islands/**",
				handler: serverIslandsRoutePath,
			},
			{
				route: "/_actions/**",
				handler: actionsRoutePath,
			},
		],
		// Seed the server island manifest into the Nitro server bundle. The Nitro
		// bundle is a separate Rolldown pass that does not run Avalon's
		// `serverIslandsPlugin`, so `endpoint.ts`'s `import("virtual:server-island-manifest")`
		// would otherwise be left unresolved. Nitro's `virtual` option is processed
		// by its internal `nitro:virtual` plugin inside the server-bundle pass.
		// The template is a function so it's evaluated lazily, after the manifest
		// has been populated by the client/SSR passes.
		virtual: {
			"virtual:server-island-manifest": () =>
				generateServerIslandManifestModule(serverIslandProjectRoot),
			// Bundle the project's server actions into the Nitro server function.
			// Like the server-island manifest, the Nitro bundle is a separate
			// Rolldown pass that does not run Avalon's Vite plugins, so
			// `actions/route.ts`'s `import("virtual:avalon-actions-manifest")`
			// must be seeded here. Statically re-exports the user's `server` object.
			"virtual:avalon-actions-manifest": () =>
				generateActionsManifestModule(serverIslandProjectRoot),
			// Embed the build-time encryption key so single-instance deploys work
			// out-of-the-box without setting AVALON_KEY. The serverIslandsPlugin
			// config() hook generates a key and sets process.env.AVALON_KEY if not
			// already set by the user — this captures it at build time.
			"virtual:server-island-key": () => {
				const key = process.env.AVALON_KEY ?? "";
				return `export const serverIslandKey = ${JSON.stringify(key)};\n`;
			},
			// Bundle all framework SSR integrations into the Nitro server function.
			// Without this, the integration registry's @vite-ignore dynamic imports
			// leave bare specifiers unresolved in the bundle. This virtual module
			// statically imports each integration and registers it, ensuring the
			// bundler traces and inlines the full dependency tree.
			"virtual:server-island-integrations": () =>
				generateServerIslandIntegrationsModule(avalonConfig.integrations),
		},
	};

	// Only pass renderer when explicitly configured — passing `undefined`
	// can interfere with Nitro's internal SSR entry auto-detection.
	if (nitroConfig.renderer === false) {
		nitroVitePluginOptions.renderer = false;
	} else if (nitroOptions.renderer) {
		nitroVitePluginOptions.renderer = nitroOptions.renderer;
	}

	// Only include optional keys if they're defined
	if (nitroOptions.publicRuntimeConfig) {
		nitroVitePluginOptions.publicRuntimeConfig = nitroOptions.publicRuntimeConfig;
	}
	if (nitroOptions.publicAssets) {
		nitroVitePluginOptions.publicAssets = nitroOptions.publicAssets;
	}
	if (nitroOptions.compressPublicAssets) {
		nitroVitePluginOptions.compressPublicAssets = nitroOptions.compressPublicAssets;
	}
	if (nitroOptions.serverEntry) {
		nitroVitePluginOptions.serverEntry = nitroOptions.serverEntry;
	}

	// Forward cron / scheduled task configuration to Nitro's native task system.
	// Only for production builds: enabling Nitro's task system in dev makes Nitro
	// take over the SSR environment (swapping Avalon's runnable SSR for a
	// fetchable dev-worker), which changes rendering behavior. In dev we schedule
	// jobs ourselves via the cron dev-scheduler plugin instead, keeping SSR owned
	// by Avalon. `configResolved` isn't available here (isDev is hardcoded true at
	// plugin-factory time), so detect the build command from argv/NODE_ENV.
	const isBuildCommand = process.argv.includes("build") || process.env.NODE_ENV === "production";
	if (nitroOptions.experimentalTasks && isBuildCommand) {
		nitroVitePluginOptions.experimental = {
			...(nitroVitePluginOptions.experimental as Record<string, unknown> | undefined),
			tasks: true,
		};
		if (nitroOptions.tasks && Object.keys(nitroOptions.tasks).length > 0) {
			nitroVitePluginOptions.tasks = nitroOptions.tasks;
		}
		if (nitroOptions.scheduledTasks && Object.keys(nitroOptions.scheduledTasks).length > 0) {
			nitroVitePluginOptions.scheduledTasks = nitroOptions.scheduledTasks;
		}
	}

	// Ensure undici is always traced — Nitro's server bundle imports it
	// for its HTTP agent but doesn't always trace it automatically.
	// Without this, the built server fails with ERR_MODULE_NOT_FOUND
	// when spawned standalone (e.g. for prerendering).
	const userTraceDeps = nitroOptions.traceDeps ?? [];
	const traceDeps = [...new Set(["undici", ...userTraceDeps])];
	nitroVitePluginOptions.traceDeps = traceDeps;

	// Do NOT forward prerender config to Nitro — Nitro's built-in prerenderer
	// doesn't work correctly with custom SSR entries (returns 404 for all routes).
	// Avalon handles prerendering in a post-build step instead (see
	// packages/avalon/src/prerender/). The config is stored on nitroOptions
	// so the post-build step can read it, but we explicitly disable Nitro's
	// own prerender to prevent it from running and failing the build.
	if (nitroOptions.prerender) {
		// Store on nitroOptions for post-build, but tell Nitro not to prerender
		nitroVitePluginOptions.prerender = { routes: [], crawlLinks: false };
	}

	const nitroPlugin = nitroVitePlugin(nitroVitePluginOptions);

	const coordinationPlugin = createNitroCoordinationPlugin({
		avalonConfig,
		nitroConfig,
		verbose: avalonConfig.verbose,
	});

	const virtualModulesPlugin = createVirtualModulesPlugin({
		avalonConfig,
		nitroConfig,
		verbose: avalonConfig.verbose,
	});

	const buildPlugin = createNitroBuildPlugin(avalonConfig, nitroConfig);

	const manifestPlugin = createIslandManifestPlugin(avalonConfig, {
		verbose: avalonConfig.verbose,
		generatePreloadHints: true,
	});

	const sourceMapConfig = createSourceMapConfig(
		nitroConfig.preset ?? "node_server",
		avalonConfig.isDev,
	);
	const sourceMapPlugin = createSourceMapPlugin(sourceMapConfig);

	// Dev-mode cron scheduler. Runs the configured jobs inside the Vite process
	// during `vite dev` so cron works without enabling Nitro's task system
	// (which would take over the dev SSR environment). No-op outside dev.
	const cronDevSchedulerPlugin = createCronDevSchedulerPlugin(
		nitroConfig.cron,
		avalonConfig.verbose,
	);

	return {
		nitroOptions,
		plugins: [
			...(Array.isArray(nitroPlugin) ? nitroPlugin : [nitroPlugin]),
			coordinationPlugin,
			virtualModulesPlugin,
			buildPlugin,
			manifestPlugin,
			sourceMapPlugin,
			cronDevSchedulerPlugin,
		],
	};
}

/**
 * Coordination plugin: stores config/server refs, sets up SSR middleware and HMR,
 * and prewarms core infrastructure modules (fire-and-forget).
 */
export function createNitroCoordinationPlugin(options: NitroCoordinationPluginOptions): Plugin {
	const { avalonConfig, verbose } = options;

	return {
		name: "avalon:nitro-coordination",
		enforce: "pre",

		config(_config, { command }) {
			if (command === "serve") {
				// Exclude build output directories from the dev server.
				// Without this, stale production builds interfere with dev mode
				// (e.g., prerendered HTML with per-island scripts gets served instead of fresh SSR).
				return {
					server: {
						watch: {
							ignored: [
								"**/.output/**",
								"**/dist/**",
								"**/.netlify/**",
								"**/.vercel/**",
								"**/.cloudflare/**",
								"**/.wrangler/**",
								"**/.firebase/**",
								"**/.amplify-hosting/**",
							],
						},
						fs: {
							deny: [
								".output",
								"dist",
								".netlify",
								".vercel",
								".cloudflare",
								".wrangler",
								".firebase",
								".amplify-hosting",
							],
						},
					},
				};
			}
		},

		configResolved(_config) {
			// Hydration mode: dev uses entry-client (HMR), production uses per-island.
			// __avalonConfig is set by the main avalon plugin with the resolved isDev value.
			globalThis.__avalonHydrationMode =
				_config.command === "serve" ? "entry-client" : "per-island";

			// Generate the typed `virtual:avalon/actions` ambient declaration so the
			// `actions` client proxy infers input/output from the project's `server`
			// export. No-op when no actions entry exists.
			try {
				generateActionTypes(_config.root || process.cwd());
			} catch {
				// Type generation is best-effort — never block the build.
			}
		},

		configureServer(server: ViteDevServer) {
			globalThis.__viteDevServer = server;

			// Regenerate the typed actions declaration when action files change.
			const projectRoot = server.config.root || process.cwd();
			const regenActionTypes = (file: string) => {
				if (file.includes("/actions/")) {
					try {
						generateActionTypes(projectRoot);
					} catch {}
				}
			};
			server.watcher.on("add", regenActionTypes);
			server.watcher.on("unlink", regenActionTypes);

			// Clean stale build output that interferes with dev mode.
			// The `dist/` directory (Vite's build outDir) contains prerendered HTML
			// from production builds. Vite's static middleware serves these files
			// for document requests, bypassing fresh SSR. Similarly, `.output/public`
			// can be picked up by Nitro's static handler.
			// This cleanup runs synchronously at dev server startup — the build
			// recreates these directories from scratch. This is the same pattern
			// Nuxt uses (cleaning .nuxt on dev start).
			const root = server.config.root || process.cwd();
			const outDir = server.config.build?.outDir
				? join(root, server.config.build.outDir)
				: join(root, "dist");
			try {
				rmSync(outDir, { recursive: true, force: true });
			} catch {}
			try {
				rmSync(join(root, ".output"), { recursive: true, force: true });
			} catch {}

			// Hold early requests until the SSR environment is ready.
			// Without this, the first request hits Nitro before its SSR entry
			// has compiled, causing a 503 "Vite environment ssr is unavailable"
			// error that shows as a Parse Error overlay.
			let ssrReady = false;
			const ssrReadyPromise = new Promise<void>((resolve) => {
				// Poll until the nitro environment is initialized (entry loaded).
				// Nitro's FetchableDevEnvironment sets up asynchronously after
				// configureServer returns, so we wait for it.
				const check = () => {
					const nitroEnv = server.environments?.nitro as any;
					if (nitroEnv?.devServer?.entry || ssrReady) {
						ssrReady = true;
						resolve();
					} else {
						setTimeout(check, 50);
					}
				};
				// Start checking after a short delay to let Nitro register
				setTimeout(check, 100);
				// Safety timeout — don't block forever
				setTimeout(() => {
					ssrReady = true;
					resolve();
				}, 15000);
			});

			server.middlewares.use(async (req, res, next) => {
				if (ssrReady) return next();
				// Only hold document requests (HTML pages), let assets through
				const url = req.url || "/";
				if (
					url.startsWith("/@") ||
					url.startsWith("/__") ||
					/\/[^/]+\.[a-z0-9]+(\?|$)/i.test(url)
				) {
					return next();
				}
				// Wait for SSR to be ready
				await ssrReadyPromise;
				next();
			});

			// Scoped middleware — discovered once, cached until invalidated by HMR
			let scopedMiddlewareRoutes: MiddlewareRoute[] | null = null;

			async function getScopedMiddleware(): Promise<MiddlewareRoute[]> {
				if (!scopedMiddlewareRoutes) {
					const viteRoot = server.config.root || process.cwd();
					scopedMiddlewareRoutes = await discoverScopedMiddleware({
						baseDir: `${viteRoot}/src`,
						devMode: false,
					});
				}
				return scopedMiddlewareRoutes;
			}

			function clearScopedMiddlewareRoutes(): void {
				scopedMiddlewareRoutes = null;
			}

			setupHMRCoordination(server, avalonConfig, verbose, clearScopedMiddlewareRoutes);

			// Pre-discover middleware (non-blocking)
			getScopedMiddleware().catch((err) => {
				console.warn("[middleware] Failed to discover middleware:", err);
			});

			// When Nitro manages the SSR environment it replaces the default
			// RunnableDevEnvironment with a FetchableDevEnvironment. In that
			// case server.ssrLoadModule() will throw because it requires a
			// RunnableDevEnvironment. Detect this once at startup and skip
			// the avalon SSR middleware entirely — Nitro's own env-runner
			// pipeline handles SSR requests instead.
			const ssrEnv = server.environments?.ssr;
			const ssrIsRunnable = !!ssrEnv && isRunnableDevEnvironment(ssrEnv);

			if (ssrIsRunnable) {
				// Fire-and-forget: prewarm only core infrastructure modules.
				// Pages, islands, and per-route middleware are loaded on-demand.
				prewarmCoreModules(server, avalonConfig.integrations, verbose).catch((err) => {
					console.error("[prewarm] Core modules pre-warm failed:", err);
				});
			}

			// Server islands middleware — handles /_server-islands/ requests in dev mode.
			// Only active when the SSR environment is runnable (Avalon owns SSR).
			// When Nitro owns SSR (!ssrIsRunnable), the request passes through to
			// Nitro's registered handler instead.
			server.middlewares.use(async (req, res, next) => {
				const url = req.url || "/";
				if (!url.startsWith("/_server-islands/")) return next();
				if (!ssrIsRunnable) return next();

				try {
					const { decrypt } = await server.ssrLoadModule(
						resolveAvalonPackagePath("src/server-islands/encryption.ts"),
					);
					const { h, renderToString: preactRenderToString } = await loadDevShellEngine(
						server,
						avalonConfig.core,
					);

					// Extract encrypted props from query param or POST body
					const fullUrl = new URL(url, `http://${req.headers.host || "localhost"}`);
					let payload = fullUrl.searchParams.get("p") || "";

					if (!payload && req.method === "POST") {
						payload = await readRequestBody(req, "Timed out reading server island request body");
					}

					if (!payload) {
						res.statusCode = 400;
						res.setHeader("Content-Type", "text/plain");
						res.end("Missing encrypted props");
						return;
					}

					// Decrypt props (or decode in dev mode)
					const decoded = decodeIslandPayload(payload, decrypt);
					if (!decoded.ok) {
						res.statusCode = 400;
						res.setHeader("Content-Type", "text/plain");
						res.end("Bad Request: decryption failed");
						return;
					}
					const { props, srcPath, islandMeta } = decoded;

					if (!srcPath) {
						res.statusCode = 404;
						res.setHeader("Content-Type", "text/plain");
						res.end("Component not found (no __src in payload)");
						return;
					}

					// Load the component via Vite's SSR module loader
					const mod = await server.ssrLoadModule(srcPath);
					const Component = mod.default;
					if (typeof Component !== "function") {
						res.statusCode = 500;
						res.setHeader("Content-Type", "text/plain");
						res.end(`Module "${srcPath}" does not export a default component function`);
						return;
					}

					// Render the component
					const vnode = h(Component, props);
					let html = preactRenderToString(vnode);

					// If combined island, append dev-mode hydration script
					if (islandMeta) {
						html += buildDevIslandHydrationScript(url, islandMeta, srcPath, props);
					}

					res.statusCode = 200;
					res.setHeader("Content-Type", "text/html");
					res.setHeader("Cache-Control", "private, no-store");
					res.end(html);
				} catch (error) {
					console.error("[server-islands] Dev handler error:", error);
					res.statusCode = 500;
					res.setHeader("Content-Type", "text/plain");
					res.end(
						`Server island render failed: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			});

			// Server actions middleware — handles /_actions/ requests in dev mode.
			// Loads the project's actions entry + endpoint via Vite's SSR module
			// runner so the user's handlers, Zod schemas, and ActionError class all
			// share the SSR module realm (keeping `instanceof` checks valid). This
			// mirrors the production Nitro handler exactly — no silent fallbacks.
			server.middlewares.use(async (req, res, next) => {
				const url = req.url || "/";
				if (!url.startsWith("/_actions/")) return next();
				if (!ssrIsRunnable) return next();

				try {
					const root = server.config.root || process.cwd();
					const entryRel = findActionsEntry(root);

					const [endpointMod, registryMod, actionsMod] = await Promise.all([
						server.ssrLoadModule(resolveAvalonPackagePath("src/actions/endpoint.ts")),
						server.ssrLoadModule(resolveAvalonPackagePath("src/actions/registry.ts")),
						entryRel
							? server.ssrLoadModule(entryRel)
							: Promise.resolve({ server: {} } as { server: unknown }),
					]);

					const registry = registryMod.flattenActions((actionsMod as { server?: unknown }).server);
					const handler = endpointMod.defineActionHandler({ registry, isDev: true });

					// Build a web Request from the Node request (only POST has a body).
					const fullUrl = new URL(url, `http://${req.headers.host || "localhost"}`);
					const method = (req.method || "GET").toUpperCase();
					let body: string | undefined;
					if (method === "POST") {
						body = await readRequestBody(req, "Timed out reading action request body");
					}

					const request = new Request(fullUrl, {
						method,
						headers: req.headers as Record<string, string>,
						body,
					});
					const event = { url: fullUrl, web: { request }, context: {} };

					const response = await handler(event);
					res.statusCode = response.status;
					response.headers.forEach((value: string, key: string) => {
						res.setHeader(key, value);
					});
					res.end(await response.text());
				} catch (error) {
					console.error("[actions] Dev handler error:", error);
					res.statusCode = 500;
					res.setHeader("Content-Type", "application/json");
					res.end(
						JSON.stringify({
							error: {
								code: "INTERNAL_SERVER_ERROR",
								message: error instanceof Error ? error.message : String(error),
							},
						}),
					);
				}
			});

			// SSR middleware — runs before Vite's SPA fallback.
			// When Nitro owns the SSR environment (non-runnable), we skip
			// this middleware and let Nitro's handler serve the request.
			server.middlewares.use(async (req, res, next) => {
				if (!ssrIsRunnable) return next();

				const originalUrl = req.url || "/";
				let url = originalUrl;

				if (url.endsWith(".html")) url = url.slice(0, -5) || "/";
				if (url === "/index") url = "/";

				// Skip static files, HMR, and Vite internals
				if (
					url.startsWith("/@") ||
					url.startsWith("/__") ||
					url.startsWith("/node_modules/") ||
					url.startsWith("/src/client/") ||
					url.startsWith("/packages/") ||
					(url.includes(".") && !url.endsWith("/"))
				) {
					return next();
				}

				if (url.startsWith("/api/")) {
					return next();
				}

				try {
					const middlewareHandled = await handleScopedMiddleware(
						server,
						url,
						req,
						res,
						getScopedMiddleware,
						verbose,
					);
					if (middlewareHandled) return;

					// Try streaming SSR first (streams shell before page data resolves)
					const streamed = await handleStreamingSSRRequest(server, url, avalonConfig, res);
					if (streamed) return;

					// Fallback to buffered SSR for non-modular pages
					const html = await handleSSRRequest(server, url, avalonConfig);
					if (html) {
						res.statusCode = 200;
						res.setHeader("Content-Type", "text/html");
						res.end(html);
						return;
					}

					await handle404(server, url, res, avalonConfig);
				} catch (error) {
					console.error("[SSR Error]", error);
					res.statusCode = 500;
					res.setHeader("Content-Type", "text/html");
					res.end(generateErrorPage(error as Error));
				}
			});

			// Return a function that adds post-middleware — runs AFTER Nitro's
			// SSR handler. When Nitro owns the SSR environment (!ssrIsRunnable),
			// this intercepts the HTML response and injects layout CSS collected
			// from Vite's module graph, preventing FOUC.
			if (!ssrIsRunnable) {
				// Nitro owns SSR — layout CSS is handled by <link> tags
				// injected in the generated wrapWithLayouts module.
			}
		},

		buildStart() {
			// no-op in production — coordination happens via other plugins
		},
	};
}

// ─── Dev Server Middleware Helpers ───────────────────────────────────────────

import type { IncomingMessage, ServerResponse } from "node:http";

async function handleScopedMiddleware(
	_server: ViteDevServer,
	url: string,
	req: IncomingMessage,
	res: ServerResponse,
	getScopedMiddleware: () => Promise<MiddlewareRoute[]>,
	_verbose?: boolean,
): Promise<boolean> {
	const middlewareStart = performance.now();
	const middlewareRoutes = await getScopedMiddleware();
	if (middlewareRoutes.length === 0) return false;

	const headers: Record<string, string> = {};
	for (const [key, value] of Object.entries(req.headers)) {
		if (typeof value === "string") headers[key] = value;
		else if (Array.isArray(value)) headers[key] = value.join(", ");
	}

	const fullUrl = `http://${req.headers.host || "localhost"}${url}`;
	const h3Event = {
		url: fullUrl,
		method: req.method || "GET",
		path: url,
		node: { req, res },
		req: new Request(fullUrl, {
			method: req.method || "GET",
			headers,
		}),
		context: {} as Record<string, unknown>,
	} as unknown as H3Event;

	const middlewareResponse = await executeScopedMiddleware(h3Event, middlewareRoutes, {
		devMode: false,
	});

	const middlewareTime = performance.now() - middlewareStart;
	if (middlewareTime > 100) {
		console.warn(`⚠️ Slow middleware: ${middlewareTime.toFixed(0)}ms for ${url}`);
	}

	if (middlewareResponse) {
		res.statusCode = middlewareResponse.status;
		middlewareResponse.headers.forEach((value, key) => {
			res.setHeader(key, value);
		});
		res.end(await middlewareResponse.text());
		return true;
	}
	return false;
}

async function handle404(
	server: ViteDevServer,
	url: string,
	res: ServerResponse,
	config: ResolvedAvalonConfig,
): Promise<void> {
	try {
		const { discoverErrorPages, getErrorPageModule, generateDefaultErrorPage } = await import(
			"../nitro/error-handler.ts"
		);
		const errorPages = await discoverErrorPages({
			isDev: config.isDev,
			pagesDir: config.pagesDir,
			loadPageModule: async (filePath: string): Promise<PageModule> => {
				return (await server.ssrLoadModule(filePath)) as PageModule;
			},
		});
		const errorPageModule = getErrorPageModule(404, errorPages);

		if (errorPageModule?.default && typeof errorPageModule.default === "function") {
			const { renderToHtml } = await import("../render/ssr.ts");
			const ErrorPageComponent = errorPageModule.default;
			const errorHtml = await renderToHtml(
				{
					component: () =>
						ErrorPageComponent({ statusCode: 404, message: `Page not found: ${url}`, url }),
				},
				{},
			);
			res.statusCode = 404;
			res.setHeader("Content-Type", "text/html");
			res.end(errorHtml);
			return;
		}

		const fallbackHtml = generateDefaultErrorPage(404, `Page not found: ${url}`, config.isDev);
		res.statusCode = 404;
		res.setHeader("Content-Type", "text/html");
		res.end(fallbackHtml);
	} catch {
		res.statusCode = 404;
		res.setHeader("Content-Type", "text/html");
		res.end(generateFallback404(url));
	}
}

/**
 * Prewarms core infrastructure modules (fire-and-forget).
 * Loads SSR infrastructure and framework renderers so the first page render
 * doesn't pay the full module-load cost. Island components are loaded on-demand
 * to avoid penalizing startup with unused modules.
 */
async function prewarmCoreModules(
	server: ViteDevServer,
	integrations: readonly string[],
	verbose?: boolean,
): Promise<void> {
	const prewarmStart = performance.now();

	const coreModules = [
		{ path: resolveAvalonPackagePath("src/render/ssr.ts"), assignTo: "ssr" as string | null },
		{
			path: resolveAvalonPackagePath("src/core/layout/enhanced-layout-resolver.ts"),
			assignTo: "layout" as string | null,
		},
		{ path: resolveAvalonPackagePath("src/middleware/index.ts"), assignTo: null as string | null },
		...integrations.map((name) => ({
			path: resolveIntegrationPackagePath(name, "server/renderer.ts"),
			assignTo: null as string | null,
		})),
	];

	const results = await Promise.allSettled(
		coreModules.map(async ({ path, assignTo }) => {
			const mod = await server.ssrLoadModule(path);
			if (assignTo === "ssr") cachedSSRModule = mod;
			if (assignTo === "layout") cachedLayoutModule = mod;
		}),
	);

	const succeeded = results.filter((r) => r.status === "fulfilled").length;
	const totalTime = performance.now() - prewarmStart;

	if (verbose && succeeded > 0) {
		console.log(
			`🔥 SSR ready in ${totalTime.toFixed(0)}ms (${succeeded}/${coreModules.length} core modules)`,
		);
	}
}

/**
 * Virtual modules plugin — page routes, island manifest, runtime config.
 */
export function createVirtualModulesPlugin(options: NitroCoordinationPluginOptions): Plugin {
	const { avalonConfig, nitroConfig, verbose } = options;

	// Cache generated layouts module to avoid repeated async filesystem scans
	let cachedLayoutsModule: string | null = null;

	// Pre-discover CSS files synchronously at plugin creation time so the
	// virtual module load hook doesn't need to do async filesystem I/O.
	// This keeps the SSR entry resolution fast and avoids Nitro's 503 timeout.
	const pathJoin = join;
	const pathRelative = relative;
	const pathResolve = resolve;
	const _cwd = process.cwd();
	const _devCssLinks: string[] = [];

	function scanCssSync(dir: string): void {
		try {
			const entries = readdirSync(dir, { withFileTypes: true });
			for (const entry of entries) {
				const full = pathJoin(dir, entry.name);
				if (entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith(".")) {
					scanCssSync(full);
				} else if (entry.isFile() && entry.name.endsWith(".css")) {
					const rel = pathRelative(_cwd, full).replaceAll("\\", "/");
					_devCssLinks.push(rel.startsWith("/") ? rel : `/${rel}`);
				}
			}
		} catch {
			/* skip */
		}
	}

	function rescanCss(): void {
		_devCssLinks.length = 0;
		for (const cssPath of nitroConfig.globalCSS ?? []) {
			_devCssLinks.push(cssPath.startsWith("/") ? cssPath : `/${cssPath}`);
		}
		if (avalonConfig.modules) {
			scanCssSync(pathResolve(_cwd, avalonConfig.modules.dir));
		}
		scanCssSync(pathResolve(_cwd, avalonConfig.layoutsDir));
		// Also scan the shared directory (components, styles) for CSS modules
		const sharedDir = pathResolve(_cwd, avalonConfig.layoutsDir, "..");
		if (
			sharedDir !== _cwd &&
			sharedDir !== pathResolve(_cwd, avalonConfig.layoutsDir) &&
			sharedDir.startsWith(_cwd)
		) {
			scanCssSync(sharedDir);
		}
	}

	if (avalonConfig.isDev) {
		rescanCss();
	}

	return {
		name: "avalon:nitro-virtual-modules",
		enforce: "pre",

		resolveId(id: string) {
			if (id === VIRTUAL_MODULE_IDS.PAGE_ROUTES) return RESOLVED_VIRTUAL_IDS.PAGE_ROUTES;
			if (id === VIRTUAL_MODULE_IDS.PAGE_LOADER) return RESOLVED_VIRTUAL_IDS.PAGE_LOADER;
			if (id === VIRTUAL_MODULE_IDS.ISLAND_MANIFEST) return RESOLVED_VIRTUAL_IDS.ISLAND_MANIFEST;
			if (id === VIRTUAL_MODULE_IDS.RUNTIME_CONFIG) return RESOLVED_VIRTUAL_IDS.RUNTIME_CONFIG;
			if (id === VIRTUAL_MODULE_IDS.CONFIG) return RESOLVED_VIRTUAL_IDS.CONFIG;
			if (id === VIRTUAL_MODULE_IDS.LAYOUTS) return RESOLVED_VIRTUAL_IDS.LAYOUTS;
			if (id === VIRTUAL_MODULE_IDS.ASSETS) return RESOLVED_VIRTUAL_IDS.ASSETS;
			if (id === VIRTUAL_MODULE_IDS.RENDERER) return RESOLVED_VIRTUAL_IDS.RENDERER;
			if (id === VIRTUAL_MODULE_IDS.CLIENT_ENTRY) return RESOLVED_VIRTUAL_IDS.CLIENT_ENTRY;
			if (id === VIRTUAL_MODULE_IDS.INTEGRATION_LOADER)
				return RESOLVED_VIRTUAL_IDS.INTEGRATION_LOADER;
			if (id === VIRTUAL_MODULE_IDS.ACTIONS) return RESOLVED_VIRTUAL_IDS.ACTIONS;
			return null;
		},

		async load(id: string) {
			if (id === RESOLVED_VIRTUAL_IDS.PAGE_ROUTES)
				return await generatePageRoutesModule(avalonConfig, verbose);
			if (id === RESOLVED_VIRTUAL_IDS.PAGE_LOADER)
				return await generatePageLoaderModule(avalonConfig, verbose);
			if (id === RESOLVED_VIRTUAL_IDS.ISLAND_MANIFEST) return generateIslandManifestModule();
			if (id === RESOLVED_VIRTUAL_IDS.RUNTIME_CONFIG)
				return generateRuntimeConfigModule(avalonConfig, nitroConfig);
			if (id === RESOLVED_VIRTUAL_IDS.CONFIG)
				return generateConfigModule(avalonConfig, nitroConfig);
			if (id === RESOLVED_VIRTUAL_IDS.LAYOUTS) {
				if (!cachedLayoutsModule) {
					cachedLayoutsModule = await generateLayoutsModule(
						avalonConfig,
						nitroConfig,
						_devCssLinks,
					);
				}
				return cachedLayoutsModule;
			}
			if (id === RESOLVED_VIRTUAL_IDS.ASSETS) return generateAssetsModule(nitroConfig);
			if (id === RESOLVED_VIRTUAL_IDS.RENDERER) return generateRendererModule(avalonConfig);
			if (id === RESOLVED_VIRTUAL_IDS.CLIENT_ENTRY)
				return await generateClientEntryModule(avalonConfig, nitroConfig);
			if (id === RESOLVED_VIRTUAL_IDS.INTEGRATION_LOADER)
				return generateIntegrationLoaderModule(avalonConfig);
			if (id === RESOLVED_VIRTUAL_IDS.ACTIONS) return generateActionsClientModule();
			return null;
		},

		handleHotUpdate({ file, server }) {
			// SSR pages/components/layouts/CSS: trigger a full browser reload.
			// Nitro's own environment handles SSR module invalidation internally.
			const { isPage, isComponent, isLayout, isCss } = classifyHotFile(file);

			if (isPage || isComponent || isLayout || isCss) {
				if (isPage) {
					// Invalidate across all environments (client/ssr/nitro) so the
					// server-side route table is invalidated, not just the client graph.
					invalidateVirtualEverywhere(server, RESOLVED_VIRTUAL_IDS.PAGE_ROUTES);
					invalidateVirtualEverywhere(server, RESOLVED_VIRTUAL_IDS.PAGE_LOADER);
					void reloadNitroPageRoutes(server);
				}
				if (isLayout) {
					cachedLayoutsModule = null;
					rescanCss();
					invalidateModuleById(server, RESOLVED_VIRTUAL_IDS.LAYOUTS);
					invalidateModuleById(server, RESOLVED_VIRTUAL_IDS.CLIENT_ENTRY);
				}
				// Full page reload after Nitro's SSR worker has recompiled.
				setTimeout(() => {
					server.ws.send({ type: "full-reload", path: "*" });
				}, 500);
			}

			// Invalidate virtual:avalon/config when config-related files change
			if (isAvalonConfigFile(file)) {
				invalidateModuleById(server, RESOLVED_VIRTUAL_IDS.CONFIG);
			}
		},
	};
}

/** Invalidates a Vite module graph entry by id, if it exists. */
function invalidateModuleById(server: ViteDevServer, id: string): void {
	const mod = server.moduleGraph.getModuleById(id);
	if (mod) server.moduleGraph.invalidateModule(mod);
}

/**
 * Invalidates a resolved virtual-module id across every Vite environment
 * (client, ssr, nitro) plus the legacy top-level graph. The SSR route table is
 * built in the ssr/nitro environments; {@link invalidateModuleById} only
 * invalidates the legacy client graph, so the per-environment sweep is required
 * to also invalidate the server-side route table.
 */
function invalidateVirtualEverywhere(server: ViteDevServer, id: string): void {
	// Legacy/client graph.
	invalidateModuleById(server, id);

	const environments = (server as unknown as { environments?: Record<string, unknown> })
		.environments;
	if (!environments) return;

	for (const env of Object.values(environments)) {
		const graph = (
			env as {
				moduleGraph?: {
					getModuleById(id: string): unknown;
					invalidateModule(mod: unknown): void;
				};
			}
		).moduleGraph;
		if (!graph) continue;
		try {
			const mod = graph.getModuleById(id);
			if (mod) graph.invalidateModule(mod);
		} catch {
			// A given environment may not know this module — ignore.
		}
	}
}

/**
 * Signals the Nitro dev runner to re-import its SSR entry, which re-runs page
 * route discovery against the (already invalidated) page-routes module.
 *
 * The env-runner worker re-imports its entry on a `full-reload` sent over its
 * IPC channel (`devServer.sendMessage`). The Vite hot channel is not used here:
 * it re-evaluates CSS in the SSR environment, which triggers a crash under Vite
 * 8 with Tailwind v4 (`cssModulesCache`).
 */
async function reloadNitroPageRoutes(server: ViteDevServer): Promise<void> {
	const nitroEnv = (server as unknown as { environments?: Record<string, unknown> }).environments
		?.nitro as
		| {
				devServer?: {
					sendMessage?: (payload: unknown) => void;
					reloadRoutes?: () => unknown;
				};
		  }
		| undefined;
	if (!nitroEnv) return;
	try {
		// The env-runner worker re-imports its entry (re-running route discovery)
		// on this IPC message.
		nitroEnv.devServer?.sendMessage?.({ type: "full-reload" });
		// `reloadRoutes` is not currently implemented by the env-runner; called
		// optionally in case a supported route-reload API is added later.
		await nitroEnv.devServer?.reloadRoutes?.();
	} catch {
		// If the IPC call fails, the browser full-reload and virtual-module
		// invalidation still cause the route to be re-imported on the next request.
	}
}

/**
 * Re-runs page-route discovery on the running dev server: invalidates the
 * page-routes and page-loader virtual modules across all environments, signals
 * the Nitro runner to re-import them, then triggers a browser reload. Used for
 * page add and unlink, which Vite's `handleHotUpdate` does not fire for, and
 * for page change.
 */
function refreshPageRoutes(server: ViteDevServer): void {
	invalidateVirtualEverywhere(server, RESOLVED_VIRTUAL_IDS.PAGE_ROUTES);
	invalidateVirtualEverywhere(server, RESOLVED_VIRTUAL_IDS.PAGE_LOADER);
	void reloadNitroPageRoutes(server);
	// Delay the browser reload so the SSR route table can rebuild first.
	setTimeout(() => {
		server.ws.send({ type: "full-reload", path: "*" });
	}, 500);
}

/** Classifies a changed file for HMR handling. */
function classifyHotFile(file: string): {
	isPage: boolean;
	isComponent: boolean;
	isLayout: boolean;
	isCss: boolean;
} {
	const isCss = file.endsWith(".css");
	return {
		isPage: file.includes("/pages/") && !isCss,
		isComponent: file.includes("/components/") && /\.[tj]sx?$/.test(file),
		isLayout: (file.includes("/layouts/") || file.includes("_layout")) && /\.[tj]sx?$/.test(file),
		isCss,
	};
}

/** True when a changed file is a config file that seeds `virtual:avalon/config`. */
function isAvalonConfigFile(file: string): boolean {
	return (
		file.includes("vite.config") || file.includes("avalon.config") || file.includes("nitro.config")
	);
}

// ─── HMR Coordination ───────────────────────────────────────────────────────

function setupHMRCoordination(
	server: ViteDevServer,
	_config: ResolvedAvalonConfig,
	_verbose?: boolean,
	clearScopedMiddlewareRoutes?: () => void,
): void {
	server.watcher.on("change", (file) => {
		if (file.includes("_middleware")) {
			clearMiddlewareCache();
			clearScopedMiddlewareRoutes?.();
		}
		if (file.includes("/render/") || file.includes("/layout/") || file.includes("/islands/")) {
			cachedSSRModule = null;
			cachedLayoutModule = null;
		}

		if (file.includes("/layouts/") || file.includes("_layout")) {
			const resolver = globalThis.__avalonLayoutResolver as { clearCache?: () => void } | undefined;
			resolver?.clearCache?.();
		}
	});

	server.watcher.on("add", (file) => {
		if (file.includes("_middleware")) {
			clearMiddlewareCache();
			clearScopedMiddlewareRoutes?.();
		}
		// `handleHotUpdate` only fires for modules already in the graph, so a
		// newly added page file is not seen there. Re-run route discovery on add.
		if (isPageFile(file)) {
			refreshPageRoutes(server);
		}
	});

	server.watcher.on("unlink", (file) => {
		if (file.includes("_middleware")) {
			clearMiddlewareCache();
			clearScopedMiddlewareRoutes?.();
		}
		// `handleHotUpdate` also does not fire for unlinks. Re-run route
		// discovery so a removed page's route is dropped.
		if (isPageFile(file)) {
			refreshPageRoutes(server);
		}
	});
}

/**
 * True for a file that contributes a page route: any non-CSS file under a
 * `pages` directory. Covers module-based (`app/modules/<name>/pages`) and flat
 * (`src/pages`) layouts, `.mdx`, dynamic `[slug]` / `[...slug]` segments, and
 * special files (`404`, `_error`).
 */
export function isPageFile(file: string): boolean {
	return classifyHotFile(file).isPage;
}

// ─── Virtual Module Generators ───────────────────────────────────────────────

async function generatePageRoutesModule(
	config: ResolvedAvalonConfig,
	_verbose?: boolean,
): Promise<string> {
	try {
		const { getAllPageDirs } = await import("./module-discovery.ts");
		const { discoverPageRoutesFromMultipleDirs } = await import("../nitro/route-discovery.ts");

		// Get all page directories (traditional + modular)
		const pageDirs = await getAllPageDirs(config.pagesDir, config.modules, process.cwd());

		const routes = await discoverPageRoutesFromMultipleDirs(pageDirs, {
			developmentMode: config.isDev,
		});

		const routesJson = JSON.stringify(routes, null, 2);
		return `export const pageRoutes = ${routesJson};\nexport default pageRoutes;\n`;
	} catch {
		return `export const pageRoutes = [];\nexport default pageRoutes;\n`;
	}
}

/**
 * Generates a virtual module that imports all page components and provides
 * a loadPage(pathname) function for production SSR.
 *
 * In development, pages are loaded via Vite's ssrLoadModule. In production,
 * all page modules must be statically imported into the server bundle so
 * they're available at runtime. This module bridges that gap.
 */
async function generatePageLoaderModule(
	config: ResolvedAvalonConfig,
	_verbose?: boolean,
): Promise<string> {
	try {
		const { getAllPageDirs } = await import("./module-discovery.ts");
		const { discoverPageRoutesFromMultipleDirs } = await import("../nitro/route-discovery.ts");
		const { relative } = await import("node:path");

		const cwd = process.cwd();
		const pageDirs = await getAllPageDirs(config.pagesDir, config.modules, cwd);
		const routes = await discoverPageRoutesFromMultipleDirs(pageDirs, {
			developmentMode: config.isDev,
		});

		// Generate import statements for each page
		const imports: string[] = [];
		const routeEntries: string[] = [];

		for (let i = 0; i < routes.length; i++) {
			const route = routes[i];
			const varName = `page_${i}`;
			// Make the absolute filePath relative to the project root, then
			// prefix with '/' so Vite resolves it from the project root.
			const relPath = relative(cwd, route.filePath).replaceAll("\\", "/");
			const importPath = relPath.startsWith("/") ? relPath : `/${relPath}`;
			imports.push(`import * as ${varName} from '${importPath}';`);
			routeEntries.push(
				`  { pattern: ${JSON.stringify(route.pattern)}, params: ${JSON.stringify(route.params)}, module: ${varName} }`,
			);
		}

		return [
			...imports,
			"",
			`const routes = [`,
			routeEntries.join(",\n"),
			`];`,
			"",
			`/**`,
			` * Match a pathname against discovered routes and return the page module.`,
			` * Uses the same pattern matching as Avalon's route discovery.`,
			` */`,
			`/**`,
			` * Match a pathname against discovered routes, returning the matched`,
			` * page module AND the extracted dynamic route params (e.g. { id: "123" }).`,
			` */`,
			`export function loadPage(pathname) {`,
			`  const cleanPath = pathname.split('?')[0];`,
			`  for (const route of routes) {`,
			`    const m = matchRoute(cleanPath, route.pattern);`,
			`    if (m.matched) return { module: route.module, params: m.params };`,
			`  }`,
			`  return null;`,
			`}`,
			"",
			`/**`,
			` * Match one pattern and capture dynamic segments:`,
			` *   /users/:id   vs /users/123        -> { id: "123" }`,
			` *   /blog/**     vs /blog/a/b         -> { slug: "a/b" }`,
			` */`,
			`function matchRoute(pathname, pattern) {`,
			String.raw`  const normPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');`,
			String.raw`  const normPattern = pattern === '/' ? '/' : pattern.replace(/\/$/, '');`,
			`  if (normPath === normPattern) return { matched: true, params: {} };`,
			`  const patternParts = normPattern.split('/');`,
			`  const pathParts = normPath.split('/');`,
			`  const params = {};`,
			`  for (let i = 0; i < patternParts.length; i++) {`,
			`    const seg = patternParts[i];`,
			`    if (seg === '**') {`,
			`      params.slug = pathParts.slice(i).join('/');`,
			`      return { matched: true, params };`,
			`    }`,
			`    if (i >= pathParts.length) return { matched: false, params: {} };`,
			`    if (seg.startsWith(':')) params[seg.slice(1)] = pathParts[i];`,
			`    else if (seg !== pathParts[i]) return { matched: false, params: {} };`,
			`  }`,
			`  if (pathParts.length > patternParts.length) return { matched: false, params: {} };`,
			`  return { matched: true, params };`,
			`}`,
			"",
			`export default { loadPage, routes };`,
			"",
		].join("\n");
	} catch (err) {
		console.error("[page-loader] Failed to generate page loader:", err);
		return `export function loadPage() { return null; }\nexport default { loadPage, routes: [] };\n`;
	}
}

function generateIslandManifestModule(): string {
	return `export const islandManifest = { islands: {}, clientEntry: "", css: [] };\nexport default islandManifest;\n`;
}

function generateRuntimeConfigModule(
	avalonConfig: ResolvedAvalonConfig,
	nitroConfig: AvalonNitroConfig,
): string {
	const runtimeConfig = {
		avalon: {
			streaming: nitroConfig.streaming ?? true,
			pagesDir: avalonConfig.pagesDir,
			layoutsDir: avalonConfig.layoutsDir,
			isDev: avalonConfig.isDev,
		},
		...nitroConfig.runtimeConfig,
	};
	return `export const runtimeConfig = ${JSON.stringify(runtimeConfig, null, 2)};\nexport function useRuntimeConfig() { return runtimeConfig; }\nexport default runtimeConfig;\n`;
}

export function generateConfigModule(
	avalonConfig: ResolvedAvalonConfig,
	nitroConfig: AvalonNitroConfig,
): string {
	const resolvedIsDev = globalThis.__avalonConfig?.isDev ?? avalonConfig.isDev;
	const config = {
		streaming: nitroConfig.streaming ?? true,
		pagesDir: avalonConfig.pagesDir,
		layoutsDir: avalonConfig.layoutsDir,
		isDev: resolvedIsDev,
		...nitroConfig.runtimeConfig,
	};
	// Set hydration mode flag early — this module is imported before island.tsx renders.
	return `globalThis.__avalonHydrationMode = "${resolvedIsDev ? "entry-client" : "per-island"}";\nconst config = ${JSON.stringify(config, null, 2)};\nexport function useAvalonConfig() { return config; }\nexport default config;\n`;
}

// ─── Layout & Asset Virtual Module Generators ────────────────────────────────

/**
 * Generates a virtual module that statically imports all discovered layout
 * components and exports a `wrapWithLayouts(pageHtml, pageModule, context)`
 * function. This eliminates the need for consumers to manually import layouts
 * and build a layout map in their renderer.
 *
 * The generated module:
 * 1. Discovers all layout directories (shared + modular)
 * 2. Generates static imports for each _layout.tsx
 * 3. Builds a prefix→Layout map (like the manual moduleLayouts array)
 * 4. Exports wrapWithLayouts that composes page HTML with the right layouts
 */
async function generateLayoutsModule(
	avalonConfig: ResolvedAvalonConfig,
	_nitroConfig: AvalonNitroConfig,
	devCssLinks: string[],
): Promise<string> {
	const { getAllLayoutDirs } = await import("./module-discovery.ts");
	const { relative, resolve } = await import("node:path");
	const { stat: fsStat, readFile } = await import("node:fs/promises");

	const cwd = process.cwd();
	const layoutDirs = await getAllLayoutDirs(avalonConfig.layoutsDir, avalonConfig.modules, cwd);

	// Discover actual _layout.tsx files
	const layouts: Array<{
		prefix: string;
		importPath: string;
		varName: string;
		isShared: boolean;
		filePath: string;
	}> = [];
	let idx = 0;
	const sharedLayoutsPath = resolve(cwd, avalonConfig.layoutsDir);

	for (const { dir, prefix } of layoutDirs) {
		const layoutFile = join(dir, "_layout.tsx");
		try {
			const s = await fsStat(layoutFile);
			if (!s.isFile()) continue;
		} catch {
			continue;
		}
		const relPath = relative(cwd, layoutFile).replaceAll("\\", "/");
		const importPath = relPath.startsWith("/") ? relPath : `/${relPath}`;
		const isShared = dir.startsWith(sharedLayoutsPath);
		const isRootLayout = isShared && !avalonConfig.modules;
		const varName = isRootLayout ? "RootLayout" : `Layout_${idx}`;
		layouts.push({ prefix, importPath, varName, isShared, filePath: layoutFile });
		idx++;
	}

	// Separate shared (root) layouts from module layouts
	const sharedLayouts = layouts.filter((l) => l.isShared);
	const moduleLayouts = layouts.filter((l) => !l.isShared);

	// Detect whether each module layout declared `skipLayouts: ['_layout']`.
	// We parse the source file with a simple regex — this is reliable because
	// the layoutConfig is a static top-level export. Doing this at generation
	// time bakes the decision into the emitted module as a boolean literal.
	const skipRootByPath = new Map<string, boolean>();
	for (const l of moduleLayouts) {
		try {
			const src = await readFile(l.filePath, "utf8");
			// Look for: skipLayouts: [... '_layout' ...] or ["_layout"]
			const configMatch = src.match(/layoutConfig\s*=\s*{[\s\S]*?skipLayouts\s*:\s*\[([^\]]*)\]/);
			const skips = configMatch?.[1] ?? "";
			const hasRootSkip = /['"`]_layout['"`]/.test(skips);
			skipRootByPath.set(l.importPath, hasRootSkip);
		} catch {
			skipRootByPath.set(l.importPath, false);
		}
	}

	// Generate imports — just the default components. `skipRoot` is resolved
	// at generation time from the source file.
	const imports = layouts.map((l) => `import ${l.varName} from '${l.importPath}';`);

	const entries = moduleLayouts
		.toSorted((a, b) => b.prefix.length - a.prefix.length)
		.map((l) => {
			// skipRoot is true if the layout's prefix matches the root ('/')
			// OR if the layout itself declared skipLayouts: ['_layout'].
			const pathBased = l.prefix === "/";
			const declaredSkip = skipRootByPath.get(l.importPath) ?? false;
			const skipRoot = pathBased || declaredSkip;
			return `  { prefix: ${JSON.stringify(l.prefix)}, Layout: ${l.varName}, skipRoot: ${skipRoot} }`;
		});

	const rootLayoutVar = sharedLayouts.length > 0 ? sharedLayouts[0].varName : "null";

	// CSS paths are pre-discovered synchronously at plugin creation time
	// to keep the virtual module load hook fast (avoids Nitro 503 timeout).
	const cssLinksJson = JSON.stringify(devCssLinks);

	// The shell engine (Preact by default, React when core: "react") determines
	// how layout components are created and rendered to HTML.
	const engineImports = layoutEngineImportLines(avalonConfig.core);

	const code = [
		`// Auto-generated by Avalon — do not edit`,
		...engineImports,
		`import { getUniversalCSSForHead } from '@useavalon/avalon/islands/universal-css-collector';`,
		`import { getUniversalHeadForInjection, injectSolidHydrationScriptIfNeeded } from '@useavalon/avalon/islands/universal-head-collector';`,
		...imports,
		``,
		`const RootLayoutComponent = ${rootLayoutVar};`,
		`const _cssLinks = ${cssLinksJson};`,
		``,
		`const moduleLayouts = [`,
		entries.join(",\n"),
		`];`,
		``,
		`function getLayoutsForPath(pathname) {`,
		`  for (const entry of moduleLayouts) {`,
		`    if (entry.prefix === '/' ? pathname === '/' : pathname.startsWith(entry.prefix)) {`,
		`      return entry;`,
		`    }`,
		`  }`,
		`  return null;`,
		`}`,
		``,
		`function injectUniversalAssets(html) {`,
		`  // In dev, inject <link> tags for all discovered CSS files.`,
		`  // The ?direct suffix makes Vite return raw CSS (text/css) instead`,
		`  // of a JS module wrapper, so <link rel="stylesheet"> works.`,
		`  if (process.env.NODE_ENV !== 'production' && _cssLinks.length > 0) {`,
		`    var links = _cssLinks.map(function(href) {`,
		`      return '<link rel="stylesheet" href="' + href + '?direct">';`,
		String.raw`    }).join('\n');`,
		`    if (html.includes('</head>')) {`,
		String.raw`      html = html.replace('</head>', links + '\n</head>');`,
		`    }`,
		`  }`,
		`  const universalCSS = getUniversalCSSForHead(true);`,
		`  if (universalCSS && html.includes('</head>')) {`,
		String.raw`    html = html.replace('</head>', universalCSS + '\n</head>');`,
		`  }`,
		`  const universalHead = getUniversalHeadForInjection(true);`,
		`  if (universalHead && html.includes('</head>')) {`,
		String.raw`    html = html.replace('</head>', universalHead + '\n</head>');`,
		`  }`,
		`  html = injectSolidHydrationScriptIfNeeded(html);`,
		`  return html;`,
		`}`,
		``,
		`export async function wrapWithLayouts(pageHtml, pageModule, context, injectAssets) {`,
		`  const pathname = context.url.pathname;`,
		`  const frontmatter = {`,
		`    ...(pageModule.frontmatter || {}),`,
		`    ...(pageModule.metadata || {}),`,
		`    currentPath: pathname,`,
		`  };`,
		`  const pageLayoutConfig = pageModule.layoutConfig;`,
		`  const skipAll = pageLayoutConfig?.skipLayouts?.includes('_layout');`,
		``,
		`  const layoutEntry = getLayoutsForPath(pathname);`,
		`  const routeInfo = { path: pathname, params: context.params, query: context.url.searchParams };`,
		`  let html;`,
		``,
		`  if (!layoutEntry || skipAll) {`,
		`    if (RootLayoutComponent && !skipAll) {`,
		`      const rootProps = {`,
		`        children: h('avalon-page', { id: 'app', dangerouslySetInnerHTML: { __html: pageHtml } }),`,
		`        frontmatter,`,
		`        data: {},`,
		`        route: routeInfo,`,
		`      };`,
		`      const rootResult = RootLayoutComponent(rootProps);`,
		`      const resolvedRoot = rootResult instanceof Promise ? await rootResult : rootResult;`,
		String.raw`      html = '<!DOCTYPE html>\n' + preactRenderToString(resolvedRoot);`,
		`    } else {`,
		`      // skipAll is true — page provides its own HTML shell or needs a minimal one`,
		`      if (pageHtml.trimStart().startsWith('<html')) {`,
		String.raw`        html = '<!DOCTYPE html>\n' + pageHtml;`,
		`      } else {`,
		`        const title = String(frontmatter.title || 'Avalon');`,
		`        html = [`,
		`          '<!DOCTYPE html>',`,
		`          '<html lang="en">',`,
		`          '<head>',`,
		`          '<meta charset="utf-8">',`,
		`          '<meta name="viewport" content="width=device-width, initial-scale=1">',`,
		`          '<title>' + title + '</title>',`,
		`          '</head>',`,
		`          '<body>',`,
		`          '<div id="app">' + pageHtml + '</div>',`,
		`          '</body>',`,
		`          '</html>',`,
		String.raw`        ].join('\n');`,
		`      }`,
		`    }`,
		`  } else {`,
		`    const layoutProps = {`,
		`      children: h('avalon-page', { dangerouslySetInnerHTML: { __html: pageHtml } }),`,
		`      frontmatter,`,
		`      data: {},`,
		`      route: routeInfo,`,
		`    };`,
		`    const layoutResult = layoutEntry.Layout(layoutProps);`,
		`    const resolvedLayout = layoutResult instanceof Promise ? await layoutResult : layoutResult;`,
		`    let wrappedHtml = preactRenderToString(resolvedLayout);`,
		``,
		`    // If the layout provides its own HTML shell (starts with <html),`,
		`    // skip root wrapping regardless of skipRoot flag — the layout IS the document.`,
		`    const layoutProvidesShell = wrappedHtml.trimStart().startsWith('<html');`,
		``,
		`    if (!layoutProvidesShell && !layoutEntry.skipRoot && RootLayoutComponent) {`,
		`      const rootProps = {`,
		`        children: h('avalon-page', { dangerouslySetInnerHTML: { __html: wrappedHtml } }),`,
		`        frontmatter,`,
		`        data: {},`,
		`        route: routeInfo,`,
		`      };`,
		`      const rootResult = RootLayoutComponent(rootProps);`,
		`      const resolvedRoot = rootResult instanceof Promise ? await rootResult : rootResult;`,
		`      wrappedHtml = preactRenderToString(resolvedRoot);`,
		`    }`,
		``,
		String.raw`    html = '<!DOCTYPE html>\n' + wrappedHtml;`,
		`  }`,
		``,
		`  if (injectAssets) {`,
		`    html = injectAssets(html);`,
		`  }`,
		`  return injectUniversalAssets(html);`,
		`}`,
		``,
		`export default { wrapWithLayouts };`,
		``,
	].join("\n");

	return code;
}

/**
 * Generates a virtual module that provides asset injection helpers.
 * Imports client assets via the ?assets=client virtual import and exports
 * an `injectAssets(html)` function that adds CSS links, JS preloads, and
 * the entry script to the HTML.
 *
 * The ?assets=client suffix is resolved by Nitro's Vite assets plugin
 * which reads the client build manifest and provides CSS/JS metadata.
 */
function generateAssetsModule(nitroConfig: AvalonNitroConfig): string {
	const clientEntry = nitroConfig.clientEntry ?? "app/entry-client";
	const importPath = clientEntry.startsWith("/") ? clientEntry : `/${clientEntry}`;
	return [
		`// Auto-generated by Avalon — do not edit`,
		`// @ts-ignore — virtual import resolved by Nitro's Vite assets plugin at build time`,
		`import clientAssets from '${importPath}?assets=client';`,
		``,
		`function buildAssetTags() {`,
		`  const cssLinks = (clientAssets?.css ?? [])`,
		`    .filter(attr => {`,
		`      const href = attr.href || '';`,
		`      // The SSR build produces ssr-index-*.css containing all global, reset,`,
		`      // token, and layout CSS module styles. The client build may also emit`,
		`      // entry-client-*.css (a subset) and index-*.css. To avoid duplicates,`,
		`      // prefer ssr-index when it exists; otherwise fall back to the others.`,
		`      var hasSsrIndex = (clientAssets?.css ?? []).some(function(a) { return (a.href || '').includes('ssr-index'); });`,
		`      if (hasSsrIndex) return href.includes('ssr-index');`,
		`      if (href.includes('entry-client') && href.endsWith('.css')) return true;`,
		String.raw`      if (/\/index-[^/]+\.css$/.test(href)) return true;`,
		`      return false;`,
		`    })`,
		`    .map(attr => '<link rel="stylesheet" href="' + attr.href + '">')`,
		String.raw`    .join('\n');`,
		`  const jsPreloads = (clientAssets?.js ?? [])`,
		`    .map(attr => '<link rel="modulepreload" href="' + attr.href + '">')`,
		String.raw`    .join('\n');`,
		`  const entryScript = clientAssets?.entry`,
		`    ? '<script type="module" src="' + clientAssets.entry + '"></script>'`,
		`    : '';`,
		`  return { cssLinks, jsPreloads, entryScript };`,
		`}`,
		``,
		`export function injectAssets(html) {`,
		`  const { cssLinks, jsPreloads, entryScript } = buildAssetTags();`,
		`  if (html.includes('</head>')) {`,
		String.raw`    html = html.replace('</head>', cssLinks + '\n' + jsPreloads + '\n</head>');`,
		`  }`,
		`  if (html.includes('</body>')) {`,
		String.raw`    html = html.replace('</body>', entryScript + '\n</body>');`,
		`  }`,
		`  return html;`,
		`}`,
		``,
		`export { clientAssets };`,
		`export default { injectAssets, clientAssets };`,
		``,
	].join("\n");
}

/**
 * Generates the `virtual:avalon/renderer` module.
 *
 * Wires together:
 * - virtual:avalon/config (runtime config)
 * - virtual:avalon/page-loader (page module resolution)
 * - virtual:avalon/layouts (layout wrapping)
 * - virtual:avalon/assets (client asset injection)
 * - createNitroRenderer (SSR request handler)
 * - registerBuiltinDirectives (custom hydration directives)
 *
 * Consumer usage: `export { default } from 'virtual:avalon/renderer';`
 */
function generateRendererModule(avalonConfig: ResolvedAvalonConfig): string {
	// Statically import and pre-register integrations so the SSR bundle
	// can render islands without relying on dynamic imports (which fail
	// in the bundled Nitro environment).
	const integrations: string[] = Array.isArray(avalonConfig.integrations)
		? avalonConfig.integrations
		: [];

	const integrationImports: string[] = [];
	const registrationLines: string[] = [];

	for (const fw of integrations) {
		const varName = `${fw}Integration`;
		// Each integration's mod.ts exports a named <fw>Integration object
		integrationImports.push(`import { ${varName} } from '@useavalon/${fw}';`);
		registrationLines.push(`registry.register(${varName});`);
	}

	// When core: "react", override the shell renderer with react-dom/server so
	// pages/layouts render on real React. Injected here (in the app SSR bundle,
	// which has React) so the core package never hard-depends on React.
	const shellEngineLines = reactShellSetupLines(avalonConfig.core);

	return [
		`// Auto-generated by Avalon — do not edit`,
		`import { createNitroRenderer } from '@useavalon/avalon/nitro/renderer';`,
		`import { registerBuiltinDirectives } from '@useavalon/avalon';`,
		`import { registry } from '@useavalon/avalon/islands/integration-registry';`,
		`import avalonConfig from 'virtual:avalon/config';`,
		`import { loadPage } from 'virtual:avalon/page-loader';`,
		`import { wrapWithLayouts } from 'virtual:avalon/layouts';`,
		`import { injectAssets } from 'virtual:avalon/assets';`,
		...integrationImports,
		``,
		...shellEngineLines,
		``,
		`// Pre-register framework integrations for SSR`,
		...registrationLines,
		``,
		`// Register built-in custom hydration directives (on:delay, on:scroll, etc.)`,
		`registerBuiltinDirectives();`,
		``,
		`// Set hydration mode flag — intentionally duplicated from virtual:avalon/config`,
		`// for module-load-order resilience (config import may be tree-shaken or deferred).`,
		`globalThis.__avalonHydrationMode = avalonConfig.isDev ? "entry-client" : "per-island";`,
		``,
		`export default createNitroRenderer({`,
		`  avalonConfig,`,
		`  isDev: avalonConfig.isDev,`,
		`  resolvePageRoute: async (pathname) => {`,
		`    const match = loadPage(pathname);`,
		`    if (!match || !('default' in match.module)) return null;`,
		`    return { filePath: '[virtual:' + pathname + ']', pattern: pathname, params: match.params };`,
		`  },`,
		`  loadPageModule: async (filePath) => {`,
		String.raw`    const m = filePath.match(/^\[virtual:(.+)\]$/);`,
		`    const pathname = m ? m[1] : filePath;`,
		`    const match = loadPage(pathname);`,
		`    if (match) return match.module;`,
		`    return { default: () => null, metadata: { title: 'Avalon' } };`,
		`  },`,
		`  wrapWithLayouts: (pageHtml, pageModule, context) =>`,
		`    wrapWithLayouts(pageHtml, pageModule, context, injectAssets),`,
		`});`,
		``,
	].join("\n");
}

// ─── Public Accessors ────────────────────────────────────────────────────────

/**
 * Generate the virtual:avalon/client-entry module.
 *
 * Auto-discovers CSS files in layout directories and includes the
 * hydration runtime + any global CSS specified in config. This means
 * consumers don't need to manually maintain a client entry file.
 */
/** Collects `.css` files across the given layout directories as `/`-rooted import paths. */
async function discoverLayoutCssImports(
	layoutDirs: readonly { dir: string }[],
	cwd: string,
): Promise<string[]> {
	const { readdir } = await import("node:fs/promises");
	const { relative, join: pathJoin } = await import("node:path");
	const cssImports: string[] = [];
	for (const { dir } of layoutDirs) {
		let entries: Dirent[];
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			// Directory doesn't exist or can't be read — skip
			continue;
		}
		for (const entry of entries) {
			if (!entry.isFile() || !entry.name.endsWith(".css")) continue;
			const absPath = pathJoin(dir, entry.name);
			const relPath = relative(cwd, absPath).replaceAll("\\", "/");
			cssImports.push(relPath.startsWith("/") ? relPath : `/${relPath}`);
		}
	}
	return cssImports;
}

/**
 * Builds the layout-CSS import lines for the client entry module. CSS modules
 * (`.module.css`) use a default import so Vite associates the extracted CSS with
 * this entry chunk; a bare side-effect import would be code-split into an
 * orphaned chunk that nothing references, so the styles never reach the page.
 */
function layoutCssImportLines(cssImports: string[]): string[] {
	if (cssImports.length === 0) return [];
	const out: string[] = [`// Layout CSS (auto-discovered)`];
	let cssModIdx = 0;
	for (const imp of cssImports) {
		if (imp.includes(".module.")) {
			out.push(`import _lcss${cssModIdx} from '${imp}';`);
			cssModIdx++;
		} else {
			out.push(`import '${imp}';`);
		}
	}
	return out;
}

async function generateClientEntryModule(
	avalonConfig: ResolvedAvalonConfig,
	nitroConfig: AvalonNitroConfig,
): Promise<string> {
	const { getAllLayoutDirs } = await import("./module-discovery.ts");

	const cwd = process.cwd();

	// Discover all CSS files in layout directories
	const layoutDirs = await getAllLayoutDirs(avalonConfig.layoutsDir, avalonConfig.modules, cwd);
	const cssImports = await discoverLayoutCssImports(layoutDirs, cwd);

	// Build the module source
	// Use the full runtime in dev (HMR support) and slim in production.
	// We check globalThis.__avalonConfig which is updated in configResolved
	// with the correct isDev value, unlike the captured avalonConfig which
	// may still have isDev=true from the pre-resolved config.
	const resolvedIsDev = globalThis.__avalonConfig?.isDev ?? avalonConfig.isDev;
	const hydrationRuntime = resolvedIsDev
		? `@useavalon/avalon/client/main`
		: `@useavalon/avalon/client/main-slim`;

	const lines: string[] = [
		`// Auto-generated by Avalon — do not edit`,
		`// Island hydration runtime`,
	];

	// Hydration mode is automatic: dev uses entry-client (HMR), prod uses per-island.
	// Check the runtime global set by configResolved.
	const hydrationMode = globalThis.__avalonHydrationMode ?? "entry-client";
	if (hydrationMode === "entry-client") {
		lines.push(`import '${hydrationRuntime}';`);
	} else {
		lines.push(`// Per-island hydration mode — no shared runtime needed`);
	}
	lines.push(``);

	// Global CSS from config
	const globalCSS = nitroConfig.globalCSS ?? [];
	for (const cssPath of globalCSS) {
		const importPath = cssPath.startsWith("/") ? cssPath : `/${cssPath}`;
		lines.push(`// Global CSS`, `import '${importPath}';`);
	}

	if (globalCSS.length > 0) lines.push(``);

	lines.push(...layoutCssImportLines(cssImports), ``);
	return lines.join("\n");
}

/**
 * Generate the integration loader virtual module.
 *
 * Only includes dynamic import() calls for frameworks that are actually
 * configured in the avalon() config. This prevents Vite from trying to
 * resolve @useavalon/vue/client, @useavalon/svelte/client, etc. when
 * only preact is configured.
 */
/** Lines for the production-inlined Solid client adapter. */
function solidInlineAdapterLines(): string[] {
	return [
		`// --- Inlined Solid adapter (production) ---`,
		`// Eliminates a separate chunk + network request for the Solid client adapter.`,
		`// Only imports hydrate/createComponent — no render() fallback (saves ~1-2 KiB).`,
		`function _ensureHydrationContext() {`,
		`  if (!globalThis._$HY) {`,
		`    globalThis._$HY = { events: [], completed: new WeakSet(), r: {}, fe() {} };`,
		`  }`,
		`}`,
		``,
		`async function _solidHydrate(container, Component, props) {`,
		`  if (!container) throw new Error("Container element is required for hydration");`,
		`  if (!Component || typeof Component !== "function") {`,
		`    throw new Error("Invalid Solid component: expected function, got " + typeof Component);`,
		`  }`,
		`  var el = container;`,
		`  var renderId = el.dataset.solidRenderId || el.dataset.renderId;`,
		`  var { hydrate: solidHydrate, createComponent } = await import("solid-js/web");`,
		`  _ensureHydrationContext();`,
		`  solidHydrate(function() { return createComponent(Component, props || {}); }, el, { renderId: renderId || "" });`,
		`}`,
		``,
		`var _solidModule = { hydrate: _solidHydrate };`,
		``,
	];
}

/** Builds the `switch` cases for `loadIntegrationModule`. */
function loadIntegrationCases(
	frameworkNames: string[],
	frameworkImports: Record<string, string>,
	isDev: boolean,
): string[] {
	const out: string[] = [];
	for (const fw of frameworkNames) {
		const importPath = frameworkImports[fw];
		if (!importPath) continue;
		if (fw === "solid" && !isDev) {
			// Production: return the inlined Solid adapter (no dynamic import)
			out.push(`    case "solid":`, `      return _solidModule;`);
		} else if (fw === "react") {
			out.push(`    case "react":`);
		} else {
			out.push(`    case "${fw}":`, `      return import("${importPath}");`);
		}
	}
	if (frameworkNames.includes("react") && !frameworkNames.includes("preact")) {
		out.push(`      return import("${frameworkImports.react}");`);
	}
	return out;
}

/** Builds the `switch` cases for `loadHMRAdapter`. */
function loadHMRCases(frameworkNames: string[], hmrImports: Record<string, string>): string[] {
	const out: string[] = [];
	for (const fw of frameworkNames) {
		const hmrPath = hmrImports[fw];
		if (!hmrPath) continue;
		out.push(`    case "${fw}":`, `      return import("${hmrPath}").then(m => m.${fw}Adapter);`);
	}
	return out;
}

export function generateIntegrationLoaderModule(avalonConfig: ResolvedAvalonConfig): string {
	const integrations = avalonConfig.integrations ?? [];
	const frameworkNames = integrations.map((i: string | { name: string }) =>
		typeof i === "string" ? i : i.name,
	);

	const frameworkImports: Record<string, string> = {
		preact: "@useavalon/preact/client",
		react: reactClientModule(avalonConfig.core),
		vue: "@useavalon/vue/client",
		svelte: "@useavalon/svelte/client",
		solid: "@useavalon/solid/client",
		lit: "@useavalon/lit/client",
		qwik: "@useavalon/qwik/client",
	};

	const hmrImports: Record<string, string> = {
		preact: "@useavalon/preact/client/hmr",
		react: "@useavalon/react/client/hmr",
		vue: "@useavalon/vue/client/hmr",
		svelte: "@useavalon/svelte/client/hmr",
		solid: "@useavalon/solid/client/hmr",
		lit: "@useavalon/lit/client/hmr",
		qwik: "@useavalon/qwik/client/hmr",
	};

	const hasLit = frameworkNames.includes("lit");
	const hasSolid = frameworkNames.includes("solid");
	const isDev = (globalThis.__avalonConfig?.isDev ?? avalonConfig.isDev) === true;

	const lines: string[] = [
		`// Auto-generated by Avalon — only includes configured integrations`,
		``,
	];

	// In production, inline the Solid adapter directly to save one network request.
	// The inlined version only imports hydrate + createComponent from solid-js/web
	// (no render() fallback), which avoids pulling in the extra DOM runtime code.
	if (hasSolid && !isDev) {
		lines.push(...solidInlineAdapterLines());
	}

	lines.push(
		`// --- loadIntegrationModule ---`,
		`export async function loadIntegrationModule(framework) {`,
		`  switch (framework) {`,
		...loadIntegrationCases(frameworkNames, frameworkImports, isDev),
		`    default:`,
		`      throw new Error(\`Unknown or unconfigured framework: \${framework}\`);`,
		`  }`,
		`}`,
		``,
		`// --- Lit hydration pre-load (only if Lit is configured) ---`,
	);

	// --- preLitHydration: only emitted if Lit is configured ---
	if (hasLit) {
		lines.push(
			`export async function preLitHydration() {`,
			`  await import("@useavalon/lit/client");`,
			`}`,
		);
	} else {
		lines.push(`export async function preLitHydration() {}`);
	}

	// --- loadHMRAdapter: only emitted for configured frameworks ---
	lines.push(
		``,
		`// --- HMR adapter loader ---`,
		`export async function loadHMRAdapter(framework) {`,
		`  switch (framework) {`,
		...loadHMRCases(frameworkNames, hmrImports),
		`    default: return null;`,
		`  }`,
		`}`,
	);

	return lines.join("\n");
}

export function getViteDevServer(): ViteDevServer | undefined {
	return globalThis.__viteDevServer;
}

export function getAvalonConfig(): ResolvedAvalonConfig | undefined {
	return globalThis.__avalonConfig;
}

export function isDevelopmentMode(): boolean {
	return globalThis.__avalonConfig?.isDev ?? true;
}

// ─── SSR Request Handling ────────────────────────────────────────────────────

const STREAM_MARKER = "<!--AVALON_STREAM_BOUNDARY-->";

let cachedSSRModule: unknown = null;

let cachedLayoutModule: unknown = null;

/**
 * Streaming SSR handler — flushes the layout shell to the browser before
 * the page component's async data fetching resolves.
 *
 * Flow:
 * 1. Load page module + layout modules, collect CSS
 * 2. Render shell layout with a marker placeholder as children
 * 3. Split HTML on the marker → shellBefore / shellAfter
 * 4. res.write(shellBefore) — browser starts parsing <html><head>... immediately
 * 5. Render page content (awaits data fetches)
 * 6. Render wrapper layouts around page content
 * 7. res.write(wrappedContent + shellAfter)
 * 8. res.end()
 *
 * Falls back to null (caller uses buffered path) when:
 * - No modular layouts configured
 * - Page not found
 * - No shell layout detected
 * - Page provides its own complete HTML document
 */
/**
 * Load the dev-mode shell renderer for the configured engine. Returns a
 * createElement/`h` factory and a `renderToString` function from either Preact
 * (default) or real React (`core: "react"`), loaded via Vite's SSR module graph.
 */
async function loadDevShellEngine(
	server: ViteDevServer,
	core: ResolvedAvalonConfig["core"],
): Promise<{
	h: (...args: unknown[]) => unknown;
	renderToString: (vnode: unknown) => string;
}> {
	type CreateElement = (...args: unknown[]) => unknown;
	type RenderToString = (vnode: unknown) => string;

	if (core === "react") {
		// Use native dynamic import (not ssrLoadModule): React ships CJS, and
		// Node's ESM interop resolves it cleanly, whereas Vite's SSR module runner
		// chokes on React's `module.exports` entry in dev.
		const react = (await import("react")) as Record<string, unknown> & { default?: unknown };
		const reactDomServer = (await import("react-dom/server")) as Record<string, unknown> & {
			default?: unknown;
		};
		const reactDefault = (react.default ?? react) as Record<string, unknown>;
		const rdsDefault = (reactDomServer.default ?? reactDomServer) as Record<string, unknown>;
		return {
			h: (react.createElement ?? reactDefault.createElement) as CreateElement,
			renderToString: (reactDomServer.renderToString ??
				rdsDefault.renderToString) as RenderToString,
		};
	}
	const preact = await server.ssrLoadModule("preact");
	const rts = await server.ssrLoadModule("preact-render-to-string");
	return {
		h: preact.h as CreateElement,
		renderToString: (rts.render ?? rts.default) as RenderToString,
	};
}

/** Runtime hyperscript factory from the active shell engine (dev). */
type ShellHyperscript = (type: unknown, props: unknown, ...children: unknown[]) => unknown;
/** Runtime render-to-string from the active shell engine (dev). */
type ShellRenderFn = (vnode: unknown) => string;
/** A discovered layout with its loaded module. */
type DevLayoutEntry = { file: string; module: Record<string, unknown> };

/** The base name of a layout file, without directory or extension. */
function getLayoutBaseName(file: string): string {
	return (
		file
			.split("/")
			.pop()
			?.replace(/\.[^.]+$/, "") || ""
	);
}

/**
 * Loads all layout modules and appends their CSS (from Vite's module graph)
 * into `cssContents`. Modules are loaded first so their CSS enters the graph
 * before collection.
 */
async function loadDevLayoutModulesWithCss(
	server: ViteDevServer,
	layoutFiles: string[],
	cssContents: string[],
): Promise<DevLayoutEntry[]> {
	const layoutModules: DevLayoutEntry[] = [];
	for (const layoutFile of layoutFiles) {
		const layoutModule = await server.ssrLoadModule(layoutFile);
		layoutModules.push({ file: layoutFile, module: layoutModule });
	}
	for (const layoutFile of layoutFiles) {
		const layoutCss = await collectCssFromModuleGraph(server, layoutFile);
		cssContents.push(...layoutCss);
	}
	return layoutModules;
}

/**
 * Splits layouts into shell layouts (render a full `<html>`/`<!DOCTYPE>`
 * document) and wrapper layouts (render a fragment) by test-rendering each.
 */
async function categorizeShellWrapperLayouts(
	activeLayouts: DevLayoutEntry[],
	layoutProps: Record<string, unknown>,
	h: ShellHyperscript,
	preactRender: ShellRenderFn,
): Promise<{ shellLayouts: DevLayoutEntry[]; wrapperLayouts: DevLayoutEntry[] }> {
	const shellLayouts: DevLayoutEntry[] = [];
	const wrapperLayouts: DevLayoutEntry[] = [];
	for (const layout of activeLayouts) {
		const LayoutComponent = layout.module.default;
		if (!LayoutComponent || typeof LayoutComponent !== "function") continue;
		try {
			const testProps = { ...layoutProps, children: h("div", null, "test") };
			const testResult = (LayoutComponent as (props: unknown) => unknown)(testProps);
			const resolvedTest = testResult instanceof Promise ? await testResult : testResult;
			const testHtml = preactRender(resolvedTest);
			if (testHtml.trim().startsWith("<html") || testHtml.includes("<!DOCTYPE")) {
				shellLayouts.push(layout);
			} else {
				wrapperLayouts.push(layout);
			}
		} catch {
			wrapperLayouts.push(layout);
		}
	}
	return { shellLayouts, wrapperLayouts };
}

/** Renders the shell layout with the stream marker as children. Returns null on failure. */
async function renderStreamingShell(
	ShellComponent: (props: unknown) => unknown,
	layoutProps: Record<string, unknown>,
	h: ShellHyperscript,
	preactRender: ShellRenderFn,
): Promise<string | null> {
	try {
		const shellProps = {
			...layoutProps,
			children: h("div", { dangerouslySetInnerHTML: { __html: STREAM_MARKER } }),
		};
		const shellResult = ShellComponent(shellProps);
		const resolvedShell = shellResult instanceof Promise ? await shellResult : shellResult;
		return preactRender(resolvedShell);
	} catch {
		return null;
	}
}

/** Injects CSS, DOCTYPE, and universal head content into the shell's leading HTML. */
function buildStreamingShellHead(shellBefore: string, cssContents: string[]): string {
	let shellHead = shellBefore;
	if (cssContents.length > 0) {
		const cssTag = `<style data-avalon-ssr-css>${cssContents.join("\n")}</style>`;
		if (shellHead.includes("</head>")) {
			shellHead = shellHead.replace("</head>", `${cssTag}\n</head>`);
		} else {
			shellHead = shellHead + cssTag;
		}
	}
	if (!shellHead.trim().toLowerCase().startsWith("<!doctype")) {
		shellHead = `<!DOCTYPE html>\n${shellHead}`;
	}
	const universalCSS = getUniversalCSSForHead(true);
	if (universalCSS && shellHead.includes("</head>")) {
		shellHead = shellHead.replace("</head>", `${universalCSS}\n</head>`);
	}
	const universalHead = getUniversalHeadForInjection(true);
	if (universalHead && shellHead.includes("</head>")) {
		shellHead = shellHead.replace("</head>", `${universalHead}\n</head>`);
	}
	return injectSolidHydrationScriptIfNeeded(shellHead);
}

/** Renders the page component to HTML, returning a fallback string on error. */
async function renderPageComponentToHtml(
	PageComponent: unknown,
	preactRender: ShellRenderFn,
	logLabel: string,
): Promise<string> {
	try {
		const pageResult =
			typeof PageComponent === "function" ? (PageComponent as () => unknown)() : PageComponent;
		const resolvedPage = pageResult instanceof Promise ? await pageResult : pageResult;
		return preactRender(resolvedPage);
	} catch (error) {
		console.error(`${logLabel} Error rendering page component:`, error);
		return `<div>Error rendering page</div>`;
	}
}

/** Wraps page content in each wrapper layout, innermost first. */
async function applyWrapperLayouts(
	pageContent: string,
	wrapperLayouts: DevLayoutEntry[],
	layoutProps: Record<string, unknown>,
	h: ShellHyperscript,
	preactRender: ShellRenderFn,
	logLabel: string,
): Promise<string> {
	let content = pageContent;
	for (const { module: layoutModule } of wrapperLayouts) {
		const LayoutComponent = layoutModule.default;
		if (!LayoutComponent || typeof LayoutComponent !== "function") continue;
		try {
			const props = {
				...layoutProps,
				children: h("div", { dangerouslySetInnerHTML: { __html: content } }),
			};
			const layoutResult = (LayoutComponent as (props: unknown) => unknown)(props);
			const resolvedLayout = layoutResult instanceof Promise ? await layoutResult : layoutResult;
			content = preactRender(resolvedLayout);
		} catch (error) {
			console.error(`${logLabel} Error rendering wrapper layout:`, error);
		}
	}
	return content;
}

/**
 * Applies the last shell layout (module-specific takes precedence over shared)
 * around `content`. Returns `content` unchanged if there is no usable shell.
 */
async function applyShellLayout(
	content: string,
	shellLayouts: DevLayoutEntry[],
	layoutProps: Record<string, unknown>,
	h: ShellHyperscript,
	preactRender: ShellRenderFn,
): Promise<string> {
	if (shellLayouts.length === 0) return content;
	const { module: shellModule } = shellLayouts.at(-1)!;
	const ShellComponent = shellModule.default;
	if (!ShellComponent || typeof ShellComponent !== "function") return content;
	try {
		const props = {
			...layoutProps,
			children: h("div", { dangerouslySetInnerHTML: { __html: content } }),
		};
		const shellResult = (ShellComponent as (props: unknown) => unknown)(props);
		const resolvedShell = shellResult instanceof Promise ? await shellResult : shellResult;
		return preactRender(resolvedShell);
	} catch (error) {
		console.error("[SSR] Error rendering shell layout:", error);
		return content;
	}
}

/** Injects the dev client scripts before `</body>` if not already present. */
function injectStreamingClientScripts(tail: string): string {
	if (tail.includes("/src/client/main.js") || tail.includes("/@vite/client")) return tail;
	const bodyCloseIndex = tail.lastIndexOf("</body>");
	if (bodyCloseIndex === -1) return tail;
	return (
		tail.slice(0, bodyCloseIndex) +
		'\n<script type="module" src="/@vite/client"></script>\n' +
		'<script type="module" src="/src/client/main.js"></script>\n' +
		tail.slice(bodyCloseIndex)
	);
}

async function handleStreamingSSRRequest(
	server: ViteDevServer,
	url: string,
	config: ResolvedAvalonConfig,
	res: ServerResponse,
): Promise<boolean> {
	// Streaming only works with modular layouts (need shell + wrapper separation)
	if (!config.modules) return false;

	const pathname = url.split("?")[0];
	const pageFile = await findPageFile(pathname, config, server);
	if (!pageFile) return false;

	try {
		const pageModule = await server.ssrLoadModule(pageFile);
		const PageComponent = pageModule.default;
		if (!PageComponent) return false;

		// Check if page wants to skip layouts entirely (provides own HTML)
		const layoutConfig = pageModule.layoutConfig as { skipLayouts?: string[] } | undefined;

		// Collect CSS
		const cssContents = await collectCssFromModuleGraph(server, pageFile);
		const layoutFiles = await discoverLayoutFiles(pathname, server);
		const layoutModules = await loadDevLayoutModulesWithCss(server, layoutFiles, cssContents);

		if (layoutModules.length === 0) return false;

		const { h, renderToString: preactRender } = await loadDevShellEngine(server, config.core);

		const skipLayouts = layoutConfig?.skipLayouts || [];
		const activeLayouts = layoutModules.filter(
			({ file }) => !skipLayouts.includes(getLayoutBaseName(file)),
		);

		const frontmatter = pageModule.frontmatter as Record<string, unknown> | undefined;
		const metadata = pageModule.metadata as Record<string, unknown> | undefined;
		const mergedFrontmatter = { ...frontmatter, ...metadata, currentPath: pathname };
		const layoutProps = {
			children: null as unknown,
			frontmatter: mergedFrontmatter,
			params: {},
			url: pathname,
		};

		// Categorize layouts into shell vs wrapper
		const { shellLayouts, wrapperLayouts } = await categorizeShellWrapperLayouts(
			activeLayouts,
			layoutProps,
			h,
			preactRender,
		);

		// Need a shell layout to stream
		if (shellLayouts.length === 0) return false;

		// Render shell layout with stream marker as children
		const { module: shellModule } = shellLayouts.at(-1)!;
		const ShellComponent = shellModule.default;
		if (!ShellComponent || typeof ShellComponent !== "function") return false;

		const shellHtml = await renderStreamingShell(
			ShellComponent as (props: unknown) => unknown,
			layoutProps,
			h,
			preactRender,
		);
		if (shellHtml === null) return false;

		// Split on marker
		const markerIndex = shellHtml.indexOf(STREAM_MARKER);
		if (markerIndex === -1) return false;

		const shellBefore = shellHtml.slice(0, markerIndex);
		const shellAfter = shellHtml.slice(markerIndex + STREAM_MARKER.length);

		const shellBeforeWithCss = buildStreamingShellHead(shellBefore, cssContents);

		// ── FLUSH SHELL ──
		res.statusCode = 200;
		res.setHeader("Content-Type", "text/html; charset=utf-8");
		res.setHeader("Transfer-Encoding", "chunked");
		res.setHeader("X-Avalon-Streaming", "1");
		res.flushHeaders();
		res.write(shellBeforeWithCss);

		// ── RENDER PAGE CONTENT (this is where data fetching happens) ──
		const pageContent = await renderPageComponentToHtml(
			PageComponent,
			preactRender,
			"[SSR Streaming]",
		);

		// Check if page returned a complete HTML doc (shouldn't happen with layouts, but safety check)
		const isCompleteDoc =
			pageContent.trim().startsWith("<!DOCTYPE html>") || pageContent.trim().startsWith("<html");
		if (isCompleteDoc) {
			// Can't stream this — just send it and close
			res.end(pageContent);
			return true;
		}

		// Apply wrapper layouts around page content
		const content = await applyWrapperLayouts(
			pageContent,
			wrapperLayouts,
			layoutProps,
			h,
			preactRender,
			"[SSR Streaming]",
		);

		// ── FLUSH PAGE CONTENT + SHELL TAIL ──
		// Inject client scripts before closing </body>
		const tail = injectStreamingClientScripts(content + shellAfter);

		res.end(tail);
		return true;
	} catch (error) {
		// If we already started writing, we can't change status code
		if (res.headersSent) {
			res.end(`<div>Streaming SSR error: ${(error as Error).message}</div></body></html>`);
			return true;
		}
		return false;
	}
}

async function handleSSRRequest(
	server: ViteDevServer,
	url: string,
	config: ResolvedAvalonConfig,
): Promise<string | null> {
	const pathname = url.split("?")[0];
	const pageFile = await findPageFile(pathname, config, server);

	if (!pageFile) return null;

	try {
		const pageModule = await server.ssrLoadModule(pageFile);
		const PageComponent = pageModule.default;

		if (!PageComponent) {
			console.warn(`[SSR] Page ${pageFile} has no default export`);
			return null;
		}

		// Collect CSS from the module graph after loading the page module.
		// This captures CSS modules, plain CSS imports, and any transitive CSS deps.
		const cssContents = await collectCssFromModuleGraph(server, pageFile);

		// Pre-load layout files via ssrLoadModule so their CSS modules enter
		// Vite's module graph *before* we collect CSS from them.
		const layoutFiles = await discoverLayoutFiles(pathname, server);
		const layoutModules = await loadDevLayoutModulesWithCss(server, layoutFiles, cssContents);

		let html: string;

		// If we have modular layouts, use manual layout composition
		if (config.modules && layoutModules.length > 0) {
			html = await renderPageWithManualLayouts(
				PageComponent,
				pageModule,
				layoutModules,
				pathname,
				config,
				server,
			);
		} else {
			html = await renderPageToHtml(PageComponent, pageModule, pathname, config, server);
		}

		// Inject collected CSS into the HTML so styles are present on first paint
		if (cssContents.length > 0) {
			html = injectSsrCss(html, cssContents);
		}

		return html;
	} catch (error) {
		console.error(`[SSR] Error rendering ${pageFile}:`, error);
		throw error;
	}
}

/**
 * Render a page with manually composed layouts (for modular architecture)
 *
 * Layout composition order:
 * 1. Page content is rendered first
 * 2. Module-specific layouts (e.g., docs/_layout.tsx) wrap the page content
 * 3. Root/shell layout (shared/_layout.tsx) wraps everything last
 *
 * This ensures that layouts returning `<div>` wrappers are applied before
 * layouts returning complete `<html>` documents.
 */
async function renderPageWithManualLayouts(
	PageComponent: unknown,
	pageModule: Record<string, unknown>,
	layoutModules: Array<{ file: string; module: Record<string, unknown> }>,
	pathname: string,
	config: ResolvedAvalonConfig,
	server: ViteDevServer,
): Promise<string> {
	const { h, renderToString: preactRender } = await loadDevShellEngine(server, config.core);

	// Check if page wants to skip certain layouts
	const layoutConfig = pageModule.layoutConfig as { skipLayouts?: string[] } | undefined;
	const skipLayouts = layoutConfig?.skipLayouts || [];

	// Filter out skipped layouts
	const activeLayouts = layoutModules.filter(
		({ file }) => !skipLayouts.includes(getLayoutBaseName(file)),
	);

	// Render page content first
	const pageContent = await renderPageComponentToHtml(PageComponent, preactRender, "[SSR]");

	// Check if page content is a complete HTML document
	const isCompleteDoc =
		pageContent.trim().startsWith("<!DOCTYPE html>") || pageContent.trim().startsWith("<html");

	if (isCompleteDoc) {
		// Page provides its own HTML structure, inject client script and return
		return injectClientScript(pageContent);
	}

	// Separate layouts into shell (returns <html>) and wrapper (returns <div>) layouts
	// We need to render each layout to determine its type, then apply in correct order
	// Merge frontmatter and metadata - metadata takes precedence for page-specific values
	const frontmatter = pageModule.frontmatter as Record<string, unknown> | undefined;
	const metadata = pageModule.metadata as Record<string, unknown> | undefined;
	const mergedFrontmatter = { ...frontmatter, ...metadata, currentPath: pathname };

	const layoutProps = {
		children: null as unknown, // Will be set per-layout
		frontmatter: mergedFrontmatter,
		params: {},
		url: pathname,
	};

	// Categorize layouts by rendering them with placeholder content
	const { shellLayouts, wrapperLayouts } = await categorizeShellWrapperLayouts(
		activeLayouts,
		layoutProps,
		h,
		preactRender,
	);

	// Apply wrapper layouts first (innermost to outermost), then the shell layout
	// last (the one that provides <html>). Shell precedence: module-specific
	// (last in array) over shared.
	const wrapped = await applyWrapperLayouts(
		pageContent,
		wrapperLayouts,
		layoutProps,
		h,
		preactRender,
		"[SSR]",
	);
	const content = await applyShellLayout(wrapped, shellLayouts, layoutProps, h, preactRender);

	// Check if final content is a complete HTML document
	const isFinalCompleteDoc =
		content.trim().startsWith("<!DOCTYPE html>") || content.trim().startsWith("<html");

	if (isFinalCompleteDoc) {
		return injectClientScript(content);
	}

	// Wrap in basic HTML structure (fallback if no shell layout)
	const fallbackMetadata = (pageModule.metadata || {}) as { title?: string; description?: string };
	const title = fallbackMetadata.title || "Avalon App";
	const description = fallbackMetadata.description || "";

	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
    <script type="module" src="/@vite/client"></script>
  </head>
  <body>
    ${content}
    <script type="module" src="/src/client/main.js"></script>
  </body>
</html>`;
}

/**
 * Inject client script into HTML if not already present.
 * Also ensures DOCTYPE is present for valid HTML5.
 */
function injectClientScript(html: string): string {
	let result = html;

	// Ensure DOCTYPE is present
	if (!result.trim().toLowerCase().startsWith("<!doctype")) {
		result = `<!DOCTYPE html>\n${result}`;
	}

	// Inject universal CSS from island framework renderers (Svelte scoped, Vue scoped, Solid CSS, etc.)
	if (!result.includes('data-universal-ssr="true"')) {
		const universalCSS = getUniversalCSSForHead(true);
		if (universalCSS && result.includes("</head>")) {
			result = result.replace("</head>", `${universalCSS}\n</head>`);
		}
	}

	// Inject universal head content (hydration scripts from frameworks like Solid)
	const universalHead = getUniversalHeadForInjection(true);
	if (universalHead && result.includes("</head>")) {
		result = result.replace("</head>", `${universalHead}\n</head>`);
	}

	// Conditionally inject Solid hydration bootstrap only when Solid islands are present
	result = injectSolidHydrationScriptIfNeeded(result);

	// Skip if scripts already present
	if (result.includes("/src/client/main.js") || result.includes("/@vite/client")) {
		return result;
	}

	// Inject before </body> or at the end
	const bodyCloseIndex = result.lastIndexOf("</body>");
	if (bodyCloseIndex !== -1) {
		return (
			result.slice(0, bodyCloseIndex) +
			'\n<script type="module" src="/@vite/client"></script>\n' +
			'<script type="module" src="/src/client/main.js"></script>\n' +
			result.slice(bodyCloseIndex)
		);
	}

	return (
		result +
		'\n<script type="module" src="/@vite/client"></script>\n<script type="module" src="/src/client/main.js"></script>'
	);
}

/**
 * Discover layout files that apply to a given route path.
 *
 * Supports both traditional layouts (src/layouts/) and modular layouts (app/modules/[module]/layouts/).
 * For route "/blog/post", checks shared layouts, module layouts, and traditional layouts.
 */
async function discoverLayoutFiles(pathname: string, server: ViteDevServer): Promise<string[]> {
	const viteRoot = server.config.root || process.cwd();
	const config = globalThis.__avalonConfig;
	const layoutFileName = "_layout.tsx";
	const layoutFiles: string[] = [];

	// Build path hierarchy: "/" → [''], "/blog/post" → ['', '/blog', '/blog/post']
	const segments = pathname.split("/").filter(Boolean);
	const paths = [""];
	for (let i = 0; i < segments.length; i++) {
		paths.push(`/${segments.slice(0, i + 1).join("/")}`);
	}

	// Helper to check and add layout file
	async function tryAddLayout(fullPath: string): Promise<void> {
		try {
			const stat = await fsStat(fullPath);
			if (stat.isFile()) {
				const relativePath = fullPath.slice(viteRoot.length);
				if (!layoutFiles.includes(relativePath)) {
					layoutFiles.push(relativePath);
				}
			}
		} catch {
			// Layout file doesn't exist — that's fine
		}
	}

	// 1. Check shared layouts directory (root layout)
	if (config?.layoutsDir) {
		const sharedLayoutsDir = `${viteRoot}/${config.layoutsDir}`;
		await tryAddLayout(`${sharedLayoutsDir}/${layoutFileName}`);
	}

	// 2. Check modular layouts (app/modules/*/layouts/)
	if (config?.modules) {
		const modulesDir = `${viteRoot}/${config.modules.dir}`;
		const layoutsDirName = config.modules.layoutsDirName;

		// Determine which module this route belongs to
		const firstSegment = segments[0] || "";
		const rootModules = ["home", "root", "main", "index"];

		// For root routes, check the home/root/main/index module
		if (!firstSegment || rootModules.includes(firstSegment.toLowerCase())) {
			for (const moduleName of rootModules) {
				await tryAddLayout(`${modulesDir}/${moduleName}/${layoutsDirName}/${layoutFileName}`);
			}
		} else {
			// For other routes, check the module matching the first segment
			await tryAddLayout(`${modulesDir}/${firstSegment}/${layoutsDirName}/${layoutFileName}`);
		}
	}

	// 3. Check traditional layouts directory (src/layouts/)
	const traditionalLayoutsDir = `${viteRoot}/src/layouts`;
	for (const pathSegment of paths) {
		const fullPath =
			pathSegment === ""
				? `${traditionalLayoutsDir}/${layoutFileName}`
				: `${traditionalLayoutsDir}${pathSegment}/${layoutFileName}`;
		await tryAddLayout(fullPath);
	}

	return layoutFiles;
}

/** Returns the `/`-rooted path if `relativePath` under `viteRoot` is a file, else null. */
async function tryPageFile(viteRoot: string, relativePath: string): Promise<string | null> {
	try {
		const fullPath = `${viteRoot}/${relativePath}`;
		const stat = await fsStat(fullPath);
		if (stat.isFile()) return `/${relativePath}`;
	} catch {
		// File doesn't exist
	}
	return null;
}

/**
 * Tries `${base}${ext}` for each extension, then `${base}/index${ext}` (unless
 * `base` already ends with `/index`). Returns the first match, else null.
 */
async function resolvePageWithExtensions(
	viteRoot: string,
	base: string,
	extensions: string[],
): Promise<string | null> {
	for (const ext of extensions) {
		const result = await tryPageFile(viteRoot, `${base}${ext}`);
		if (result) return result;
	}
	if (!base.endsWith("/index")) {
		for (const ext of extensions) {
			const result = await tryPageFile(viteRoot, `${base}/index${ext}`);
			if (result) return result;
		}
	}
	return null;
}

/** Computes the extension-less page base path within a module's pages directory. */
function resolveModulePageBase(
	modules: { dir: string; pagesDirName: string },
	pathname: string,
	normalizedPath: string,
): string {
	const segments = pathname.split("/").filter(Boolean);
	const firstSegment = segments[0] || "";
	const rootModules = ["home", "root", "main", "index"];

	let moduleName: string;
	let moduleRelativePath: string;
	if (!firstSegment || rootModules.includes(firstSegment.toLowerCase())) {
		// Root route - check home module
		moduleName = "home";
		moduleRelativePath = normalizedPath;
	} else {
		// First segment matches a module; strip it from the path
		moduleName = firstSegment;
		const remainingSegments = segments.slice(1);
		moduleRelativePath =
			remainingSegments.length > 0 ? `/${remainingSegments.join("/")}` : "/index";
	}

	return `${modules.dir}/${moduleName}/${modules.pagesDirName}${moduleRelativePath}`;
}

async function findPageFile(
	pathname: string,
	config: ResolvedAvalonConfig,
	server: ViteDevServer,
): Promise<string | null> {
	let normalizedPath = pathname;
	if (normalizedPath.endsWith("/") && normalizedPath !== "/") {
		normalizedPath = normalizedPath.slice(0, -1);
	}
	if (normalizedPath === "/") {
		normalizedPath = "/index";
	}

	const extensions = [".tsx", ".ts", ".jsx", ".js", ".mdx", ".md"];
	const viteRoot = server.config.root || process.cwd();

	// 1. Check modular page directories first
	if (config.modules) {
		const moduleBase = resolveModulePageBase(config.modules, pathname, normalizedPath);
		const result = await resolvePageWithExtensions(viteRoot, moduleBase, extensions);
		if (result) return result;
	}

	// 2. Check traditional pages directory
	return resolvePageWithExtensions(viteRoot, `${config.pagesDir}${normalizedPath}`, extensions);
}

/** Lazily initialises the shared `__avalonLayoutResolver` global if not already set. */
function ensureAvalonLayoutResolver(
	layoutModule: Record<string, unknown>,
	config: ResolvedAvalonConfig,
	viteRoot: string,
): void {
	if (globalThis.__avalonLayoutResolver) return;
	const EnhancedLayoutResolver = layoutModule.EnhancedLayoutResolver as new (
		opts: Record<string, unknown>,
	) => unknown;

	// Use the shared layouts directory as the base. The resolver will also check
	// modular layouts via the layout composer.
	const layoutsDir = config.layoutsDir || "src/layouts";

	globalThis.__avalonLayoutResolver = new EnhancedLayoutResolver({
		baseDirectory: `${viteRoot}/${layoutsDir}`,
		filePattern: "_layout.tsx",
		excludeDirectories: ["node_modules", ".git", "dist", "build"],
		enableWatching: true,
		developmentMode: false,
		enableCaching: true,
		cacheTTL: 60 * 1000,
		maxCacheSize: 100,
		enableStreaming: true,
		enableErrorBoundaries: true,
		enableMetrics: false,
		enableDebugInfo: false,
		// Pass modules config for modular layout discovery
		modulesDir: config.modules ? `${viteRoot}/${config.modules.dir}` : undefined,
		modulesLayoutsDirName: config.modules?.layoutsDirName,
	});
}

/** Renders the page component via the dev shell engine, with a loading fallback. */
async function renderDevFallbackContent(
	PageComponent: unknown,
	server: ViteDevServer,
	config: ResolvedAvalonConfig,
	pathname: string,
): Promise<string> {
	try {
		const { renderToString } = await loadDevShellEngine(server, config.core);
		if (typeof PageComponent === "function") {
			return renderToString((PageComponent as () => unknown)());
		}
		return "";
	} catch {
		return `<p>Loading page: ${escapeHtml(pathname)}</p>`;
	}
}

/**
 * Attempts layout-aware rendering via `ssrModule.renderToHtmlWithLayouts`.
 * Returns null when the required exports are missing or the render throws.
 */
async function tryRenderWithLayouts(
	ssrModule: Record<string, unknown>,
	layoutModule: Record<string, unknown>,
	routeConfig: Record<string, unknown>,
	config: ResolvedAvalonConfig,
	server: ViteDevServer,
	pathname: string,
	metadata: { title?: string },
): Promise<string | null> {
	if (
		!ssrModule.renderToHtmlWithLayouts ||
		!layoutModule.EnhancedLayoutResolver ||
		!layoutModule.EnhancedLayoutResolverUtils
	) {
		return null;
	}
	try {
		const viteRoot = server.config.root || process.cwd();
		ensureAvalonLayoutResolver(layoutModule, config, viteRoot);

		const fullUrl = `http://localhost${pathname}`;
		const layoutContext = {
			params: {},
			query: {},
			url: fullUrl,
			request: { method: "GET", url: fullUrl, headers: new Headers() },
		};

		return await (ssrModule.renderToHtmlWithLayouts as (...args: unknown[]) => Promise<string>)(
			routeConfig,
			globalThis.__avalonLayoutResolver,
			layoutContext,
			pathname,
			{ title: metadata.title || "Avalon App" },
			undefined,
			{ suppressWarnings: true },
		);
	} catch {
		// Layout rendering failed, fall back to basic rendering
		return null;
	}
}

/**
 * Attempts to render a page through the dev SSR module (layout-aware first, then
 * basic). Returns the rendered HTML, or null if the SSR module is unavailable or
 * exposes no usable renderer (caller should use the fallback template).
 */
async function tryRenderWithSsrModule(
	PageComponent: unknown,
	pageModule: Record<string, unknown>,
	pathname: string,
	config: ResolvedAvalonConfig,
	server: ViteDevServer,
	metadata: { title?: string; description?: string },
): Promise<string | null> {
	try {
		if (!cachedSSRModule) {
			cachedSSRModule = await server.ssrLoadModule(resolveAvalonPackagePath("src/render/ssr.ts"));
		}
		// cachedSSRModule is the dynamically-loaded render/ssr.ts module;
		// expected exports: renderToHtml, renderToHtmlWithLayouts
		const ssrModule = cachedSSRModule as Record<string, unknown>;

		if (!cachedLayoutModule) {
			cachedLayoutModule = await server.ssrLoadModule(
				resolveAvalonPackagePath("src/core/layout/enhanced-layout-resolver.ts"),
			);
		}
		// cachedLayoutModule is the dynamically-loaded enhanced-layout-resolver.ts module;
		// expected exports: EnhancedLayoutResolver, EnhancedLayoutResolverUtils
		const layoutModule = cachedLayoutModule as Record<string, unknown>;

		const routeConfig = {
			component: () =>
				typeof PageComponent === "function" ? (PageComponent as () => unknown)() : PageComponent,
			options: { title: metadata.title || "Avalon App" },
			frontmatter: pageModule.frontmatter as Record<string, unknown> | undefined,
		};

		// Try layout-aware rendering first
		const layoutHtml = await tryRenderWithLayouts(
			ssrModule,
			layoutModule,
			routeConfig,
			config,
			server,
			pathname,
			metadata,
		);
		if (layoutHtml !== null) return layoutHtml;

		if (ssrModule.renderToHtml) {
			return await (ssrModule.renderToHtml as (...args: unknown[]) => Promise<string>)(
				routeConfig,
				{ title: metadata.title || "Avalon App" },
				undefined,
				{ suppressWarnings: true },
			);
		}
	} catch {
		// SSR module not available, fall back to basic rendering
	}
	return null;
}

/** Renders a page to a full HTML document (dev), falling back to a basic template. */
async function renderPageToHtml(
	PageComponent: unknown,
	pageModule: Record<string, unknown>,
	pathname: string,
	config: ResolvedAvalonConfig,
	server: ViteDevServer,
): Promise<string> {
	const metadata = (pageModule.metadata || {}) as { title?: string; description?: string };

	const rendered = await tryRenderWithSsrModule(
		PageComponent,
		pageModule,
		pathname,
		config,
		server,
		metadata,
	);
	if (rendered !== null) return rendered;

	// Fallback: basic HTML template
	const title = metadata.title || "Avalon App";
	const description = metadata.description || "";
	const content = await renderDevFallbackContent(PageComponent, server, config, pathname);

	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
    <script type="module" src="/@vite/client"></script>
  </head>
  <body>
    <div id="app">${content}</div>
    <script type="module" src="/src/client/main.js"></script>
  </body>
</html>`;
}

function escapeHtml(str: string): string {
	return str
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

// ─── Global Type Declarations ───────────────────────────────────────────────

declare global {
	// deno-lint-ignore no-var
	var __avalonLayoutResolver: unknown;
	// deno-lint-ignore no-var
	var __avalonCollectLayoutCss: ((pathname: string) => Promise<string[]>) | undefined;
}
