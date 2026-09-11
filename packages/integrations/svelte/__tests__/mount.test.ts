import { beforeEach, describe, expect, it, vi } from "vitest";

const svelteMount = vi.fn(() => ({ id: "instance" }));
const svelteHydrate = vi.fn(() => ({ id: "hydrated" }));
const svelteUnmount = vi.fn();

vi.mock("svelte", () => ({
	hydrate: (...args: unknown[]) => svelteHydrate(...args),
	mount: (...args: unknown[]) => svelteMount(...args),
	unmount: (...args: unknown[]) => svelteUnmount(...args),
}));

const { mount, unmount } = await import("../client/hydration.ts");

describe("svelte mount", () => {
	beforeEach(() => {
		svelteMount.mockClear();
		svelteHydrate.mockClear();
		svelteUnmount.mockClear();
	});

	it("uses svelte mount and stores the instance for dispose", () => {
		const el = { innerHTML: "", dataset: {} } as HTMLElement;
		const Comp = {} as never;
		mount(el, Comp, { n: 1 });
		expect(svelteHydrate).not.toHaveBeenCalled();
		expect(svelteMount).toHaveBeenCalledOnce();
		unmount(el);
		expect(svelteUnmount).toHaveBeenCalledOnce();
	});
});
