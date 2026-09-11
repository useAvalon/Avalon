import { describe, expect, it, vi } from "vitest";

vi.mock("../client/lit-hydrate-support.ts", () => ({}));

function FakeLit() {}
FakeLit.elementName = "fake-widget";

describe("lit mount", () => {
	it("creates and appends a custom element, then unmount clears the marker", async () => {
		const appended: unknown[] = [];
		const created: Array<{ tag: string; props: Record<string, unknown> }> = [];
		const defined: string[] = [];

		const container = {
			dataset: { tagName: "fake-widget" } as Record<string, string>,
			querySelector: () => null,
			appendChild(node: unknown) {
				appended.push(node);
				return node;
			},
		} as unknown as HTMLElement;

		vi.stubGlobal("customElements", {
			get: () => undefined,
			define: (tag: string) => {
				defined.push(tag);
			},
		});
		vi.stubGlobal("document", {
			createElement(tag: string) {
				const el: Record<string, unknown> = {};
				created.push({ tag, props: el });
				return el;
			},
		});

		const { mount, unmount } = await import("../client/hydration.ts");
		mount(container, FakeLit as never, { count: 2 });

		expect(defined).toEqual(["fake-widget"]);
		expect(created).toHaveLength(1);
		expect(created[0]?.tag).toBe("fake-widget");
		expect(created[0]?.props.count).toBe(2);
		expect(appended).toHaveLength(1);
		expect(container.dataset.litHydrated).toBe("true");

		unmount(container);
		expect(container.dataset.litHydrated).toBeUndefined();

		vi.unstubAllGlobals();
	});
});
