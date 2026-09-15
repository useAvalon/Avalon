import { afterEach, describe, expect, it, vi } from "vitest";
import { eligibleFormNavigation, type FormSubmitLike } from "../forms.ts";
import {
	prefersReducedMotion,
	resolveViewTransition,
	viewTransitionFromDataset,
	withViewTransition,
} from "../transitions.ts";

const location = { origin: "https://example.com", href: "https://example.com/search" };

function form(partial: Partial<FormSubmitLike> & { action: string }): FormSubmitLike {
	return {
		method: "get",
		enctype: null,
		target: null,
		reload: false,
		hasFiles: false,
		...partial,
	};
}

describe("eligibleFormNavigation", () => {
	it("allows same-origin GET and POST", () => {
		expect(
			eligibleFormNavigation(form({ action: "/search", method: "get" }), location)?.method,
		).toBe("GET");
		expect(
			eligibleFormNavigation(form({ action: "/search", method: "post" }), location)?.method,
		).toBe("POST");
	});

	it("rejects reload, files, new-tab, and cross-origin", () => {
		expect(eligibleFormNavigation(form({ action: "/search", reload: true }), location)).toBeNull();
		expect(
			eligibleFormNavigation(form({ action: "/search", hasFiles: true }), location),
		).toBeNull();
		expect(
			eligibleFormNavigation(form({ action: "/search", target: "_blank" }), location),
		).toBeNull();
		expect(eligibleFormNavigation(form({ action: "https://other.test/x" }), location)).toBeNull();
	});
});

describe("resolveViewTransition", () => {
	it("treats false and the string false as disabled", () => {
		expect(resolveViewTransition(false)).toEqual({ enabled: false });
		expect(resolveViewTransition("false")).toEqual({ enabled: false });
	});

	it("treats a name as an enabled typed transition", () => {
		expect(resolveViewTransition("slide-forward")).toEqual({
			enabled: true,
			type: "slide-forward",
		});
		expect(resolveViewTransition(true)).toEqual({ enabled: true });
		expect(resolveViewTransition()).toEqual({ enabled: true });
	});
});

describe("viewTransitionFromDataset", () => {
	it("maps data-router-transition values", () => {
		expect(viewTransitionFromDataset(undefined)).toBeUndefined();
		expect(viewTransitionFromDataset("")).toBeUndefined();
		expect(viewTransitionFromDataset("false")).toBe(false);
		expect(viewTransitionFromDataset("true")).toBe(true);
		expect(viewTransitionFromDataset("slide-forward")).toBe("slide-forward");
	});
});

describe("withViewTransition", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function stubDocument(
		start?: (arg: { update: () => Promise<void>; types?: string[] } | (() => Promise<void>)) => {
			finished: Promise<void>;
		},
	): { dataset: Record<string, string | undefined> } {
		const dataset: Record<string, string | undefined> = {};
		vi.stubGlobal("document", {
			documentElement: { dataset },
			startViewTransition: start,
			querySelector: () => null,
		});
		return { dataset };
	}

	it("runs the update immediately when reduced motion is preferred", async () => {
		vi.stubGlobal("matchMedia", () => ({ matches: true }));
		let ran = false;
		await withViewTransition(() => {
			ran = true;
		});
		expect(ran).toBe(true);
		expect(prefersReducedMotion()).toBe(true);
	});

	it("skips the View Transitions API when mode is false", async () => {
		const start = vi.fn(() => ({ finished: Promise.resolve() }));
		stubDocument(start);
		vi.stubGlobal("matchMedia", () => ({ matches: false }));
		let ran = false;
		await withViewTransition(() => {
			ran = true;
		}, false);
		expect(ran).toBe(true);
		expect(start).not.toHaveBeenCalled();
	});

	it("skips an in-flight transition before starting another", async () => {
		const skip = vi.fn();
		let finishFirst: () => void = () => undefined;
		const firstFinished = new Promise<void>((resolve) => {
			finishFirst = resolve;
		});
		let calls = 0;
		const start = vi.fn(() => {
			calls++;
			if (calls === 1) {
				return { finished: firstFinished, skipTransition: skip };
			}
			return { finished: Promise.resolve(), skipTransition: vi.fn() };
		});
		stubDocument(start);
		vi.stubGlobal("matchMedia", () => ({ matches: false }));
		const first = withViewTransition(() => undefined);
		const second = withViewTransition(() => undefined);
		finishFirst();
		await Promise.all([first, second]);
		expect(skip).toHaveBeenCalled();
		expect(start).toHaveBeenCalledTimes(2);
	});

	it("swaps without the API when startViewTransition throws", async () => {
		const start = vi.fn(() => {
			throw new DOMException(
				"Transition was aborted because of invalid state",
				"InvalidStateError",
			);
		});
		stubDocument(start);
		vi.stubGlobal("matchMedia", () => ({ matches: false }));
		let ran = false;
		await withViewTransition(() => {
			ran = true;
		});
		expect(ran).toBe(true);
	});

	it("sets data-router-transition for a named type and clears it afterward", async () => {
		const start = vi.fn(
			(arg: { update: () => Promise<void>; types?: string[] } | (() => Promise<void>)) => {
				expect(document.documentElement.dataset.routerTransition).toBe("slide-forward");
				const update = typeof arg === "function" ? arg : arg.update;
				return { finished: Promise.resolve(update()) };
			},
		);
		const { dataset } = stubDocument(start);
		vi.stubGlobal("matchMedia", () => ({ matches: false }));
		await withViewTransition(() => undefined, "slide-forward");
		expect(dataset.routerTransition).toBeUndefined();
		expect(start).toHaveBeenCalledWith({
			update: expect.any(Function),
			types: ["slide-forward"],
		});
	});
});
