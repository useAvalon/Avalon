import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
export type QwikOptimizerBinding = {
	transform_modules: (opts: unknown) => unknown;
	transform_fs?: (opts: unknown) => unknown;
};

/**
 * Loads the Qwik optimizer WASM binding without attempting native .node bindings.
 * Skips console warnings on platforms where Qwik no longer ships a native binary
 * (e.g. darwin-x64) and uses the object form of wasm init expected by Qwik 1.20+.
 */
export async function loadQwikWasmBinding(): Promise<QwikOptimizerBinding> {
	const require = createRequire(import.meta.url);
	const pkgRoot = dirname(require.resolve("@builder.io/qwik/package.json"));
	const wasmPath = join(pkgRoot, "bindings", "qwik_wasm_bg.wasm");
	const wasmModuleUrl = pathToFileURL(join(pkgRoot, "bindings", "qwik.wasm.mjs")).href;
	const mod = await import(/* @vite-ignore */ wasmModuleUrl);
	const bytes = await readFile(wasmPath);
	const compiled = await WebAssembly.compile(bytes);
	await mod.default({ module_or_path: compiled });
	return mod as QwikOptimizerBinding;
}
