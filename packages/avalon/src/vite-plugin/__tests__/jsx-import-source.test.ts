import { describe, expect, it } from "vitest";
import { jsxImportSourceForFilename, withJsxImportSource } from "../jsx-import-source.ts";

describe("jsxImportSourceForFilename", () => {
	it("maps framework extensions to their JSX runtimes", () => {
		expect(jsxImportSourceForFilename("/app/Counter.react.tsx")).toBe("react");
		expect(jsxImportSourceForFilename("/app/Counter.react.jsx")).toBe("react");
		expect(jsxImportSourceForFilename("/app/Counter.solid.tsx")).toBe("solid-js");
		expect(jsxImportSourceForFilename("/app/Counter.qwik.tsx?html-proxy")).toBe("@builder.io/qwik");
		expect(jsxImportSourceForFilename("/app/Counter.preact.tsx", "react")).toBe("preact");
	});

	it("uses the page-shell runtime for plain jsx and tsx", () => {
		expect(jsxImportSourceForFilename("/app/pages/index.tsx")).toBe("preact");
		expect(jsxImportSourceForFilename("/app/pages/index.jsx", "react")).toBe("react");
	});

	it("skips files Avalon does not compile as JSX", () => {
		expect(jsxImportSourceForFilename("/app/util.ts")).toBeNull();
		expect(jsxImportSourceForFilename("/app/types.d.ts")).toBeNull();
		expect(jsxImportSourceForFilename("/app/Counter.vue")).toBeNull();
		expect(jsxImportSourceForFilename("/app/node_modules/lib/Button.tsx")).toBeNull();
		expect(jsxImportSourceForFilename("\0virtual:avalon/renderer")).toBeNull();
	});
});

describe("withJsxImportSource", () => {
	it("prepends a pragma when the file has none", () => {
		expect(withJsxImportSource("export {}", "preact")).toBe(
			"/** @jsxImportSource preact */\nexport {}",
		);
	});

	it("leaves an explicit pragma in place", () => {
		const code = "/** @jsxImportSource react */\nexport {}";
		expect(withJsxImportSource(code, "preact")).toBeNull();
	});
});
