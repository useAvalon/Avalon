import { afterEach, describe, expect, it } from "vitest";
import { disposeIslands, scanAndHydrate, setHydrationLoader } from "../hydrate-runtime.ts";

interface FakeIsland {
	dataset: Record<string, string | undefined>;
	dispatchEvent?: () => boolean;
}

function island(partial: Record<string, string | undefined> = {}): FakeIsland {
	return {
		dataset: {
			framework: "preact",
			src: "/islands/Counter.js",
			condition: "on:client",
			...partial,
		},
		dispatchEvent: () => true,
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

async function flush(): Promise<void> {
	for (let i = 0; i < 8; i++) await Promise.resolve();
}

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

	it("mounts client-only islands instead of hydrating", async () => {
		const mounts: FakeIsland[] = [];
		let hydrates = 0;
		setHydrationLoader({
			loadComponent: async () => ({ default: () => null }),
			loadIntegrationModule: async () => ({
				hydrate: () => {
					hydrates++;
				},
				mount: (el) => {
					mounts.push(el as unknown as FakeIsland);
				},
			}),
		});
		const only = island({ renderStrategy: "client-only", props: "{}" });
		scanAndHydrate(rootOf([only]));
		await flush();
		expect(hydrates).toBe(0);
		expect(mounts).toHaveLength(1);
		expect(only.dataset.hydrated).toBe("true");
	});

	it("does not remount an already-mounted client-only island", async () => {
		let mounts = 0;
		setHydrationLoader({
			loadComponent: async () => ({ default: () => null }),
			loadIntegrationModule: async () => ({
				mount: () => {
					mounts++;
				},
			}),
		});
		const only = island({ renderStrategy: "client-only", hydrated: "true" });
		scanAndHydrate(rootOf([only]));
		await flush();
		expect(mounts).toBe(0);
	});

	it("isolates a throwing client-only island from siblings", async () => {
		const mounted: string[] = [];
		setHydrationLoader({
			loadComponent: async (src) => ({ default: () => src }),
			loadIntegrationModule: async () => ({
				mount: (el) => {
					const src = (el as unknown as FakeIsland).dataset.src ?? "";
					if (src.includes("Broken")) throw new Error("boom");
					mounted.push(src);
				},
			}),
		});
		const broken = island({
			src: "/islands/Broken.js",
			renderStrategy: "client-only",
			props: "{}",
		});
		const ok = island({ src: "/islands/Ok.js", renderStrategy: "client-only", props: "{}" });
		scanAndHydrate(rootOf([broken, ok]));
		await flush();
		expect(broken.dataset.hydrationStatus).toBe("failed");
		expect(mounted).toEqual(["/islands/Ok.js"]);
		expect(ok.dataset.hydrated).toBe("true");
	});

	it("disposes client-only islands then remounts after a fresh scan", async () => {
		const unmounted: string[] = [];
		const mounted: string[] = [];
		setHydrationLoader({
			loadComponent: async (src) => ({ default: () => src }),
			loadIntegrationModule: async () => ({
				mount: (el) => {
					mounted.push((el as unknown as FakeIsland).dataset.src ?? "");
				},
				unmount: (el) => {
					unmounted.push((el as unknown as FakeIsland).dataset.src ?? "");
				},
			}),
		});
		const widget = island({
			src: "/islands/Widget.js",
			renderStrategy: "client-only",
			props: "{}",
		});
		scanAndHydrate(rootOf([widget]));
		await flush();
		expect(mounted).toEqual(["/islands/Widget.js"]);

		await disposeIslands(rootOf([widget]));
		expect(unmounted).toEqual(["/islands/Widget.js"]);
		expect(widget.dataset.hydrated).toBeUndefined();

		const chart = island({ src: "/islands/Chart.js", renderStrategy: "client-only", props: "{}" });
		scanAndHydrate(rootOf([chart]));
		await flush();
		expect(mounted).toEqual(["/islands/Widget.js", "/islands/Chart.js"]);
	});
});
