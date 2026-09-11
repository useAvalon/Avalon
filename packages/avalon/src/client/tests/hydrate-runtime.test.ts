import { afterEach, describe, expect, it } from "vitest";
import { disposeIslands, scanAndHydrate, setHydrationLoader } from "../hydrate-runtime.ts";

interface FakeIsland {
	dataset: Record<string, string | undefined>;
}

function island(partial: Record<string, string | undefined> = {}): FakeIsland {
	return {
		dataset: {
			framework: "preact",
			src: "/islands/Counter.js",
			condition: "on:client",
			...partial,
		},
	};
}

function rootOf(islands: FakeIsland[]) {
	return {
		querySelectorAll: () => islands,
	} as unknown as ParentNode;
}

afterEach(() => {
	setHydrationLoader(null);
});

describe("disposeIslands", () => {
	it("unmounts every island and clears hydration markers", async () => {
		const unmounted: FakeIsland[] = [];
		setHydrationLoader({
			loadIntegrationModule: async () => ({
				hydrate: () => {},
				unmount: (el) => {
					unmounted.push(el as unknown as FakeIsland);
				},
			}),
		});

		const a = island({ hydrated: "true" });
		const b = island({ hydrated: "true", hydrationStatus: "ok" });
		await disposeIslands(rootOf([a, b]));

		expect(unmounted).toHaveLength(2);
		expect(a.dataset.hydrated).toBeUndefined();
		expect(b.dataset.hydrationStatus).toBeUndefined();
	});

	it("has no persist skip list — layout islands are disposed too", async () => {
		let count = 0;
		setHydrationLoader({
			loadIntegrationModule: async () => ({
				unmount: () => {
					count++;
				},
			}),
		});
		const header = island({ src: "/layouts/ThemeToggle.js" });
		await disposeIslands(rootOf([header]));
		expect(count).toBe(1);
	});
});

describe("scanAndHydrate", () => {
	it("skips ssr-only islands", () => {
		const skipped = island({ renderStrategy: "ssr-only" });
		scanAndHydrate(rootOf([skipped]));
		expect(skipped.dataset.hydrated).toBeUndefined();
	});

	it("skips already-hydrated islands", () => {
		let hydrates = 0;
		setHydrationLoader({
			loadIntegrationModule: async () => ({
				hydrate: () => {
					hydrates++;
				},
			}),
		});
		const ready = island({ hydrated: "true" });
		scanAndHydrate(rootOf([ready]));
		expect(hydrates).toBe(0);
	});
});
