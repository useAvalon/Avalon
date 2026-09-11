import { describe, expect, it } from "vitest";
import { API_ENTRIES, apiReferenceMarkdown } from "../knowledge/api.ts";
import {
	ALL_CONDITIONS,
	CORE_CONDITIONS,
	CUSTOM_DIRECTIVES,
	findCondition,
	ISLAND_PROP_REFERENCE,
} from "../knowledge/directives.ts";
import { DOC_TOPICS, getDoc, searchDocs } from "../knowledge/docs.ts";
import { SCAFFOLD_KINDS, scaffold } from "../knowledge/scaffold.ts";

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

	it("documents clientOnly on the island prop", () => {
		const field = ISLAND_PROP_REFERENCE.fields.find((f) => f.name === "clientOnly");
		expect(field?.type).toBe("boolean");
		expect(field?.description.toLowerCase()).toContain("mount");
		expect(ISLAND_PROP_REFERENCE.summary).toContain("clientOnly: true");
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

	it("adds state-management, cli, flora, and client-navigation topics", () => {
		for (const id of ["state-management", "cli", "flora", "client-navigation"]) {
			expect(getDoc(id), `missing topic: ${id}`).toBeDefined();
		}
	});

	it("search ranks client-navigation for router and view-transition queries", () => {
		expect(searchDocs("client navigation")[0]?.id).toBe("client-navigation");
		expect(searchDocs("viewTransition data-router-transition")[0]?.id).toBe("client-navigation");
	});

	it("configuration documents clientRouter", () => {
		const config = getDoc("configuration")?.content ?? "";
		expect(config).toContain("clientRouter");
	});

	it("configuration uses the correct plugin import (no /vite subpath)", () => {
		const config = getDoc("configuration")?.content ?? "";
		expect(config).toContain("import { avalon } from '@useavalon/avalon'");
		// The only mention of the wrong subpath should be the explicit warning,
		// never an actual import statement.
		expect(config).not.toContain("from '@useavalon/avalon/vite'");
	});

	it("client-scripts points at the client-navigation topic", () => {
		const scripts = getDoc("client-scripts")?.content ?? "";
		expect(scripts).toContain("client-navigation");
		expect(scripts).toContain("clientRouter");
		expect(scripts).toContain("@useavalon/avalon/client/router");
	});

	it("client-navigation documents the router, persist, and view transitions", () => {
		const nav = getDoc("client-navigation")?.content ?? "";
		expect(nav).toContain("@useavalon/avalon/client/router");
		expect(nav).toContain("data-router-reload");
		expect(nav).toContain("data-router-persist");
		expect(nav).toContain("clientRouter: true");
		expect(nav).toContain("clientNavigation");
		expect(nav).toContain("data-router-transition");
		expect(nav).toContain("viewTransition");
		expect(nav).toContain("startViewTransition");
		expect(nav).toContain("boolean | string");
		expect(nav).toContain("dataset.routerTransition");
		expect(nav).toContain("custom-ident");
		expect(nav).not.toContain("client:load");
	});

	it("islands topic documents the *.react.tsx framework naming rule", () => {
		const islands = getDoc("islands-architecture")?.content ?? "";
		expect(islands).toContain(".react.tsx");
		expect(islands.toLowerCase()).toContain("statically");
		expect(islands).toContain("clientOnly: true");
		expect(islands).toContain("data-render-strategy");
	});

	it("search ranks islands for clientOnly and client-only queries", () => {
		expect(searchDocs("clientOnly")[0]?.id).toBe("islands-architecture");
		expect(searchDocs("client-only")[0]?.id).toBe("islands-architecture");
	});

	it("routing documents both module-based and flat conventions", () => {
		const routing = getDoc("file-system-routing")?.content ?? "";
		expect(routing).toContain("app/modules");
		expect(routing).toContain("src/pages");
		expect(routing).toContain("clientNavigation");
	});

	it("state topic states there is no built-in shared store", () => {
		const state = getDoc("state-management")?.content ?? "";
		expect(state.toLowerCase()).toContain("no built-in shared");
		expect(state).toContain("CustomEvent");
	});

	it("flora topic documents the grid classes and stylesheet import", () => {
		const flora = getDoc("flora")?.content ?? "";
		expect(flora).toContain("flora-grid");
		expect(flora).toContain("@useavalon/flora/flora.css");
	});
});

describe("scaffold knowledge", () => {
	it("generates island-usage with the requested condition and no client:*", () => {
		const t = scaffold("island-usage", "UserCard", "on:visible");
		expect(t.code).toContain("island={{ condition: 'on:visible' }}");
		expect(t.code).not.toMatch(/client:(load|visible|idle|media|only)/);
		expect(t.suggestedPath).toMatch(/\.tsx$/);
	});

	it("generates island-usage with clientOnly when asked to skip SSR", () => {
		const t = scaffold("island-usage", "Chart", "clientOnly");
		expect(t.code).toContain("island={{ clientOnly: true }}");
		expect(t.code).not.toContain("client:only");
		expect(t.description.toLowerCase()).toContain("client-only");
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

	it("documents the client router import path and view transitions", () => {
		const router = API_ENTRIES.find((e) => e.importPath === "@useavalon/avalon/client/router");
		expect(router).toBeDefined();
		expect(router?.exports.join(" ")).toContain("navigate");
		expect(router?.exports.join(" ")).toContain("ViewTransitionMode");
		expect(router?.description).toContain("viewTransition");
		expect(router?.description).toContain("data-router-transition");
	});

	it("renders a markdown reference", () => {
		const md = apiReferenceMarkdown();
		expect(md).toContain("# Avalon Public API Reference");
		expect(md).toContain("@useavalon/avalon/cron");
	});

	it("documents the react and flora packages", () => {
		expect(API_ENTRIES.some((e) => e.importPath === "@useavalon/react")).toBe(true);
		expect(API_ENTRIES.some((e) => e.importPath === "@useavalon/flora")).toBe(true);
	});

	it("does not misattribute PersistentIsland/StreamingLayout to /client", () => {
		const client = API_ENTRIES.find((e) => e.importPath === "@useavalon/avalon/client");
		expect(client).toBeDefined();
		const joined = client?.exports.join(" ") ?? "";
		expect(joined).not.toContain("PersistentIsland");
		expect(joined).not.toContain("StreamingLayout");
		// They belong on the package root instead.
		const root = API_ENTRIES.find((e) => e.importPath === "@useavalon/avalon");
		expect(root?.exports.join(" ")).toContain("PersistentIsland");
	});
});
