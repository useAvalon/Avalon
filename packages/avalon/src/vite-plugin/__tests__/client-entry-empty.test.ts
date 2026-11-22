import { describe, expect, it } from "vitest";
import { isClientEntryEmpty } from "../nitro-integration.ts";

const chunk = (name: string, code: string, isEntry = true) => ({
	type: "chunk",
	isEntry,
	name,
	code,
});

describe("isClientEntryEmpty", () => {
	it("recognises the entry by its hashed file name when the chunk has no name", () => {
		const bundle = {
			"assets/entry-client-BvRk9kiK.js": { type: "chunk", isEntry: true, code: "" },
			"islands/Table.js": { type: "chunk", isEntry: true, code: "export default 1" },
		};
		expect(isClientEntryEmpty(bundle, "app/entry-client")).toBe(true);
	});

	it("is true when the client entry chunk is empty", () => {
		expect(isClientEntryEmpty({ a: chunk("entry-client", "") }, "app/entry-client")).toBe(true);
		expect(isClientEntryEmpty({ a: chunk("entry-client", "  \n") }, "app/entry-client.ts")).toBe(
			true,
		);
	});

	it("is false when the client entry chunk has code", () => {
		expect(isClientEntryEmpty({ a: chunk("entry-client", "init()") }, "app/entry-client")).toBe(
			false,
		);
	});

	it("ignores island chunks, which are entries with code", () => {
		expect(
			isClientEntryEmpty(
				{
					a: chunk("entry-client", ""),
					b: chunk("ClientSideRenderedTable", "export default 1"),
					c: chunk("shared", "export {}", false),
				},
				"app/entry-client",
			),
		).toBe(true);
	});

	it("follows a custom client entry name", () => {
		const bundle = { a: chunk("main-client", ""), b: chunk("entry-client", "x()") };
		expect(isClientEntryEmpty(bundle, "src/main-client.tsx")).toBe(true);
		expect(isClientEntryEmpty(bundle, "src/entry-client.ts")).toBe(false);
	});

	it("is false when the entry chunk is missing or the bundle has only assets", () => {
		expect(isClientEntryEmpty({}, "app/entry-client")).toBe(false);
		expect(isClientEntryEmpty({ a: { type: "asset" } }, "app/entry-client")).toBe(false);
		expect(isClientEntryEmpty({ a: chunk("other", "") }, "app/entry-client")).toBe(false);
	});
});
