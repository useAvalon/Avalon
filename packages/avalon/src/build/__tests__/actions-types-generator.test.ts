import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateActionTypes } from "../actions-types-generator.ts";

describe("generateActionTypes", () => {
	it("types avalon/actions and keeps the virtual alias", () => {
		const root = mkdtempSync(join(tmpdir(), "avalon-actions-"));
		const actionsDir = join(root, "app", "actions");
		mkdirSync(actionsDir, { recursive: true });
		writeFileSync(join(actionsDir, "index.ts"), "export const server = {};\n");

		const result = generateActionTypes(root);
		expect(result.generated).toBe(true);

		const declaration = readFileSync(join(root, "app", "avalon-actions.d.ts"), "utf8");
		expect(declaration).toContain('declare module "avalon/actions"');
		expect(declaration).toContain('declare module "virtual:avalon/actions"');
	});

	it("does nothing when the project has no actions entry", () => {
		const root = mkdtempSync(join(tmpdir(), "avalon-actions-empty-"));
		expect(generateActionTypes(root)).toEqual({ generated: false });
	});
});
