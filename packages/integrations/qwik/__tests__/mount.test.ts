import { describe, expect, it, vi } from "vitest";

const qwikRender = vi.fn();
const qwikJsx = vi.fn((Component: unknown, props: unknown) => ({ Component, props }));

vi.mock("@builder.io/qwik", () => ({
	render: (...args: unknown[]) => qwikRender(...args),
	jsx: (Component: unknown, props: unknown) => qwikJsx(Component, props),
}));

const { hydrate, mount, unmount } = await import("../client/hydration.ts");

function island(opts: { childContainer?: boolean }): HTMLElement {
	return {
		children: [{}],
		dataset: {},
		matches: () => false,
		querySelector: (selector: string) =>
			opts.childContainer && selector.includes("container") ? {} : null,
	} as unknown as HTMLElement;
}

describe("qwik hydrate", () => {
	it("skips client render when SSR q:container is inside the island", () => {
		hydrate(island({ childContainer: true }), (() => null) as never, {});
		expect(qwikRender).not.toHaveBeenCalled();
	});

	it("still client-renders when the container is only an ancestor", async () => {
		hydrate(island({}), (() => null) as never, {});
		await vi.waitFor(() => {
			expect(qwikRender).toHaveBeenCalledOnce();
		});
		qwikRender.mockClear();
	});
});

describe("qwik mount", () => {
	it("client-renders via qwik.render and unmount is a no-op", async () => {
		const el = { dataset: {} } as HTMLElement;
		const Comp = () => null;
		mount(el, Comp as never, { n: 1 });
		await vi.waitFor(() => {
			expect(qwikRender).toHaveBeenCalledOnce();
		});
		expect(qwikRender.mock.calls[0]?.[0]).toBe(el);
		unmount(el);
		expect(qwikRender).toHaveBeenCalledOnce();
	});
});
