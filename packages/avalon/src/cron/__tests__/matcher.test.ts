import { describe, expect, it } from "vitest";
import { hasSecondsField, matchesCron } from "../matcher.ts";

// Helper: build a local Date at the given fields.
const at = (
	parts: Partial<{ y: number; mo: number; d: number; h: number; mi: number; s: number }>,
) =>
	new Date(
		parts.y ?? 2026,
		(parts.mo ?? 1) - 1,
		parts.d ?? 1,
		parts.h ?? 0,
		parts.mi ?? 0,
		parts.s ?? 0,
	);

describe("hasSecondsField", () => {
	it("detects 6-field vs 5-field expressions", () => {
		expect(hasSecondsField("*/30 * * * * *")).toBe(true);
		expect(hasSecondsField("0 0 * * *")).toBe(false);
		expect(hasSecondsField("@daily")).toBe(false);
	});
});

describe("matchesCron", () => {
	it("matches every-30-seconds", () => {
		expect(matchesCron("*/30 * * * * *", at({ s: 0 }))).toBe(true);
		expect(matchesCron("*/30 * * * * *", at({ s: 30 }))).toBe(true);
		expect(matchesCron("*/30 * * * * *", at({ s: 15 }))).toBe(false);
		expect(matchesCron("*/30 * * * * *", at({ s: 45 }))).toBe(false);
	});

	it("matches a specific minute (5-field)", () => {
		expect(matchesCron("0 0 * * *", at({ h: 0, mi: 0 }))).toBe(true);
		expect(matchesCron("0 0 * * *", at({ h: 1, mi: 0 }))).toBe(false);
		expect(matchesCron("30 9 * * *", at({ h: 9, mi: 30 }))).toBe(true);
	});

	it("supports ranges, lists, and steps", () => {
		expect(matchesCron("0 9-17 * * *", at({ h: 12, mi: 0 }))).toBe(true);
		expect(matchesCron("0 9-17 * * *", at({ h: 18, mi: 0 }))).toBe(false);
		expect(matchesCron("0 0,12 * * *", at({ h: 12, mi: 0 }))).toBe(true);
		expect(matchesCron("*/15 * * * *", at({ mi: 45 }))).toBe(true);
		expect(matchesCron("*/15 * * * *", at({ mi: 46 }))).toBe(false);
	});

	it("resolves named aliases", () => {
		// 2026-01-01 is a Thursday.
		expect(matchesCron("@daily", at({ h: 0, mi: 0 }))).toBe(true);
		expect(matchesCron("@hourly", at({ h: 5, mi: 0 }))).toBe(true);
		expect(matchesCron("@hourly", at({ h: 5, mi: 1 }))).toBe(false);
	});

	it("uses OR semantics when both day-of-month and day-of-week are set", () => {
		// 2026-01-01 is a Thursday (dow=4).
		expect(matchesCron("0 0 1 * 0", at({ d: 1, h: 0, mi: 0 }))).toBe(true); // matches dom
		expect(matchesCron("0 0 5 * 4", at({ d: 1, h: 0, mi: 0 }))).toBe(true); // matches dow
		expect(matchesCron("0 0 5 * 0", at({ d: 1, h: 0, mi: 0 }))).toBe(false); // neither
	});

	it("rejects malformed expressions", () => {
		expect(matchesCron("* * *", at({}))).toBe(false);
	});
});
