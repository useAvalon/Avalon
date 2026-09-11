import { beforeEach, describe, expect, it, vi } from "vitest";

const dispose = vi.fn();
const solidRender = vi.fn(() => dispose);
const solidHydrate = vi.fn(() => dispose);
const createComponent = vi.fn();

vi.mock("solid-js/web", () => ({
	createComponent: (...args: unknown[]) => createComponent(...args),
	hydrate: (...args: unknown[]) => solidHydrate(...args),
	render: (...args: unknown[]) => solidRender(...args),
}));

const { hydrate, mount, unmount } = await import("../client/hydration.ts");

describe("solid mount", () => {
	beforeEach(() => {
		dispose.mockClear();
		solidRender.mockClear();
		solidHydrate.mockClear();
	});

	it("uses render, not hydrate", () => {
		const el = {} as HTMLElement;
		const Comp = () => null;
		mount(el, Comp, { n: 1 });
		expect(solidHydrate).not.toHaveBeenCalled();
		expect(solidRender).toHaveBeenCalledOnce();
		expect(solidRender.mock.calls[0]?.[1]).toBe(el);
	});

	it("unmounts via the stored disposer", () => {
		const el = {} as HTMLElement;
		mount(el, () => null, {});
		unmount(el);
		expect(dispose).toHaveBeenCalledOnce();
	});

	it("hydrate still uses solid hydrate", async () => {
		const el = { dataset: {} } as HTMLElement;
		await hydrate(el, () => null, {});
		expect(solidHydrate).toHaveBeenCalledOnce();
	});
});
