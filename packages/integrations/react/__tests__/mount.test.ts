import { beforeEach, describe, expect, it, vi } from "vitest";

const render = vi.fn();
const unmountRoot = vi.fn();
const createRoot = vi.fn(() => ({ render, unmount: unmountRoot }));
const hydrateRoot = vi.fn(() => ({ unmount: unmountRoot }));
const createElement = vi.fn((Component: unknown, props: unknown) => ({ Component, props }));

vi.mock("react", () => ({
	createElement: (Component: unknown, props: unknown) => createElement(Component, props),
}));

vi.mock("react-dom/client", () => ({
	createRoot: (...args: unknown[]) => createRoot(...args),
	hydrateRoot: (...args: unknown[]) => hydrateRoot(...args),
}));

const { hydrate, mount, unmount } = await import("../client/hydration.ts");

describe("react mount", () => {
	beforeEach(() => {
		render.mockClear();
		unmountRoot.mockClear();
		createRoot.mockClear();
		hydrateRoot.mockClear();
	});

	it("uses createRoot, not hydrateRoot", () => {
		const el = {} as HTMLElement;
		mount(el, () => null, { n: 1 });
		expect(hydrateRoot).not.toHaveBeenCalled();
		expect(createRoot).toHaveBeenCalledWith(el);
		expect(render).toHaveBeenCalledOnce();
	});

	it("unmounts the stored root", () => {
		const el = {} as HTMLElement;
		mount(el, () => null, {});
		unmount(el);
		expect(unmountRoot).toHaveBeenCalledOnce();
	});

	it("hydrate still uses hydrateRoot", () => {
		const el = {} as HTMLElement;
		hydrate(el, () => null, {});
		expect(hydrateRoot).toHaveBeenCalledOnce();
	});
});
