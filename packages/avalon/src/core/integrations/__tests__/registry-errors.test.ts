import { describe, expect, it } from "vitest";
import { activateSingleIntegration } from "../../../vite-plugin/integration-activator.ts";
import { IntegrationRegistry, integrationLoadError, isModuleNotFound } from "../registry.ts";

function notFound(message: string, code = "ERR_MODULE_NOT_FOUND"): Error {
	return Object.assign(new Error(message), { code });
}

describe("isModuleNotFound", () => {
	it("matches a missing @useavalon package", () => {
		expect(
			isModuleNotFound(
				notFound("Cannot find package '@useavalon/react' from '/app/x.js'"),
				"@useavalon/react",
			),
		).toBe(true);
		expect(
			isModuleNotFound(new Error("Cannot find module '@useavalon/react'"), "@useavalon/react"),
		).toBe(true);
	});

	it("matches Bun's ResolveMessage, which is not an Error instance", () => {
		// Bun reports unresolved imports as a plain object with `message` and `code`.
		const resolveMessage = {
			message: "Cannot find module '@useavalon/preact' from '/app/registry.ts'",
			code: "ERR_MODULE_NOT_FOUND",
		};
		expect(resolveMessage instanceof Error).toBe(false);
		expect(isModuleNotFound(resolveMessage, "@useavalon/preact")).toBe(true);
		expect(isModuleNotFound(resolveMessage, "@useavalon/react")).toBe(false);
	});

	it("does not match values without a message", () => {
		expect(isModuleNotFound({ code: "ERR_MODULE_NOT_FOUND" }, "@useavalon/preact")).toBe(false);
		expect(isModuleNotFound(undefined, "@useavalon/preact")).toBe(false);
		expect(isModuleNotFound("Cannot find module '@useavalon/preact'", "@useavalon/preact")).toBe(
			false,
		);
	});

	it("does not match a missing transitive dependency", () => {
		expect(
			isModuleNotFound(
				notFound("Cannot find module 'react-dom/server' imported from @useavalon/react/server.js"),
				"@useavalon/react",
			),
		).toBe(false);
	});

	it("ignores the importer named after the missing specifier", () => {
		expect(
			isModuleNotFound(
				notFound("Cannot find package 'react-dom' imported from '@useavalon/react'"),
				"@useavalon/react",
			),
		).toBe(false);
		expect(
			isModuleNotFound(
				notFound('Cannot find module "react-dom/server" from "@useavalon/react"'),
				"@useavalon/react",
			),
		).toBe(false);
	});

	it("does not match other import errors", () => {
		expect(
			isModuleNotFound(
				new TypeError("Expected CommonJS module to have a function wrapper"),
				"@useavalon/react",
			),
		).toBe(false);
	});
});

describe("integrationLoadError", () => {
	it("keeps the original error as cause and repeats its message", () => {
		const cause = new TypeError("Expected CommonJS module to have a function wrapper");
		const error = integrationLoadError("react", "@useavalon/react", cause);
		expect(error.cause).toBe(cause);
		expect(error.message).toContain("Expected CommonJS module to have a function wrapper");
		expect(error.message).not.toContain("installed");
	});

	it("suggests installing only when the package itself is missing", () => {
		const cause = notFound("Cannot find package '@useavalon/react' from '/app'");
		const error = integrationLoadError("react", "@useavalon/react", cause);
		expect(error.cause).toBe(cause);
		expect(error.message).toContain("@useavalon/react is not installed");
		expect(error.message).toContain("bun add @useavalon/react");
	});
});

describe("IntegrationRegistry.load", () => {
	it("reports a missing integration package with the resolver error as cause", async () => {
		const registry = new IntegrationRegistry();
		const error = (await registry.load("not-a-framework").catch((e) => e)) as Error;
		expect(error.message).toContain("@useavalon/not-a-framework is not installed");
		expect(error.cause).toBeInstanceOf(Error);
	});
});

describe("activateSingleIntegration", () => {
	it("does not claim an installed integration is missing", async () => {
		// Monorepo: @useavalon/preact resolves, so any failure would be a real import error.
		const active = new Set<"preact">();
		await expect(activateSingleIntegration("preact", active)).resolves.toBe(true);
	});
});
