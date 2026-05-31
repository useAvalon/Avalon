import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	deserializeProps,
	escapeHtml,
	generateScopeId,
	getComponentFromModule,
	getExtension,
	hasDefaultExport,
	hasExtension,
	normalizePath,
	resolveProductionPath,
	serializeProps,
	toImportSpecifier,
} from "../utils.ts";

describe("serializeProps", () => {
	it("produces an HTML-safe JSON string with special characters escaped", () => {
		const result = serializeProps({ text: '<script>alert("xss")</script>' });
		expect(result).not.toContain("<");
		expect(result).not.toContain(">");
		expect(result).not.toContain('"');
		expect(result).not.toContain("'");
	});

	it("escapes ampersands", () => {
		const result = serializeProps({ text: "a & b" });
		expect(result).not.toContain("&");
		expect(result).toContain(String.raw`\u0026`);
	});

	it("returns {} for non-serializable input", () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;
		const result = serializeProps(circular);
		expect(result).toBe("{}");
	});

	it("handles empty object", () => {
		const result = serializeProps({});
		expect(result).toBe("{}");
	});

	it("handles nested objects", () => {
		const result = serializeProps({ a: { b: "c" } });
		expect(result).not.toContain('"');
		expect(result).toContain(String.raw`\u0022`);
	});
});

describe("deserializeProps", () => {
	it("returns parsed object from valid JSON string", () => {
		const result = deserializeProps('{"name":"test","count":42}');
		expect(result).toEqual({ name: "test", count: 42 });
	});

	it("returns empty object for invalid JSON", () => {
		const result = deserializeProps("not valid json");
		expect(result).toEqual({});
	});

	it("returns empty object for empty string", () => {
		const result = deserializeProps("");
		expect(result).toEqual({});
	});

	it("handles nested JSON", () => {
		const result = deserializeProps('{"a":{"b":[1,2,3]}}');
		expect(result).toEqual({ a: { b: [1, 2, 3] } });
	});
});

describe("resolveProductionPath", () => {
	it("returns correct path for SSR target with .tsx source", () => {
		const result = resolveProductionPath("/islands/Counter.tsx", "dist", "ssr");
		expect(result).toBe("dist/ssr/islands/Counter.js");
	});

	it("returns correct path for client target", () => {
		const result = resolveProductionPath("/components/App.jsx", "dist", "client");
		expect(result).toBe("dist/client/components/App.js");
	});

	it("defaults build output to dist when undefined", () => {
		const result = resolveProductionPath("/islands/Counter.tsx", undefined, "ssr");
		expect(result).toBe("dist/ssr/islands/Counter.js");
	});

	it("handles .vue extension", () => {
		const result = resolveProductionPath("/components/App.vue", "build", "ssr");
		expect(result).toBe("build/ssr/components/App.js");
	});

	it("handles .svelte extension", () => {
		const result = resolveProductionPath("/components/App.svelte", "out", "client");
		expect(result).toBe("out/client/components/App.js");
	});

	it("handles .ts extension", () => {
		const result = resolveProductionPath("/utils/helper.ts", "dist", "ssr");
		expect(result).toBe("dist/ssr/utils/helper.js");
	});

	it("handles path without leading slash", () => {
		const result = resolveProductionPath("islands/Counter.tsx", "dist", "ssr");
		expect(result).toBe("dist/ssr/islands/Counter.js");
	});
});

describe("getExtension", () => {
	it("returns extension including the dot", () => {
		expect(getExtension("file.ts")).toBe(".ts");
	});

	it("returns last extension for multiple dots", () => {
		expect(getExtension("file.test.ts")).toBe(".ts");
	});

	it("returns empty string for no extension", () => {
		expect(getExtension("Makefile")).toBe("");
	});

	it("returns empty string for empty string", () => {
		expect(getExtension("")).toBe("");
	});

	it("handles paths with directories", () => {
		expect(getExtension("src/components/App.tsx")).toBe(".tsx");
	});

	it("handles dotfiles", () => {
		expect(getExtension(".gitignore")).toBe(".gitignore");
	});
});

describe("hasExtension", () => {
	it("returns true when extension is in the array", () => {
		expect(hasExtension("App.tsx", [".tsx", ".jsx"])).toBe(true);
	});

	it("returns false when extension is not in the array", () => {
		expect(hasExtension("App.ts", [".tsx", ".jsx"])).toBe(false);
	});

	it("returns false for empty extensions array", () => {
		expect(hasExtension("App.tsx", [])).toBe(false);
	});

	it("returns false for file with no extension", () => {
		expect(hasExtension("Makefile", [".ts", ".js"])).toBe(false);
	});

	it("returns false for empty path", () => {
		expect(hasExtension("", [".ts"])).toBe(false);
	});
});

describe("generateScopeId", () => {
	it("returns deterministic scope ID for same input", () => {
		const id1 = generateScopeId("/components/App.vue");
		const id2 = generateScopeId("/components/App.vue");
		expect(id1).toBe(id2);
	});

	it("returns ID in data-v-{hash} format", () => {
		const id = generateScopeId("/components/App.vue");
		expect(id).toMatch(/^data-v-[a-z0-9]+$/);
	});

	it("returns different IDs for different paths", () => {
		const id1 = generateScopeId("/components/App.vue");
		const id2 = generateScopeId("/components/Other.vue");
		expect(id1).not.toBe(id2);
	});

	it("handles empty string", () => {
		const id = generateScopeId("");
		expect(id).toMatch(/^data-v-/);
	});
});

describe("escapeHtml", () => {
	it("escapes ampersands", () => {
		expect(escapeHtml("a & b")).toBe("a &amp; b");
	});

	it("escapes less-than signs", () => {
		expect(escapeHtml("<div>")).toBe("&lt;div&gt;");
	});

	it("escapes greater-than signs", () => {
		expect(escapeHtml("a > b")).toBe("a &gt; b");
	});

	it("escapes double quotes", () => {
		expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
	});

	it("escapes single quotes", () => {
		expect(escapeHtml("it's")).toBe("it&#39;s");
	});

	it("escapes all special characters together", () => {
		expect(escapeHtml("<a href=\"x\">&'test'")).toBe(
			"&lt;a href=&quot;x&quot;&gt;&amp;&#39;test&#39;",
		);
	});

	it("returns empty string for empty input", () => {
		expect(escapeHtml("")).toBe("");
	});

	it("returns string unchanged when no special characters", () => {
		expect(escapeHtml("hello world")).toBe("hello world");
	});
});

describe("normalizePath", () => {
	it("returns absolute path unchanged", () => {
		expect(normalizePath("/absolute/path")).toBe("/absolute/path");
	});

	it("returns file:// URL unchanged", () => {
		expect(normalizePath("file:///some/path")).toBe("file:///some/path");
	});

	it("resolves relative path with base directory", () => {
		const result = normalizePath("components/App.tsx", "/project/src");
		expect(result).toBe(resolve("/project/src", "components/App.tsx"));
	});

	it("resolves relative path without base directory using cwd", () => {
		const result = normalizePath("components/App.tsx");
		expect(result).toBe(resolve("components/App.tsx"));
	});
});

describe("toImportSpecifier", () => {
	it("converts Windows path to file:/// URL", () => {
		expect(toImportSpecifier(String.raw`C:\projects\app\dist\component.js`)).toBe(
			"file:///C:/projects/app/dist/component.js",
		);
	});

	it("converts Windows path with forward slashes", () => {
		expect(toImportSpecifier("D:/projects/app/dist/component.js")).toBe(
			"file:///D:/projects/app/dist/component.js",
		);
	});

	it("returns Unix path unchanged", () => {
		expect(toImportSpecifier("/usr/local/app/dist/component.js")).toBe(
			"/usr/local/app/dist/component.js",
		);
	});

	it("returns relative path unchanged", () => {
		expect(toImportSpecifier("./dist/component.js")).toBe("./dist/component.js");
	});

	it("returns empty string unchanged", () => {
		expect(toImportSpecifier("")).toBe("");
	});
});

describe("hasDefaultExport", () => {
	it("returns true for module with default export", () => {
		expect(hasDefaultExport({ default: () => {} })).toBe(true);
	});

	it("returns false for module without default export", () => {
		expect(hasDefaultExport({ named: () => {} })).toBe(false);
	});

	it("returns false for null", () => {
		expect(hasDefaultExport(null)).toBe(false);
	});

	it("returns false for undefined", () => {
		expect(hasDefaultExport(undefined)).toBe(false);
	});

	it("returns false for non-object", () => {
		expect(hasDefaultExport("string")).toBe(false);
	});
});

describe("getComponentFromModule", () => {
	it("returns default export when present", () => {
		const component = () => "hello";
		const module = { default: component, other: "stuff" };
		expect(getComponentFromModule(module)).toBe(component);
	});

	it("returns module itself when no default export", () => {
		const module = { render: () => "hello" };
		expect(getComponentFromModule(module)).toBe(module);
	});

	it("returns default even if it is falsy", () => {
		const module = { default: null };
		expect(getComponentFromModule(module)).toBeNull();
	});
});
