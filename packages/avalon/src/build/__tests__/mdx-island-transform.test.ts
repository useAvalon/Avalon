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

	it("auto-wraps Qwik components without an island prop (ssrOnly)", () => {
		const code = `import DocsLiveFrame from "../components/DocsLiveFrame.tsx";
import QwikCounter from "../../demo/components/Counter.qwik.tsx";
function _createMdxContent(props) {
  return _jsxDEV(DocsLiveFrame, { label: "Live", children: _jsxDEV(QwikCounter, {}) });
}
export default function MDXContent(props = {}) {
  return _createMdxContent(props);
}
`;
		const out = runTransform(code);
		expect(out).toContain("__AvalonRenderIsland");
		expect(out).toContain('framework: "qwik"');
		expect(out).toContain("ssrOnly: true");
		expect(out).toContain("component: QwikCounter");
		expect(out).toContain("_jsxDEV(DocsLiveFrame");
		expect(out).not.toMatch(/_jsxDEV\(QwikCounter/);
	});

	it("omits the component binding for ssr: false islands", () => {
		const code = `import BrowserCounter from "../demo/components/BrowserCounter.tsx";
function _createMdxContent(props) {
  return _jsxDEV(BrowserCounter, { island: { ssr: false } });
}
export default function MDXContent(props = {}) {
  return _createMdxContent(props);
}
`;
		const out = runTransform(code);
		expect(out).toContain("__AvalonRenderIsland");
		expect(out).not.toContain("component: BrowserCounter");
		expect(out).toContain("ssr: false");
	});
});

describe("mdxIslandTransform — renderIsland import", () => {
	const body = `function _createMdxContent(props) {
  return _jsxDEV(Counter, { island: { condition: "on:visible" } });
}
export default function MDXContent(props = {}) {
  return _createMdxContent(props);
}
`;

	it("adds the import when the binding name only appears inside a string", () => {
		const code = `import Counter from "../components/Counter.tsx";
const note = "import { renderIsland as __AvalonRenderIsland } from somewhere";
${body}`;
		const out = runTransform(code);
		expect(out).toContain(
			'import { renderIsland as __AvalonRenderIsland } from "@useavalon/avalon/islands/island";',
		);
	});

	it("does not add a second import when the binding is already imported", () => {
		const code = `import Counter from "../components/Counter.tsx";
import { renderIsland as __AvalonRenderIsland } from "@useavalon/avalon/islands/island";
${body}`;
		const out = runTransform(code);
		expect(out.match(/as __AvalonRenderIsland \}/g)).toHaveLength(1);
	});
});

describe("mdxIslandTransform — server islands", () => {
	const wrap = (call: string) => `import ServerTime from "../demo/components/ServerTime.tsx";
import Bell from "../demo/components/Bell.react.tsx";
function _createMdxContent(props) {
  return ${call};
}
export default function MDXContent(props = {}) {
  return _createMdxContent(props);
}
`;

	it("turns a component with a server prop into a server island render call", () => {
		const out = runTransform(
			wrap(`_jsxDEV(ServerTime, { server: { timeout: 5000 }, label: "now" })`),
		);
		expect(out).toContain("await __AvalonRenderIsland");
		expect(out).toMatch(/src: "[^"]*ServerTime\.tsx"/);
		expect(out).toContain("component: ServerTime");
		expect(out).toContain("server: ({ timeout: 5000 })");
		expect(out).toContain('props: { label: "now" }');
		expect(out).not.toContain("_jsxDEV(ServerTime");
		expect(out).toContain("async function _createMdxContent(");
	});

	it("keeps JSX in the fallback", () => {
		const out = runTransform(
			wrap(`_jsxDEV(ServerTime, { server: { fallback: _jsxDEV("p", { children: "Loading" }) } })`),
		);
		expect(out).toContain('server: ({ fallback: _jsxDEV("p", { children: "Loading" }) })');
	});

	it("passes an island prop alongside the server prop", () => {
		const out = runTransform(
			wrap(
				`_jsxDEV(Bell, { server: { fallback: null }, island: { condition: "on:client" }, userId: "u" })`,
			),
		);
		expect(out).toContain("server: ({ fallback: null })");
		expect(out).toContain('island: ({ condition: "on:client" })');
		expect(out).toContain('props: { userId: "u" }');
		expect(out).toContain('framework: "react"');
	});

	it("registers the component in the server island manifest", async () => {
		const { getManifest } = await import("../../server-islands/manifest.ts");
		runTransform(wrap(`_jsxDEV(ServerTime, { server: {} })`));
		expect(Object.values(getManifest()).some((src) => src.endsWith("/ServerTime.tsx"))).toBe(true);
	});

	it("ignores a server key that belongs to a child component", () => {
		const code = `import Frame from "../components/Frame.tsx";
import ServerTime from "../demo/components/ServerTime.tsx";
function _createMdxContent(props) {
  return _jsxDEV(Frame, { label: "x", children: _jsxDEV(ServerTime, { server: {} }) });
}
`;
		const out = runTransform(code);
		expect(out).toContain("_jsxDEV(Frame");
		expect(out).not.toMatch(/src: "[^"]*Frame\.tsx"/);
		expect(out).toMatch(/src: "[^"]*ServerTime\.tsx"/);
	});
});
