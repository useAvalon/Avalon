import { describe, expect, it } from "vitest";
import { commandsForPreset } from "../modules/docs/lib/package-manager-commands.ts";

describe("commandsForPreset", () => {
	it("lists bun first in scaffold commands", () => {
		const scaffold = commandsForPreset("scaffold");
		expect(scaffold.bun[0]).toBe("bun create avalon my-app");
		expect(scaffold.npm[0]).toBe("npm create avalon@latest my-app");
	});

	it("includes dev script variants per package manager", () => {
		const dev = commandsForPreset("dev");
		expect(dev.bun).toEqual(["bun run dev"]);
		expect(dev.pnpm).toEqual(["pnpm dev"]);
	});
});
