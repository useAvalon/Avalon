import { getPrevNext, SIDEBAR } from "@shared/utils/sidebar.ts";
import { describe, expect, it } from "vitest";

describe("Docs layout navigation", () => {
	it("sidebar lists Cross-Island State under core concepts", () => {
		const core = SIDEBAR.find((section) => section.label === "CORE CONCEPTS");
		expect(core?.items.some((item) => item.href === "/docs/guides/cross-island-state")).toBe(true);
	});

	it("getPrevNext chains islands architecture → cross-island → hydration", () => {
		const cross = getPrevNext("/docs/guides/cross-island-state");
		expect(cross.prev?.href).toBe("/docs/islands-architecture");
		expect(cross.next?.href).toBe("/docs/hydration-strategies");

		const islands = getPrevNext("/docs/islands-architecture");
		expect(islands.next?.href).toBe("/docs/guides/cross-island-state");
	});
});
