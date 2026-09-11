import { describe, expect, it } from "vitest";
import { ROUTER_EVENTS } from "../events.ts";

describe("router events", () => {
	it("uses the avalon: prefix", () => {
		expect(ROUTER_EVENTS.beforeNavigate).toBe("avalon:before-navigate");
		expect(ROUTER_EVENTS.beforeSwap).toBe("avalon:before-swap");
		expect(ROUTER_EVENTS.afterSwap).toBe("avalon:after-swap");
		expect(ROUTER_EVENTS.pageLoad).toBe("avalon:page-load");
		expect(ROUTER_EVENTS.navigationError).toBe("avalon:navigation-error");
	});
});
