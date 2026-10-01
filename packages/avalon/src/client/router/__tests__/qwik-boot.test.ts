import { describe, expect, it } from "vitest";
import { activateQwikLoader } from "../qwik-boot.ts";

interface FakeScript {
	tagName: "SCRIPT";
	attrs: Record<string, string>;
	text: string;
	textContent: string;
	getAttribute(name: string): string | null;
	hasAttribute(name: string): boolean;
	setAttribute(name: string, value: string): void;
}

function script(text: string, attrs: Record<string, string> = {}): FakeScript {
	const el: FakeScript = {
		tagName: "SCRIPT",
		attrs: { ...attrs },
		text,
		textContent: text,
		getAttribute(name) {
			return el.attrs[name] ?? null;
		},
		hasAttribute(name) {
			return name in el.attrs;
		},
		setAttribute(name, value) {
			el.attrs[name] = value;
		},
	};
	return el;
}

const QWIK_CONTAINER_SELECTOR = "[q\\:container]";

interface FakeContainer {
	tagName: "DIV";
	attrs: Record<string, string>;
	getAttribute(name: string): string | null;
	hasAttribute(name: string): boolean;
	setAttribute(name: string, value: string): void;
	dispatchEvent(event: Event): boolean;
}

function fakeContainer(): FakeContainer {
	const el: FakeContainer = {
		tagName: "DIV",
		attrs: {},
		getAttribute(name) {
			return el.attrs[name] ?? null;
		},
		hasAttribute(name) {
			return name in el.attrs;
		},
		setAttribute(name, value) {
			el.attrs[name] = value;
		},
		dispatchEvent() {
			return true;
		},
	};
	return el;
}

function container(scripts: FakeScript[], qwik = true, nodes: FakeContainer[] = []): ParentNode {
	const containers = qwik ? (nodes.length > 0 ? nodes : [fakeContainer()]) : [];
	return {
		matches: (selector: string) => (selector === QWIK_CONTAINER_SELECTOR ? qwik : false),
		querySelector: (selector: string) =>
			selector === QWIK_CONTAINER_SELECTOR
				? ((containers[0] ?? null) as unknown as Element | null)
				: selector === "script"
					? (scripts[0] as unknown as Element | null)
					: null,
		querySelectorAll: (selector: string) => {
			if (selector === "script") return scripts as unknown as Element[];
			if (selector === QWIK_CONTAINER_SELECTOR) return containers as unknown as Element[];
			return [];
		},
	} as unknown as ParentNode;
}

describe("activateQwikLoader", () => {
	it("runs inline scripts inside a qwik container subtree", () => {
		const loader = script("qwikloader()");
		const events = script('(window.qwikevents||(window.qwikevents=[])).push("click")');
		const ran: string[] = [];
		activateQwikLoader(container([loader, events]), { evalScript: (code) => ran.push(code) });

		expect(ran).toEqual([
			"qwikloader()",
			'(window.qwikevents||(window.qwikevents=[])).push("click")',
		]);
		expect(loader.getAttribute("data-avalon-qwik-boot")).toBe("1");
		expect(events.getAttribute("data-avalon-qwik-boot")).toBe("1");
	});

	it("does nothing when the subtree has no qwik container", () => {
		const plain = script("nope()");
		const ran: string[] = [];
		activateQwikLoader(container([plain], false), { evalScript: (code) => ran.push(code) });
		expect(ran).toEqual([]);
		expect(plain.hasAttribute("data-avalon-qwik-boot")).toBe(false);
	});

	it("skips scripts with a src attribute", () => {
		const external = script("", { src: "/qwikloader.js" });
		let evals = 0;
		activateQwikLoader(container([external]), { evalScript: () => evals++ });
		expect(evals).toBe(0);
	});

	it("skips non-executable script types", () => {
		const json = script('{"refs":{}}', { type: "qwik/json" });
		const ldjson = script("{}", { type: "application/ld+json" });
		let evals = 0;
		activateQwikLoader(container([json, ldjson]), {
			evalScript: () => evals++,
		});
		expect(evals).toBe(0);
	});

	it("runs the q:func script so resume can find inlined functions", () => {
		const funcs = script('document["qFuncs_x"]=[]', { "q:func": "qwik/json" });
		const ran: string[] = [];
		activateQwikLoader(container([funcs]), {
			evalScript: (code) => ran.push(code),
			resumeContainer: () => {},
		});
		expect(ran).toEqual(['document["qFuncs_x"]=[]']);
	});

	it("runs the qwikloader, which Qwik emits with type=module and no imports", () => {
		const loader = script("const t=document,e=window;", { id: "qwikloader", type: "module" });
		const ran: string[] = [];
		activateQwikLoader(container([loader]), { evalScript: (code) => ran.push(code) });
		expect(ran).toEqual(["const t=document,e=window;"]);
	});

	it("runs classic javascript mime types used by an inlined loader", () => {
		const js = script("qwikloader()", { type: "text/javascript" });
		const app = script("qwikloader()", { type: "application/javascript" });
		const ran: string[] = [];
		activateQwikLoader(container([js, app]), { evalScript: (code) => ran.push(code) });
		expect(ran).toEqual(["qwikloader()", "qwikloader()"]);
	});

	it("skips empty script bodies", () => {
		const empty = script("   ");
		let evals = 0;
		activateQwikLoader(container([empty]), { evalScript: () => evals++ });
		expect(evals).toBe(0);
	});

	it("does not re-execute scripts already marked as booted", () => {
		const booted = script("boot()", { "data-avalon-qwik-boot": "1" });
		let evals = 0;
		activateQwikLoader(container([booted]), { evalScript: () => evals++ });
		expect(evals).toBe(0);
	});

	it("dispatches qinit on each new container", () => {
		const island = fakeContainer();
		const resumed: FakeContainer[] = [];
		activateQwikLoader(container([script("qwikloader()")], true, [island]), {
			evalScript: () => {},
			resumeContainer: (el) => resumed.push(el as unknown as FakeContainer),
		});
		expect(resumed).toEqual([island]);
		expect(island.getAttribute("data-avalon-qwik-boot")).toBe("1");
	});

	it("skips the qwikloader but keeps qwikevents pushes once the loader is installed", () => {
		const doc = globalThis as { document?: { __q_context__?: number } };
		const previous = doc.document;
		doc.document = { __q_context__: 0 };
		try {
			const loader = script("qwikloader()", { id: "qwikloader" });
			const events = script('(window.qwikevents.push)("click")');
			const ran: string[] = [];
			activateQwikLoader(container([loader, events]), {
				evalScript: (code) => ran.push(code),
				resumeContainer: () => {},
			});
			// The push still runs: after install, window.qwikevents is the
			// loader's live { events, roots, push } object, so a push
			// registers the event immediately.
			expect(ran).toEqual(['(window.qwikevents.push)("click")']);
		} finally {
			doc.document = previous;
		}
	});

	it("marks executed scripts so a second pass is a no-op", () => {
		const fresh = script("boot()");
		let evals = 0;
		const root = container([fresh]);
		activateQwikLoader(root, { evalScript: () => evals++, resumeContainer: () => {} });
		activateQwikLoader(root, { evalScript: () => evals++, resumeContainer: () => {} });
		expect(evals).toBe(1);
		expect(fresh.getAttribute("data-avalon-qwik-boot")).toBe("1");
	});
});
