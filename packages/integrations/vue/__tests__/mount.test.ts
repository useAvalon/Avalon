import { beforeEach, describe, expect, it, vi } from "vitest";

const appMount = vi.fn();
const appUnmount = vi.fn();
const createApp = vi.fn(() => ({ mount: appMount, unmount: appUnmount }));
const createSSRApp = vi.fn(() => ({ mount: appMount, unmount: appUnmount }));

vi.mock("vue", () => ({
	createApp: (...args: unknown[]) => createApp(...args),
	createSSRApp: (...args: unknown[]) => createSSRApp(...args),
}));

const { hydrate, mount, unmount } = await import("../client/hydration.ts");

describe("vue mount", () => {
	beforeEach(() => {
		appMount.mockClear();
		appUnmount.mockClear();
		createApp.mockClear();
		createSSRApp.mockClear();
	});

	it("uses createApp, not createSSRApp", () => {
		const el = {} as HTMLElement;
		const Comp = {};
		mount(el, Comp, { n: 1 });
		expect(createSSRApp).not.toHaveBeenCalled();
		expect(createApp).toHaveBeenCalledWith(Comp, { n: 1 });
		expect(appMount).toHaveBeenCalledWith(el);
	});

	it("unmounts the stored app", () => {
		const el = {} as HTMLElement;
		mount(el, {}, {});
		unmount(el);
		expect(appUnmount).toHaveBeenCalledOnce();
	});

	it("hydrate still uses createSSRApp", () => {
		const el = {} as HTMLElement;
		hydrate(el, {}, {});
		expect(createSSRApp).toHaveBeenCalledOnce();
	});
});
