import { describe, expect, it } from "vitest";
import { loadQwikWasmBinding } from "../wasm-binding.ts";

describe("loadQwikWasmBinding", () => {
	it("loads the WASM optimizer without native binding warnings", async () => {
		const warnings: unknown[][] = [];
		const original = console.warn;
		console.warn = (...args: unknown[]) => {
			warnings.push(args);
		};
		try {
			const binding = await loadQwikWasmBinding();
			expect(typeof binding.transform_modules).toBe("function");
			expect(
				warnings.some(
					(args) =>
						typeof args[0] === "string" && args[0].includes("Unable to load native binding"),
				),
			).toBe(false);
			expect(
				warnings.some(
					(args) =>
						typeof args[0] === "string" &&
						args[0].includes("deprecated parameters for the initialization function"),
				),
			).toBe(false);
		} finally {
			console.warn = original;
		}
	});
});
