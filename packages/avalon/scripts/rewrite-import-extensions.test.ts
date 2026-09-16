import { describe, expect, it } from "vitest";
import { rewriteImportExtensions } from "./rewrite-import-extensions.ts";

describe("rewriteImportExtensions", () => {
	it("rewrites static .ts and .tsx imports to .js", () => {
		expect(rewriteImportExtensions(`import { scan } from "./hydrate-runtime.ts";`)).toBe(
			`import { scan } from "./hydrate-runtime.js";`,
		);
		expect(rewriteImportExtensions(`export { boot } from "./server-islands-boot.ts";`)).toBe(
			`export { boot } from "./server-islands-boot.js";`,
		);
		expect(rewriteImportExtensions(`import Comp from "./Island.tsx";`)).toBe(
			`import Comp from "./Island.js";`,
		);
	});

	it("rewrites dynamic and side-effect TypeScript imports", () => {
		expect(rewriteImportExtensions(`await import("./hydrate-runtime.ts");`)).toBe(
			`await import("./hydrate-runtime.js");`,
		);
		expect(rewriteImportExtensions(`import "./boot.ts";`)).toBe(`import "./boot.js";`);
	});

	it("leaves already-compiled .js specifiers alone", () => {
		const src = `import { initializeHMR } from "./hmr-coordinator.js";`;
		expect(rewriteImportExtensions(src)).toBe(src);
	});
});
