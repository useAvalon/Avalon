import { describe, expect, it } from "vitest";
import { mdxIslandTransform } from "../mdx-island-transform.ts";

function runTransform(code: string, id = "/app/modules/docs/pages/demo.mdx"): string {
	const plugin = mdxIslandTransform();
	const configHook = plugin.configResolved as
		| ((config: { resolve: { alias: [] } }) => void)
		| undefined;
	configHook?.({ resolve: { alias: [] } });
	const hook = plugin.transform as (
		this: unknown,
		code: string,
		id: string,
	) => { code: string } | null;
	const result = hook.call({}, code, id);
	if (!result) throw new Error("mdxIslandTransform returned null");
	return result.code;
}

describe("mdxIslandTransform — framework detection", () => {
	it("tags .react. islands as react, not preact", () => {
		const code = `import ReactCounter from "../demo/components/Counter.react.tsx";
function _createMdxContent(props) {
  return _jsxDEV(ReactCounter, { island: { condition: "on:interaction" } });
}
export default function MDXContent(props = {}) {
  return _createMdxContent(props);
}
`;
		const out = runTransform(code);
		expect(out).toContain('framework: "react"');
		expect(out).not.toContain('framework: "preact"');
		expect(out).toContain("component: ReactCounter");
		expect(out).toContain('import ReactCounter from "../demo/components/Counter.react.tsx"');
		expect(out).toContain("async function _createMdxContent(");
	});

	it("does not treat a wrapper as an island when a child has the island prop", () => {
		const code = `import DocsLiveFrame from "../components/DocsLiveFrame.tsx";
import ActionsDemo from "../demo/components/ActionsDemo.tsx";
function _createMdxContent(props) {
  return _jsxDEV(DocsLiveFrame, { label: "Live", children: _jsxDEV(ActionsDemo, { island: { condition: "on:visible" } }) });
}
export default function MDXContent(props = {}) {
  return _createMdxContent(props);
}
`;
		const out = runTransform(code);
		expect(out).toContain("__AvalonRenderIsland");
		expect(out).toContain("_jsxDEV(DocsLiveFrame");
		expect(out).not.toMatch(/src: "[^"]*DocsLiveFrame\.tsx"/);
		expect(out).toMatch(/src: "[^"]*ActionsDemo\.tsx"/);
		expect(out).toContain("component: ActionsDemo");
	});

	it("omits the component binding for client-only islands", () => {
		const code = `import BrowserCounter from "../demo/components/BrowserCounter.tsx";
function _createMdxContent(props) {
  return _jsxDEV(BrowserCounter, { island: { clientOnly: true } });
}
export default function MDXContent(props = {}) {
  return _createMdxContent(props);
}
`;
		const out = runTransform(code);
		expect(out).toContain("__AvalonRenderIsland");
		expect(out).not.toContain("component: BrowserCounter");
		expect(out).toContain("clientOnly: true");
	});
});
