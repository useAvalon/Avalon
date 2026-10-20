/**
 * Vite 8 compiles CSS modules via `vite:css`, which stores hashes in a
 * WeakMap keyed by the environment config. Nitro/SSR configs never get that
 * cache, so `moduleCache.set` throws and the module runner surfaces RunnerError.
 *
 * Dev SSR only needs class-name strings that match the client's
 * `generateScopedName`. Intercept CSS imports in nitro/ssr and emit a JS
 * class map under a virtual id that is not a `.css` file, so PostCSS never
 * sees the stub. Browser CSS still comes from `?direct` on the client.
 */

import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve as resolvePath } from "node:path";
import { type Plugin, preprocessCSS } from "vite";
import { stableDevScopedName } from "./dev-css-modules.ts";

/** Must not contain `.css` — Vite would send the JS stub through PostCSS. */
export const NITRO_CSS_STUB_ID = "virtual:avalon/nitro-css-stub";
const STUB_ID_PREFIX = `${NITRO_CSS_STUB_ID}/`;
const CSS_EXT_RE = /\.(css|scss|sass|less|styl|stylus)$/;
const CSS_MODULE_RE = /\.module\.(css|scss|sass|less|styl|stylus)$/;
const LOCAL_CLASS_RE = /(?<![A-Za-z0-9_-])\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g;
const PASSTHROUGH_QUERY_RE = /[?&](direct|url|raw|inline)\b/;
const JS_IDENT_RE = /^[A-Za-z_$][\w$]*$/;
const JS_RESERVED = new Set([
	"default",
	"class",
	"function",
	"var",
	"let",
	"const",
	"export",
	"import",
	"new",
	"delete",
	"in",
	"if",
	"for",
	"while",
	"do",
	"return",
	"switch",
	"case",
	"this",
	"typeof",
	"void",
	"with",
	"yield",
	"await",
	"enum",
	"super",
	"null",
	"true",
	"false",
	"break",
	"continue",
]);

export function isNitroCssStubEnvironment(name: string | undefined): boolean {
	return name === "nitro" || name === "ssr";
}

export function isNitroCssStubId(id: string): boolean {
	if (PASSTHROUGH_QUERY_RE.test(id)) return false;
	const clean = id.split("?")[0] ?? id;
	return CSS_EXT_RE.test(clean);
}

export function nitroCssStubVirtualId(file: string): string {
	const encoded = Buffer.from(file.replaceAll("\\", "/"), "utf8").toString("base64url");
	return `\0${STUB_ID_PREFIX}${encoded}`;
}

export function fileFromNitroCssStubId(id: string): string | null {
	const bare = id.startsWith("\0") ? id.slice(1) : id;
	if (!bare.startsWith(STUB_ID_PREFIX)) return null;
	try {
		return Buffer.from(bare.slice(STUB_ID_PREFIX.length), "base64url").toString("utf8");
	} catch {
		return null;
	}
}

export function resolveNitroCssStubFile(id: string, importer: string | undefined): string | null {
	if (fileFromNitroCssStubId(id)) return null;
	if (!isNitroCssStubId(id)) return null;
	const clean = (id.split("?")[0] ?? id).replaceAll("\\", "/");
	if (isAbsolute(clean)) return clean;
	if (!importer) return null;
	const from = (importer.split("?")[0] ?? importer).replaceAll("\\", "/");
	return resolvePath(dirname(from), clean).replaceAll("\\", "/");
}

export function stripCssModuleGlobals(css: string): string {
	let out = "";
	let i = 0;
	while (i < css.length) {
		if (css.startsWith(":global", i)) {
			i += ":global".length;
			while (css[i] === " " || css[i] === "\t" || css[i] === "\n") i++;
			if (css[i] === "(") {
				i = skipBalanced(css, i, "(", ")");
				continue;
			}
			if (css[i] === "{") {
				i = skipBalanced(css, i, "{", "}");
				continue;
			}
			continue;
		}
		out += css[i];
		i++;
	}
	return out;
}

function skipBalanced(css: string, start: number, open: string, close: string): number {
	let depth = 1;
	let i = start + 1;
	while (i < css.length && depth > 0) {
		if (css[i] === open) depth++;
		else if (css[i] === close) depth--;
		i++;
	}
	return i;
}

export function localCssModuleClassNames(css: string): string[] {
	const names = new Set<string>();
	for (const match of stripCssModuleGlobals(css).matchAll(LOCAL_CLASS_RE)) {
		const name = match[1];
		if (name) names.add(name);
	}
	return [...names];
}

function localComposesByClass(css: string): Map<string, string[]> {
	const map = new Map<string, string[]>();
	const blockRe = /\.(-?[_a-zA-Z][\w-]*)[^{]*\{([^{}]*)\}/g;
	for (const match of stripCssModuleGlobals(css).matchAll(blockRe)) {
		const className = match[1];
		const body = match[2];
		if (!className || !body) continue;
		const composed: string[] = [];
		for (const compose of body.matchAll(/composes\s*:\s*([^;]+);/g)) {
			const spec = compose[1]?.trim() ?? "";
			if (/\bfrom\b/.test(spec)) continue;
			for (const token of spec.split(/\s+/)) {
				if (token) composed.push(token);
			}
		}
		if (composed.length > 0) map.set(className, composed);
	}
	return map;
}

export function cssModuleExportMap(file: string, css: string): Record<string, string> {
	const normalized = file.replaceAll("\\", "/");
	const map: Record<string, string> = {};
	const composes = localComposesByClass(css);
	for (const name of localCssModuleClassNames(css)) {
		const tokens = [name, ...(composes.get(name) ?? [])];
		map[name] = tokens.map((token) => stableDevScopedName(token, normalized)).join(" ");
	}
	return map;
}

function stubModuleSource(map: Record<string, string>): string {
	const named = Object.entries(map)
		.filter(([key]) => JS_IDENT_RE.test(key) && !JS_RESERVED.has(key))
		.map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};\n`)
		.join("");
	return `${named}export default ${JSON.stringify(map)};\n`;
}

/**
 * @param modules - Locals from `preprocessCSS` (`result.modules`). When omitted,
 *   plain `.module.css` still uses a source scan; preprocessor modules stay empty.
 */
export function generateNitroCssStub(
	file: string,
	cssSource?: string,
	modules?: Record<string, string>,
): string {
	const normalized = file.replaceAll("\\", "/");
	if (!CSS_MODULE_RE.test(normalized)) {
		return stubModuleSource({});
	}

	if (modules) {
		return stubModuleSource(modules);
	}

	if (!normalized.endsWith(".module.css")) {
		return stubModuleSource({});
	}

	let css = cssSource;
	if (css === undefined) {
		try {
			css = readFileSync(file, "utf8");
		} catch {
			css = "";
		}
	}
	return stubModuleSource(cssModuleExportMap(normalized, css));
}

function normalizeResolvedCssId(id: string): string {
	return (id.split("?")[0] ?? id).replaceAll("\\", "/");
}

export function createNitroCssStubPlugin(): Plugin {
	return {
		name: "avalon:nitro-css-stub",
		apply: "serve",
		enforce: "pre",
		applyToEnvironment(environment) {
			return isNitroCssStubEnvironment(environment.name);
		},
		async resolveId(id, importer) {
			if (fileFromNitroCssStubId(id)) {
				return id.startsWith("\0") ? id : `\0${id}`;
			}
			if (!isNitroCssStubId(id)) return null;
			const resolved = await this.resolve(id, importer, { skipSelf: true });
			if (!resolved || resolved.external) return null;
			return nitroCssStubVirtualId(normalizeResolvedCssId(resolved.id));
		},
		async load(id) {
			const file = fileFromNitroCssStubId(id);
			if (!file) return;
			this.addWatchFile(file);

			let source = "";
			try {
				source = readFileSync(file, "utf8");
			} catch {
				source = "";
			}

			let modules: Record<string, string> | undefined;
			const config = this.environment?.config;
			if (config && CSS_MODULE_RE.test(file)) {
				try {
					modules = (await preprocessCSS(source, file, config)).modules;
				} catch {
					modules = undefined;
				}
			}

			return {
				code: generateNitroCssStub(file, source, modules),
				moduleType: "js",
			};
		},
	};
}
