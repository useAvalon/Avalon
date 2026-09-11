import { describe, expect, it } from "vitest";
import { clientEntryImportLines, resolveHydrationMode } from "../hydration-mode.ts";

describe("resolveHydrationMode", () => {
	it("uses entry-client in dev and when clientRouter is on", () => {
		expect(resolveHydrationMode(true, false)).toBe("entry-client");
		expect(resolveHydrationMode(false, true)).toBe("entry-client");
		expect(resolveHydrationMode(true, true)).toBe("entry-client");
	});

	it("uses per-island in production when clientRouter is off", () => {
		expect(resolveHydrationMode(false, false)).toBe("per-island");
	});
});

describe("clientEntryImportLines", () => {
	it("imports the shared runtime and router when clientRouter is on in production", () => {
		const lines = clientEntryImportLines(false, true);
		expect(lines.some((l) => l.includes("client/main-slim"))).toBe(true);
		expect(lines.some((l) => l.includes("client/router"))).toBe(true);
	});

	it("does not import a shared runtime in production without clientRouter", () => {
		const lines = clientEntryImportLines(false, false);
		expect(lines.join("\n")).toContain("Per-island hydration mode");
		expect(lines.join("\n")).not.toContain("client/router");
	});
});
