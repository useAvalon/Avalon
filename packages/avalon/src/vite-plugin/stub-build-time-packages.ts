/**
 * Specifiers that must not be bundled into SSR / Nitro / Cloudflare workers.
 *
 * The `@useavalon/avalon` barrel re-exports the Vite plugin, so Cloudflare's
 * worker pass inlines transform-time deps: oxc-parser (wasm32-wasi), Vite
 * itself (chokidar → fsevents.node), and integration Vite plugins.
 */

const VITE_PLUGIN_PACKAGES = [
	"@preact/preset-vite",
	"@vitejs/plugin-react",
	"@vitejs/plugin-vue",
	"@sveltejs/vite-plugin-svelte",
	"vite-plugin-solid",
	"@builder.io/qwik/optimizer",
	"vite-prerender-plugin",
] as const;

const NODE_ONLY_PACKAGES = ["chokidar", "fsevents"] as const;

const OXC_PACKAGES = ["oxc-parser", "oxc-transform", "oxc-minify"] as const;

const OXC_BINDING_PREFIXES = ["@oxc-parser/", "@oxc-transform/", "@oxc-minify/"] as const;

function matchesPackage(id: string, pkg: string): boolean {
	return id === pkg || id.startsWith(`${pkg}/`);
}

/** True when this import must be replaced by a stub in the SSR/Nitro graph. */
export function shouldStubBuildTimeSpecifier(id: string): boolean {
	const bare = id.split("?")[0] ?? id;
	if (bare.endsWith(".node")) return true;
	if (VITE_PLUGIN_PACKAGES.some((pkg) => matchesPackage(id, pkg))) return true;
	if (NODE_ONLY_PACKAGES.some((pkg) => matchesPackage(id, pkg))) return true;
	if (OXC_PACKAGES.some((pkg) => matchesPackage(id, pkg))) return true;
	return OXC_BINDING_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/**
 * Stub module source. Named exports exist so Rolldown does not fail
 * `import { parseSync } from "oxc-parser"` or
 * `import { isRunnableDevEnvironment } from "vite"` when the barrel is inlined.
 * These functions are never called at request time.
 */
export const STUB_BUILD_TIME_MODULE = [
	"const noop = () => ({});",
	"export default noop;",
	"export const parseSync = noop;",
	"export const visitorKeys = {};",
	"export const transform = noop;",
	"export const minify = noop;",
	"export const isRunnableDevEnvironment = () => false;",
	"export const watch = () => ({ on() {}, close() {} });",
	"export const FSWatcher = class {};",
].join("\n");
