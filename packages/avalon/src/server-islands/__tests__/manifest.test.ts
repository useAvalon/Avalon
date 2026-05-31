import { beforeEach, describe, expect, it } from "vitest";
import {
	addToManifest,
	clearManifest,
	generateComponentId,
	getManifest,
	lookupComponent,
} from "../manifest";

describe("manifest", () => {
	beforeEach(() => {
		clearManifest();
	});

	describe("generateComponentId", () => {
		it("returns a 12-character string", () => {
			const id = generateComponentId("src/components/UserAvatar.tsx");
			expect(id).toHaveLength(12);
		});

		it("produces URL-safe characters (base64url)", () => {
			const id = generateComponentId("src/components/UserAvatar.tsx");
			// base64url uses only alphanumeric, dash, and underscore
			expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
		});

		it("is deterministic for the same path", () => {
			const id1 = generateComponentId("src/components/UserAvatar.tsx");
			const id2 = generateComponentId("src/components/UserAvatar.tsx");
			expect(id1).toBe(id2);
		});

		it("produces different IDs for different paths", () => {
			const id1 = generateComponentId("src/components/UserAvatar.tsx");
			const id2 = generateComponentId("src/components/NotificationBell.tsx");
			expect(id1).not.toBe(id2);
		});
	});

	describe("addToManifest / lookupComponent", () => {
		it("stores and retrieves a component by ID", () => {
			addToManifest("abc123def456", "src/components/UserAvatar.tsx");
			expect(lookupComponent("abc123def456")).toBe("src/components/UserAvatar.tsx");
		});

		it("returns undefined for unknown IDs", () => {
			expect(lookupComponent("nonexistent1")).toBeUndefined();
		});

		it("overwrites existing entries with the same ID", () => {
			addToManifest("abc123def456", "src/old/Component.tsx");
			addToManifest("abc123def456", "src/new/Component.tsx");
			expect(lookupComponent("abc123def456")).toBe("src/new/Component.tsx");
		});
	});

	describe("getManifest", () => {
		it("returns an empty object when manifest is empty", () => {
			expect(getManifest()).toEqual({});
		});

		it("returns all entries as a plain object", () => {
			addToManifest("id1_________", "src/A.tsx");
			addToManifest("id2_________", "src/B.tsx");
			expect(getManifest()).toEqual({
				id1_________: "src/A.tsx",
				id2_________: "src/B.tsx",
			});
		});
	});

	describe("clearManifest", () => {
		it("removes all entries", () => {
			addToManifest("abc123def456", "src/components/UserAvatar.tsx");
			clearManifest();
			expect(lookupComponent("abc123def456")).toBeUndefined();
			expect(getManifest()).toEqual({});
		});
	});

	describe("end-to-end: generate ID and register", () => {
		it("works with generateComponentId as the key", () => {
			const path = "src/components/UserAvatar.tsx";
			const id = generateComponentId(path);
			addToManifest(id, path);
			expect(lookupComponent(id)).toBe(path);
		});
	});
});
