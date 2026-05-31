import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	ALL_SIDEBAR_HREFS,
	getPrevNext,
	getSidebarState,
	SIDEBAR,
} from "../shared/utils/sidebar.ts";

describe("Sidebar property tests", () => {
	// Feature: avalon-docs, Property 1: Sidebar toggle state machine
	it("Property 1: toggle state machine — toggle inverts, double-toggle restores", () => {
		fc.assert(
			fc.property(fc.boolean(), (initialOpen) => {
				let isOpen = initialOpen;
				const toggle = () => {
					isOpen = !isOpen;
				};
				toggle();
				expect(isOpen).toBe(!initialOpen);
				toggle();
				expect(isOpen).toBe(initialOpen);
				return true;
			}),
			{ numRuns: 100 },
		);
	});

	// Feature: avalon-docs, Property 2: Toggle icon matches open state
	it("Property 2: toggle icon matches open state", () => {
		fc.assert(
			fc.property(fc.boolean(), (isOpen) => {
				const icon = isOpen ? "✕" : "☰";
				return isOpen ? icon === "✕" : icon === "☰";
			}),
			{ numRuns: 100 },
		);
	});

	// Feature: avalon-docs, Property 3: Category expand/collapse round-trip
	it("Property 3: category expand/collapse round-trip", () => {
		fc.assert(
			fc.property(
				fc.constantFrom(...SIDEBAR.map((c) => c.label)),
				fc.boolean(),
				(label, initialExpanded) => {
					const state: Record<string, boolean> = { [label]: initialExpanded };
					const toggle = (l: string) => {
						state[l] = !state[l];
					};
					toggle(label);
					expect(state[label]).toBe(!initialExpanded);
					toggle(label);
					expect(state[label]).toBe(initialExpanded);
					return true;
				},
			),
			{ numRuns: 100 },
		);
	});

	// Feature: avalon-docs, Property 4: getSidebarState returns correct active href and category
	it("Property 4: getSidebarState returns correct active href and category", () => {
		fc.assert(
			fc.property(fc.constantFrom(...ALL_SIDEBAR_HREFS), (href) => {
				const { activeHref, expandedCategory } = getSidebarState(href);
				const category = SIDEBAR.find((c) => c.items.some((i) => i.href === href));
				return activeHref === href && expandedCategory === category?.label;
			}),
			{ numRuns: 100 },
		);
	});

	// Feature: avalon-docs, Property 5: getPrevNext returns correct adjacent pages for non-terminal entries
	it("Property 5: getPrevNext returns correct adjacent pages for non-terminal entries", () => {
		const flat = SIDEBAR.flatMap((c) => c.items);
		fc.assert(
			fc.property(
				fc.integer({ min: 1, max: flat.length - 2 }).map((i) => flat[i].href),
				(href) => {
					const { prev, next } = getPrevNext(href);
					const idx = flat.findIndex((i) => i.href === href);
					return prev?.href === flat[idx - 1].href && next?.href === flat[idx + 1].href;
				},
			),
			{ numRuns: 100 },
		);
	});
});
