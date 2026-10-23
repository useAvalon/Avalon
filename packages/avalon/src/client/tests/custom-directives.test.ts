import { afterEach, describe, expect, it } from "vitest";
import {
	executeCustomDirective,
	hasClientDirective,
	registerClientDirective,
} from "../custom-directives.js";

afterEach(() => {
	delete globalThis.__AVALON_DIRECTIVES__;
});

describe("executeCustomDirective", () => {
	it("runs a client-registered handler without eval", () => {
		let hydrated = false;
		registerClientDirective("on:delay", (_el, hydrate) => {
			hydrate();
		});
		const island = { dataset: {} } as HTMLElement;
		expect(
			executeCustomDirective(island, "on:delay", () => {
				hydrated = true;
			}),
		).toBe(true);
		expect(hydrated).toBe(true);
	});

	it("ingests functions assigned on globalThis", () => {
		let hydrated = false;
		globalThis.__AVALON_DIRECTIVES__ = {
			"on:countdown": (_el: HTMLElement, hydrate: () => void) => {
				hydrate();
			},
		};
		expect(hasClientDirective("on:countdown")).toBe(true);
		const island = { dataset: { conditionArg: "5" } } as unknown as HTMLElement;
		expect(
			executeCustomDirective(island, "on:countdown", () => {
				hydrated = true;
			}),
		).toBe(true);
		expect(hydrated).toBe(true);
	});

	it("does not let a global copy replace a client-registered handler", () => {
		let from = "";
		registerClientDirective("on:keep", (_el, hydrate) => {
			from = "client";
			hydrate();
		});
		globalThis.__AVALON_DIRECTIVES__ = {
			"on:keep": (_el: HTMLElement, hydrate: () => void) => {
				from = "global";
				hydrate();
			},
		};
		executeCustomDirective({ dataset: {} } as HTMLElement, "on:keep", () => {});
		expect(from).toBe("client");
	});

	it("returns false for an unknown directive", () => {
		const island = { dataset: {} } as HTMLElement;
		expect(executeCustomDirective(island, "on:missing", () => {})).toBe(false);
	});
});
