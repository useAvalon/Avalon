/**
 * Framework Vite defaults derived from `core` + `integrations`.
 *
 * Users should not copy aliases, optimizeDeps, or ssr.noExternal into their
 * config — Avalon applies them from the frameworks they actually enabled.
 */

import { createRequire } from "node:module";
import { join } from "node:path";
import type { Alias, SSROptions, UserConfig } from "vite";
import {
	getOptimizeDepsForIntegrations,
	getSSRNoExternalForIntegrations,
} from "../build/integration-config.ts";

export interface FrameworkViteDefaultsOptions {
	integrations: readonly string[];
	core?: "preact" | "react";
	command: "serve" | "build";
	root?: string;
	nitroPreset?: string;
	/** Override package resolution (tests). Returns an ESM path or undefined. */
	resolvePackage?: (specifier: string) => string | undefined;
}

const QWIK = "@builder.io/qwik";

const PREACT_PIN = [
	"preact",
	"preact/hooks",
	"preact/compat",
	"preact/compat/server",
	"preact/compat/client",
] as const;

const REACT_TO_PREACT: ReadonlyArray<{ find: RegExp; spec: string }> = [
	{ find: /^react$/, spec: "preact/compat" },
	{ find: /^react\/jsx-runtime$/, spec: "preact/jsx-runtime" },
	{ find: /^react\/jsx-dev-runtime$/, spec: "preact/jsx-runtime" },
	{ find: /^react-dom$/, spec: "preact/compat" },
	{ find: /^react-dom\/server$/, spec: "preact/compat/server" },
	{ find: /^react-dom\/client$/, spec: "preact/compat/client" },
];

const VUE_ALIASES: Alias[] = [
	{ find: /^vue$/, replacement: "vue/dist/vue.runtime.esm-bundler.js" },
	{ find: /^@vue\/shared$/, replacement: "@vue/shared/dist/shared.esm-bundler.js" },
	{
		find: /^@vue\/runtime-core$/,
		replacement: "@vue/runtime-core/dist/runtime-core.esm-bundler.js",
	},
	{ find: /^@vue\/runtime-dom$/, replacement: "@vue/runtime-dom/dist/runtime-dom.esm-bundler.js" },
	{ find: /^@vue\/reactivity$/, replacement: "@vue/reactivity/dist/reactivity.esm-bundler.js" },
	{
		find: /^@vue\/server-renderer$/,
		replacement: "@vue/server-renderer/dist/server-renderer.esm-bundler.js",
	},
];

function exactSpec(spec: string): RegExp {
	const escaped = spec.replaceAll("/", String.raw`\/`);
	return new RegExp(`^${escaped}$`);
}

export function asNoExternalList(value: SSROptions["noExternal"]): Array<string | RegExp> {
	if (Array.isArray(value)) return value;
	if (!value || value === true) return [];
	return [value];
}

function resolveEsm(root: string, specifier: string): string | undefined {
	try {
		const require = createRequire(join(root, "package.json"));
		return require.resolve(specifier).replace(/\.js$/, ".mjs");
	} catch {
		return undefined;
	}
}

function pushResolvedAlias(
	aliases: Alias[],
	find: string | RegExp,
	replacement: string | undefined,
): void {
	if (!replacement) return;
	aliases.push({ find, replacement });
}

function runtimeIntegrations(integrations: readonly string[], core: "preact" | "react"): string[] {
	const names = new Set(integrations);
	names.add(core);
	return [...names];
}

function collectAliases(
	integrations: readonly string[],
	core: "preact" | "react",
	resolvePackage: (specifier: string) => string | undefined,
): Alias[] {
	const aliases: Alias[] = [];
	const usesPreact = core === "preact" || integrations.includes("preact");
	if (usesPreact) {
		for (const spec of PREACT_PIN) {
			pushResolvedAlias(aliases, exactSpec(spec), resolvePackage(spec));
		}
	}
	if (core === "preact") {
		for (const { find, spec } of REACT_TO_PREACT) {
			pushResolvedAlias(aliases, find, resolvePackage(spec));
		}
	}
	if (integrations.includes("vue")) {
		aliases.push(...VUE_ALIASES);
	}
	return aliases;
}

function collectDefine(
	command: "serve" | "build",
	integrations: readonly string[],
): Record<string, string | boolean> {
	const define: Record<string, string | boolean> = {
		__DEV__: command === "serve",
		__PROD__: command === "build",
		global: "globalThis",
		"process.env.NODE_ENV": JSON.stringify(command === "serve" ? "development" : "production"),
	};
	if (!integrations.includes("vue")) return define;
	define.__VUE_OPTIONS_API__ = true;
	define.__VUE_PROD_DEVTOOLS__ = command === "serve";
	return define;
}

function collectSsr(integrations: readonly string[], nitroPreset: string | undefined): SSROptions {
	const noExternal = getSSRNoExternalForIntegrations(
		integrations.filter((name) => name !== "solid"),
	);
	if (integrations.includes("vue") && !noExternal.includes("estree-walker")) {
		noExternal.push("estree-walker");
	}

	const ssr: SSROptions = { noExternal };
	if (integrations.includes("solid")) {
		ssr.resolve = { conditions: ["node"] };
	}
	const cloudflare = nitroPreset?.startsWith("cloudflare") ?? false;
	if (integrations.includes("solid") || cloudflare) {
		ssr.target = "webworker";
	}
	return ssr;
}

/**
 * Vite config fragment Avalon merges in `config()`. Safe to call with a
 * stub `resolvePackage` in tests.
 */
export function getFrameworkViteDefaults(options: FrameworkViteDefaultsOptions): UserConfig {
	const core = options.core ?? "preact";
	const root = options.root ?? process.cwd();
	const resolvePackage = options.resolvePackage ?? ((spec) => resolveEsm(root, spec));
	const frameworks = runtimeIntegrations(options.integrations, core);

	const include = new Set(getOptimizeDepsForIntegrations(frameworks));
	if (core === "react") {
		include.add("react-dom/server");
		include.add("react/jsx-runtime");
	}

	const exclude: string[] = [];
	if (frameworks.includes("qwik")) {
		include.delete(QWIK);
		include.delete(`${QWIK}/server`);
		exclude.push(QWIK);
	}

	const aliases = collectAliases(options.integrations, core, resolvePackage);

	return {
		define: collectDefine(options.command, options.integrations),
		resolve: aliases.length > 0 ? { alias: aliases } : undefined,
		optimizeDeps: {
			include: [...include],
			exclude,
		},
		ssr: collectSsr(frameworks, options.nitroPreset),
	};
}
