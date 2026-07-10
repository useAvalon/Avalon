import { describe, expect, it } from "vitest";
import { API_ENTRIES, apiReferenceMarkdown } from "../knowledge/api.ts";
import {
	ALL_CONDITIONS,
	CORE_CONDITIONS,
	CUSTOM_DIRECTIVES,
	findCondition,
} from "../knowledge/directives.ts";
import { DOC_TOPICS, getDoc, searchDocs } from "../knowledge/docs.ts";
import { scaffold, SCAFFOLD_KINDS } from "../knowledge/scaffold.ts";

describe("directives knowledge", () => {
	it("exposes the five core conditions", () => {
		const names = CORE_CONDITIONS.map((c) => c.condition);
		expect(names).toEqual([
			"on:client",
			"on:visible",
			"on:interaction",
			"on:idle",
			"media:<query>",
		]);
	});

	it("marks custom directives as requiring registration", () => {
		expect(CUSTOM_DIRECTIVES.every((c) => c.requiresRegistration)).toBe(true);
		expect(CORE_CONDITIONS.every((c) => !c.requiresRegistration)).toBe(true);
	});

	it("combines core + custom in ALL_CONDITIONS", () => {
		expect(ALL_CONDITIONS).toHaveLength(CORE_CONDITIONS.length + CUSTOM_DIRECTIVES.length);
	});

	it("findCondition resolves media: queries to the base condition", () => {
		expect(findCondition("media:(max-width: 500px)")?.condition).toBe("media:<query>");
		expect(findCondition("on:delay")?.condition).toBe("on:delay");
		expect(findCondition("on:nope")).toBeUndefined();
	});
});

describe("docs knowledge", () => {
	it("has unique topic ids", () => {
		const ids = DOC_TOPICS.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("search ranks the islands topic first for hydration queries", () => {
		const results = searchDocs("island hydration on:visible");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0].id).toContain("island");
	});

	it("returns empty for an unknown query", () => {
		expect(searchDocs("zzzznotarealterm")).toHaveLength(0);
	});

	it("getDoc fetches by id", () => {
		expect(getDoc("server-actions")?.title).toBe("Server Actions");
		expect(getDoc("nope")).toBeUndefined();
	});

	it("covers styling, metadata, mdx, configuration, and frameworks topics", () => {
		for (const id of ["styling", "metadata", "mdx", "configuration", "frameworks"]) {
			expect(getDoc(id), `missing topic: ${id}`).toBeDefined();
		}
	});
});

describe("scaffold knowledge", () => {
	it("generates island-usage with the requested condition and no client:*", () => {
		const t = scaffold("island-usage", "UserCard", "on:visible");
		expect(t.code).toContain("island={{ condition: 'on:visible' }}");
		expect(t.code).not.toMatch(/client:(load|visible|idle|media|only)/);
		expect(t.suggestedPath).toMatch(/\.tsx$/);
	});

	it("generates an action using @useavalon/avalon/actions", () => {
		const t = scaffold("action", "createPost");
		expect(t.code).toContain("@useavalon/avalon/actions");
		expect(t.code).toContain("defineAction");
	});

	it("supports every declared kind", () => {
		for (const kind of SCAFFOLD_KINDS) {
			const t = scaffold(kind, "Thing");
			expect(t.code.length).toBeGreaterThan(0);
			expect(t.suggestedPath.length).toBeGreaterThan(0);
		}
	});
});

describe("api knowledge", () => {
	it("documents the actions import path", () => {
		expect(API_ENTRIES.some((e) => e.importPath === "@useavalon/avalon/actions")).toBe(true);
	});

	it("renders a markdown reference", () => {
		const md = apiReferenceMarkdown();
		expect(md).toContain("# Avalon Public API Reference");
		expect(md).toContain("@useavalon/avalon/cron");
	});
});
