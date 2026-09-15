import { describe, expect, it } from "vitest";
import {
	asNoExternalList,
	getFrameworkViteDefaults,
	mapPreactCompatId,
	shouldResolvePreactCompat,
} from "../framework-vite-defaults.ts";

function aliasReplacement(
	aliases: Array<{ find: string | RegExp; replacement: string }> | undefined,
	source: string,
): string | undefined {
	if (!aliases) return undefined;
	for (const alias of aliases) {
		const find = alias.find;
		if (typeof find === "string") {
			if (source === find) return alias.replacement;
			continue;
		}
		if (find.test(source)) return alias.replacement;
	}
	return undefined;
}

function defaults(overrides: Partial<Parameters<typeof getFrameworkViteDefaults>[0]> = {}) {
	return getFrameworkViteDefaults({
		integrations: ["preact"],
		command: "serve",
		resolvePackage: (spec) => `/resolved/${spec}.mjs`,
		...overrides,
	});
}

describe("getFrameworkViteDefaults", () => {
	it("pins Preact to one ESM instance when the shell is Preact", () => {
		const config = defaults({ core: "preact", integrations: [] });
		const aliases = config.resolve?.alias as Array<{ find: RegExp; replacement: string }>;
		expect(aliasReplacement(aliases, "preact")).toBe("/resolved/preact.mjs");
		expect(aliasReplacement(aliases, "react")).toBe("/resolved/preact/compat.mjs");
		expect(aliasReplacement(aliases, "react-dom/server")).toBe(
			"/resolved/preact/compat/server.mjs",
		);
	});

	it("does not alias react to preact/compat when the shell is React", () => {
		const config = defaults({ core: "react", integrations: ["react"] });
		const aliases = config.resolve?.alias as Array<{ find: RegExp; replacement: string }>;
		expect(aliasReplacement(aliases, "react")).toBeUndefined();
		expect(aliasReplacement(aliases, "preact")).toBeUndefined();
	});

	it("skips aliases when the package is not installed", () => {
		const config = defaults({
			core: "preact",
			integrations: [],
			resolvePackage: () => undefined,
		});
		expect(config.resolve?.alias).toBeUndefined();
	});

	it("adds Vue runtime aliases and defines only when Vue is enabled", () => {
		const withVue = defaults({ integrations: ["vue"] });
		const withoutVue = defaults({ integrations: ["preact"] });
		const aliases = withVue.resolve?.alias as Array<{ find: RegExp; replacement: string }>;
		expect(aliasReplacement(aliases, "vue")).toBe("vue/dist/vue.runtime.esm-bundler.js");
		expect(withVue.define?.__VUE_OPTIONS_API__).toBe(true);
		expect(withoutVue.define?.__VUE_OPTIONS_API__).toBeUndefined();
	});

	it("inlines framework SSR packages and leaves Solid as native ESM", () => {
		const config = defaults({
			integrations: ["vue", "solid", "preact"],
		});
		const noExternal = config.ssr?.noExternal as string[];
		expect(noExternal).toContain("vue");
		expect(noExternal).toContain("estree-walker");
		expect(noExternal).toContain("preact");
		expect(noExternal).not.toContain("solid-js");
		expect(config.ssr?.resolve?.conditions).toEqual(["node"]);
	});

	it("excludes Qwik from optimizeDeps so QRL modules stay intact", () => {
		const config = defaults({ integrations: ["qwik"] });
		expect(config.optimizeDeps?.exclude).toContain("@builder.io/qwik");
		expect(config.optimizeDeps?.include).not.toContain("@builder.io/qwik");
		expect(config.ssr?.noExternal).toContain("@builder.io/qwik");
	});

	it("pre-bundles the shell engine even when it is not listed as an island", () => {
		const config = defaults({ core: "preact", integrations: ["vue"] });
		expect(config.optimizeDeps?.include).toContain("preact");
		expect(config.optimizeDeps?.include).toContain("vue");
	});

	it("pre-bundles react-dom/server when the shell is React", () => {
		const config = defaults({ core: "react", integrations: ["react"] });
		expect(config.optimizeDeps?.include).toContain("react-dom/server");
		expect(config.optimizeDeps?.include).toContain("react/jsx-runtime");
	});

	it("maps react specifiers to Preact compat for the client production build", () => {
		expect(mapPreactCompatId("react", "preact")).toBe("preact/compat");
		expect(mapPreactCompatId("react-dom/client", "preact")).toBe("preact/compat/client");
		expect(mapPreactCompatId("preact/compat", "preact")).toBe("preact/compat");
		expect(mapPreactCompatId("react", "react")).toBeNull();
		expect(shouldResolvePreactCompat("client", "serve")).toBe(false);
		expect(shouldResolvePreactCompat("client", "build")).toBe(true);
		expect(shouldResolvePreactCompat("ssr", "serve")).toBe(true);
	});

	it("normalizes ssr.noExternal into a list", () => {
		expect(asNoExternalList(["vue"])).toEqual(["vue"]);
		expect(asNoExternalList("vue")).toEqual(["vue"]);
		expect(asNoExternalList(true)).toEqual([]);
		expect(asNoExternalList(undefined)).toEqual([]);
	});

	it("targets webworker SSR for Solid or Cloudflare presets", () => {
		expect(defaults({ integrations: ["solid"] }).ssr?.target).toBe("webworker");
		expect(
			defaults({ integrations: ["preact"], nitroPreset: "cloudflare_pages" }).ssr?.target,
		).toBe("webworker");
		expect(defaults({ integrations: ["preact"] }).ssr?.target).toBeUndefined();
	});
});
