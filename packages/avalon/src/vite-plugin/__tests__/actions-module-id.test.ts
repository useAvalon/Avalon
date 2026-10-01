import { describe, expect, it } from "vitest";
import { actionsModuleResolvedId, VIRTUAL_MODULE_IDS } from "../nitro-integration.ts";

describe("actionsModuleResolvedId", () => {
	it("resolves the public specifier and the virtual alias to one module", () => {
		const resolved = actionsModuleResolvedId("avalon/actions");
		expect(resolved).toBe(actionsModuleResolvedId(VIRTUAL_MODULE_IDS.ACTIONS));
		expect(resolved).toBe(`\0${VIRTUAL_MODULE_IDS.ACTIONS}`);
	});

	it("ignores other specifiers", () => {
		expect(actionsModuleResolvedId("@useavalon/avalon/actions")).toBeNull();
		expect(actionsModuleResolvedId("virtual:avalon/config")).toBeNull();
	});
});
