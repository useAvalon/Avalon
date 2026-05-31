import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CLI_PATH = resolve(import.meta.dirname, "../../../bin/avalon.ts");

function runCli(...args: string[]): { stdout: string; exitCode: number } {
	try {
		const stdout = execFileSync("bun", ["run", CLI_PATH, ...args], {
			encoding: "utf8",
		});
		return { stdout, exitCode: 0 };
	} catch (err: any) {
		return { stdout: err.stdout ?? "", exitCode: err.status ?? 1 };
	}
}

const KEY_PATTERN = /export AVALON_KEY="([^"]+)"/;

describe("avalon key CLI", () => {
	it("generates a valid base64-encoded 32-byte key", () => {
		const { stdout, exitCode } = runCli("key");
		expect(exitCode).toBe(0);

		// Extract the key from the export line
		const keyMatch = KEY_PATTERN.exec(stdout);
		expect(keyMatch).not.toBeNull();

		const key = keyMatch?.[1] ?? "";
		const buf = Buffer.from(key, "base64");
		expect(buf.length).toBe(32);
	});

	it("outputs instructions for setting AVALON_KEY", () => {
		const { stdout } = runCli("key");
		expect(stdout).toContain("AVALON_KEY");
		expect(stdout).toContain("export AVALON_KEY=");
	});

	it("generates a unique key on each invocation", () => {
		const { stdout: stdout1 } = runCli("key");
		const { stdout: stdout2 } = runCli("key");

		const key1 = KEY_PATTERN.exec(stdout1)?.[1];
		const key2 = KEY_PATTERN.exec(stdout2)?.[1];

		expect(key1).toBeDefined();
		expect(key2).toBeDefined();
		expect(key1).not.toBe(key2);
	});

	it("shows usage when no command is provided", () => {
		const { stdout, exitCode } = runCli();
		expect(exitCode).toBe(1);
		expect(stdout).toContain("Usage: avalon <command>");
		expect(stdout).toContain("key");
	});

	it("shows usage with --help flag", () => {
		const { stdout, exitCode } = runCli("--help");
		expect(exitCode).toBe(0);
		expect(stdout).toContain("Usage: avalon <command>");
	});
});
