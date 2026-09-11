import { afterEach, describe, expect, it, vi } from "vitest";
import { bootServerIslands } from "../server-islands-boot.ts";

interface FakeScript {
	tagName: "SCRIPT";
	textContent: string;
	replacedWith?: FakeScript;
	getAttribute(name: string): string | null;
	replaceWith(next: FakeScript): void;
}

function moduleScript(text: string, src: string | null = null): FakeScript {
	const script: FakeScript = {
		tagName: "SCRIPT",
		textContent: text,
		getAttribute(name) {
			return name === "src" ? src : name === "type" ? "module" : null;
		},
		replaceWith(next) {
			script.replacedWith = next;
		},
	};
	return script;
}

interface FakeIsland {
	id: string;
	innerHTML: string;
	dataset: Record<string, string | undefined>;
	scripts: FakeScript[];
	querySelectorAll(selector: string): FakeScript[];
}

function island(partial: {
	id: string;
	dataset?: Record<string, string | undefined>;
	scripts?: FakeScript[];
}): FakeIsland {
	const el: FakeIsland = {
		id: partial.id,
		innerHTML: "fallback",
		dataset: { p: "payload", ...partial.dataset },
		scripts: partial.scripts ?? [],
		querySelectorAll(selector) {
			if (selector === 'script[type="module"]') return el.scripts;
			return [];
		},
	};
	return el;
}

function rootOf(islands: FakeIsland[]) {
	return {
		querySelectorAll: (selector: string) =>
			selector === "avalon-server-island[data-p]" ? islands : [],
	} as unknown as ParentNode;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("bootServerIslands", () => {
	it("fetches GET HTML and replaces the fallback", async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "<p>server</p>" }));
		vi.stubGlobal("fetch", fetchMock);

		const el = island({
			id: "si-abc-0",
			dataset: { endpoint: "/_server-islands/abc", timeout: "10000" },
		});
		await bootServerIslands(rootOf([el]));

		expect(fetchMock).toHaveBeenCalledWith("/_server-islands/abc?p=payload", expect.any(Object));
		expect(el.innerHTML).toBe("<p>server</p>");
		expect(el.dataset.siStarted).toBe("1");
	});

	it("skips islands that already started", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const el = island({
			id: "si-abc-0",
			dataset: { endpoint: "/_server-islands/abc", siStarted: "1" },
		});
		await bootServerIslands(rootOf([el]));
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("derives the endpoint from the element id when data-endpoint is missing", async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "<em>ok</em>" }));
		vi.stubGlobal("fetch", fetchMock);

		const el = island({ id: "si-comp42-3" });
		await bootServerIslands(rootOf([el]));

		expect(fetchMock).toHaveBeenCalledWith("/_server-islands/comp42?p=payload", expect.any(Object));
		expect(el.innerHTML).toBe("<em>ok</em>");
	});

	it("POSTs when the GET URL would exceed 2048 characters", async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "html" }));
		vi.stubGlobal("fetch", fetchMock);

		const el = island({
			id: "si-abc-0",
			dataset: { endpoint: "/_server-islands/abc", p: "x".repeat(2100) },
		});
		await bootServerIslands(rootOf([el]));

		expect(fetchMock).toHaveBeenCalledWith("/_server-islands/abc", {
			method: "POST",
			body: "x".repeat(2100),
			headers: { "content-type": "text/plain" },
			signal: expect.any(AbortSignal),
		});
	});

	it("re-executes inline module scripts after injection", async () => {
		const created: Array<{ type: string; textContent: string }> = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: true, text: async () => "<div></div>" })),
		);
		vi.stubGlobal("document", {
			createElement(tag: string) {
				expect(tag).toBe("script");
				const node = { type: "", textContent: "" };
				created.push(node);
				return node;
			},
		});

		const existing = moduleScript("hydrateServerIsland()");
		const el = island({
			id: "si-abc-0",
			dataset: { endpoint: "/_server-islands/abc" },
			scripts: [existing],
		});
		await bootServerIslands(rootOf([el]));

		expect(created).toHaveLength(1);
		expect(created[0]?.type).toBe("module");
		expect(created[0]?.textContent).toBe("hydrateServerIsland()");
		expect(existing.replacedWith).toBe(created[0]);
	});

	it("leaves the fallback in place when the request fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, text: async () => "nope" })),
		);

		const el = island({
			id: "si-abc-0",
			dataset: { endpoint: "/_server-islands/abc" },
		});
		await bootServerIslands(rootOf([el]));
		expect(el.innerHTML).toBe("fallback");
	});
});
