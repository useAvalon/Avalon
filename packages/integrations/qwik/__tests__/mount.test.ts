import { describe, expect, it, vi } from "vitest";

const qwikRender = vi.fn();
const qwikJsx = vi.fn((Component: unknown, props: unknown) => ({ Component, props }));

vi.mock("@builder.io/qwik", () => ({
	render: (...args: unknown[]) => qwikRender(...args),
	jsx: (Component: unknown, props: unknown) => qwikJsx(Component, props),
}));

const { mount, unmount } = await import("../client/hydration.ts");

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
