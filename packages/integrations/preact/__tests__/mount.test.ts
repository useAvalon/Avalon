import { beforeEach, describe, expect, it, vi } from "vitest";

const preactRender = vi.fn();
const preactHydrate = vi.fn();
const h = vi.fn((Component: unknown, props: unknown) => ({ Component, props }));

vi.mock("preact", () => ({
	h: (Component: unknown, props: unknown) => h(Component, props),
	hydrate: (...args: unknown[]) => preactHydrate(...args),
	render: (...args: unknown[]) => preactRender(...args),
}));

const { hydrate, mount, unmount } = await import("../client/hydration.ts");

describe("preact mount", () => {
	beforeEach(() => {
		preactRender.mockClear();
		preactHydrate.mockClear();
		h.mockClear();
	});

	it("uses render, not hydrate", () => {
		const el = {} as HTMLElement;
		const Comp = () => null;
		mount(el, Comp, { n: 1 });
		expect(preactHydrate).not.toHaveBeenCalled();
		expect(preactRender).toHaveBeenCalledOnce();
		expect(preactRender.mock.calls[0]?.[1]).toBe(el);
	});

	it("hydrate still uses preact hydrate", () => {
		const el = {} as HTMLElement;
		hydrate(el, () => null, {});
		expect(preactHydrate).toHaveBeenCalledOnce();
		expect(preactRender).not.toHaveBeenCalled();
	});

	it("unmounts with render(null)", () => {
		const el = {} as HTMLElement;
		unmount(el);
		expect(preactRender).toHaveBeenCalledWith(null, el);
	});
});
