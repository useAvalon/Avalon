import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "oxc-transform";
import { afterAll, beforeAll, expect } from "vitest";
import { precompileJsx } from "../precompile-jsx.ts";

const packageRoot = fileURLToPath(new URL("../../../", import.meta.url));
const renderDir = fileURLToPath(new URL("../../render/", import.meta.url));

// Preact's renderer compares `Fragment` by identity, so the renderer, the vnode factory and the
// fixtures must share one copy of Preact. A package manager can install the renderer's peer copy
// separately from this package's own, so everything is loaded from the renderer's copy.
const rendererDir = join(
	dirname(realpathSync(createRequire(import.meta.url).resolve("preact-render-to-string"))),
	"..",
);
const preactDir = realpathSync(join(rendererDir, "..", "preact"));
const PREACT_ENTRIES: Record<string, string> = {
	preact: "dist/preact.mjs",
	"preact/hooks": "hooks/dist/hooks.mjs",
	"preact/jsx-runtime": "jsx-runtime/dist/jsxRuntime.mjs",
	"preact/compat": "compat/dist/compat.mjs",
};

/** Points `preact*` imports at the renderer's copy of Preact. */
function pinPreact(code: string): string {
	let out = code;
	for (const [specifier, entry] of Object.entries(PREACT_ENTRIES)) {
		const target = JSON.stringify(pathToFileURL(join(preactDir, entry)).href);
		out = out.replaceAll(`"${specifier}"`, target);
	}
	return out;
}

const preactUrl = (specifier: string) =>
	pathToFileURL(join(preactDir, PREACT_ENTRIES[specifier] as string)).href;

export async function createHarness() {
	const { h } = (await import(/* @vite-ignore */ preactUrl("preact"))) as {
		h: (type: unknown, props: unknown) => unknown;
	};
	const renderToString = (
		(await import(/* @vite-ignore */ pathToFileURL(join(rendererDir, "dist/index.mjs")).href)) as {
			default: (vnode: unknown) => string;
		}
	).default;

	let dir = "";
	let counter = 0;

	beforeAll(() => {
		dir = mkdtempSync(join(packageRoot, ".precompile-fixtures-"));
		mkdirSync(join(dir, "plain"));
		mkdirSync(join(dir, "compiled"));
		// The real runtime helpers, compiled once against the pinned Preact.
		for (const name of ["attribute-serialize", "precompile-runtime"]) {
			const file = join(renderDir, `${name}.ts`);
			const out = transformSync(file, readFileSync(file, "utf8"), { lang: "ts" });
			writeFileSync(
				join(dir, `${name}.mjs`),
				pinPreact(out.code).replaceAll("./attribute-serialize.ts", "./attribute-serialize.mjs"),
			);
		}
	});

	afterAll(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	/** Compiles `source` to JavaScript with Preact's automatic JSX runtime, optionally precompiling first. */
	function compile(source: string, name: string, precompile: boolean): string {
		const folder = precompile ? "compiled" : "plain";
		const file = join(dir, folder, name);
		let input = source;
		if (precompile) {
			const result = precompileJsx(source, file);
			if (result) {
				const runtimeUrl = JSON.stringify(pathToFileURL(join(dir, "precompile-runtime.mjs")).href);
				input = result.code.replace('"@useavalon/avalon/render/precompile-runtime"', runtimeUrl);
			}
		}
		const compiled = transformSync(file, input, {
			lang: "tsx",
			jsx: { runtime: "automatic", importSource: "preact" },
		});
		expect(compiled.errors).toEqual([]);
		const output = file.replace(/\.tsx$/, ".mjs");
		writeFileSync(output, pinPreact(compiled.code));
		return pathToFileURL(output).href;
	}

	async function render(source: string, props: Record<string, unknown> = {}) {
		const name = `case${counter++}.tsx`;
		const plainUrl = compile(source, name, false);
		const compiledUrl = compile(source, name, true);
		const transformed = precompileJsx(source, join(dir, "compiled", name))?.code ?? null;
		const plain = await import(/* @vite-ignore */ plainUrl);
		const compiled = await import(/* @vite-ignore */ compiledUrl);
		return {
			plain: renderToString(h(plain.default, props)),
			compiled: renderToString(h(compiled.default, props)),
			transformed,
		};
	}

	async function expectParity(source: string, props: Record<string, unknown> = {}) {
		const result = await render(source, props);
		expect(result.compiled).toBe(result.plain);
		return result;
	}

	return { render, expectParity };
}
