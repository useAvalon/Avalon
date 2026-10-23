import { afterEach, describe, expect, it, vi } from "vitest";
import { runCountdownDirective } from "../shared/hydration/countdown.ts";

afterEach(() => {
	vi.useRealTimers();
});

describe("runCountdownDirective", () => {
	it("updates the badge each second and hydrates when the timer elapses", () => {
		vi.useFakeTimers();
		const badge = {
			textContent: "",
			style: {} as { transition?: string; opacity?: string },
			remove: vi.fn(),
		};
		const el = {
			querySelector() {
				return badge;
			},
		} as unknown as HTMLElement;

		let hydrated = false;
		runCountdownDirective(
			el,
			() => {
				hydrated = true;
			},
			"2",
		);

		expect(badge.textContent).toBe("Hydrates in 2s...");
		expect(hydrated).toBe(false);

		vi.advanceTimersByTime(1000);
		expect(badge.textContent).toBe("Hydrates in 1s...");
		expect(hydrated).toBe(false);

		vi.advanceTimersByTime(1000);
		expect(badge.textContent).toBe("Hydrates in 0s...");
		expect(hydrated).toBe(true);
	});
});
