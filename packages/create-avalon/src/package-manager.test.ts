import { describe, expect, it } from "vitest";
import { commandsFor, detectPackageManager } from "./package-manager";

describe("detectPackageManager", () => {
	it("reads bun from the user agent even when npm/ is present", () => {
		expect(detectPackageManager("bun/1.2.3 npm/? node/v22.0.0 darwin arm64", false)).toBe("bun");
	});

	it("reads npm, pnpm, and yarn from the user agent", () => {
		expect(detectPackageManager("npm/10.9.0 node/v22.11.0 darwin arm64", false)).toBe("npm");
		expect(detectPackageManager("pnpm/9.12.0 npm/? node/v22.11.0 darwin arm64", false)).toBe(
			"pnpm",
		);
		expect(detectPackageManager("yarn/4.5.0 npm/? node/v22.11.0 darwin arm64", false)).toBe("yarn");
		expect(detectPackageManager("yarn/1.22.22 npm/? node/v16.20.0 darwin x64", false)).toBe(
			"yarn-classic",
		);
	});

	it("falls back to the current runtime when the user agent is empty", () => {
		expect(detectPackageManager("", true)).toBe("bun");
		expect(detectPackageManager("", false)).toBe("npm");
	});
});

describe("commandsFor", () => {
	it("uses npm run and npx", () => {
		const cmd = commandsFor("npm");
		expect(cmd.install).toBe("npm install");
		expect(cmd.run("preview")).toBe("npm run preview");
		expect(cmd.exec("wrangler@4")).toBe("npx wrangler@4");
	});

	it("uses bun run and bunx", () => {
		const cmd = commandsFor("bun");
		expect(cmd.install).toBe("bun install");
		expect(cmd.run("dev")).toBe("bun run dev");
		expect(cmd.exec("netlify-cli@22")).toBe("bunx netlify-cli@22");
	});

	it("invokes pnpm scripts with run", () => {
		const cmd = commandsFor("pnpm");
		expect(cmd.run("preview")).toBe("pnpm run preview");
		expect(cmd.exec("wrangler@4")).toBe("pnpm dlx wrangler@4");
	});

	it("uses yarn dlx on Berry and npx on Classic", () => {
		expect(commandsFor("yarn").exec("wrangler@4")).toBe("yarn dlx wrangler@4");
		expect(commandsFor("yarn-classic").exec("wrangler@4")).toBe("npx wrangler@4");
		expect(commandsFor("yarn-classic").run("dev")).toBe("yarn dev");
	});
});
