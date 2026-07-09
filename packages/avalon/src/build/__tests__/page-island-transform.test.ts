import ts from "typescript";
import { describe, expect, it } from "vitest";
import { pageIslandTransform } from "../page-island-transform.ts";

const PAGE_ID = "/project/app/modules/home/pages/index.tsx";

/**
 * Runs the plugin's transform hook and returns the transformed code. Throws if
 * the transform is a no-op (returns null) — every case here uses an island, so
 * a null result is a test failure. Returning a non-nullable `string` keeps the
 * assertions cast-free.
 */
function runTransform(code: string, id = PAGE_ID): string {
	const plugin = pageIslandTransform({
		pagesDir: "src/pages",
		layoutsDir: "src/layouts",
		modules: { dir: "app/modules", pagesDirName: "pages", layoutsDirName: "layouts" },
	});
	const hook = plugin.transform as (
		this: unknown,
		code: string,
		id: string,
	) => { code: string } | null;
	const result = hook.call({}, code, id);
	if (!result) throw new Error("pageIslandTransform returned null (no transform applied)");
	return result.code;
}

/**
 * Asserts the transformed TSX has no syntax errors — this catches the
 * `: ({await …})` ternary parse error the 2b bug produced. (The await-outside-async
 * case from 2a is asserted structurally via the `async` checks below.)
 */
function expectParses(code: string): void {
	const result = ts.transpileModule(code, {
		reportDiagnostics: true,
		compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext },
	});
	const errors = (result.diagnostics ?? [])
		.filter((d) => d.category === ts.DiagnosticCategory.Error)
		.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
	expect(errors).toEqual([]);
}

describe("pageIslandTransform — async enclosing function (2a)", () => {
	it("marks a sync default-export function component async and parses", () => {
		const code = `import Counter from "../components/Counter.tsx";
export default function Page() {
  return (
    <div>
      <Counter island={{ condition: "on:interaction" }} count={1} />
    </div>
  );
}`;
		const out = runTransform(code);
		expect(out).toContain("export default async function Page");
		expect(out).toContain("await __pageRenderIsland(");
		expectParses(out);
	});

	it("marks a default-export arrow component async", () => {
		const code = `import Counter from "../components/Counter.tsx";
export default (props) => (
  <div>
    <Counter island={{ condition: "on:client" }} />
  </div>
);`;
		const out = runTransform(code);
		expect(out).toContain("export default async (props) =>");
		expectParses(out);
	});

	it("marks a referenced default export's declaration async", () => {
		const code = `import Counter from "../components/Counter.tsx";
function Page() {
  return <div><Counter island={{ condition: "on:client" }} /></div>;
}
export default Page;`;
		const out = runTransform(code);
		expect(out).toContain("async function Page");
		expectParses(out);
	});
});

describe("pageIslandTransform — JSX position awareness (2b)", () => {
	it("wraps a bare JSX child in an expression container", () => {
		const code = `import Counter from "../components/Counter.tsx";
export default function Page() {
  return <div><Counter island={{ condition: "on:client" }} /></div>;
}`;
		const out = runTransform(code);
		expect(out).toContain("<div>{await __pageRenderIsland(");
		expectParses(out);
	});

	it("emits a bare call inside a ternary branch (no extra braces) and parses", () => {
		const code = `import AddCardButton from "../components/AddCardButton.tsx";
export default function Billing({ hasCard }) {
  return (
    <div>
      {hasCard ? (
        <p>All set.</p>
      ) : (
        <AddCardButton island={{ condition: "on:interaction" }} />
      )}
    </div>
  );
}`;
		const out = runTransform(code);
		// Must NOT wrap in an extra { } inside the already-open expression container.
		expect(out).not.toContain(": ({await");
		expect(out).not.toContain(": ( {await");
		expect(out).toContain("await __pageRenderIsland(");
		expectParses(out);
	});

	it("emits a bare call inside a logical && branch and parses", () => {
		const code = `import Banner from "../components/Banner.tsx";
export default function Page({ show }) {
  return <div>{show && <Banner island={{ condition: "on:visible" }} />}</div>;
}`;
		const out = runTransform(code);
		expect(out).toContain("show && await __pageRenderIsland(");
		expectParses(out);
	});
});

describe("pageIslandTransform — leaves verbatim regions alone", () => {
	it("does not transform island usage inside a template literal or comment", () => {
		const code = `import Counter from "../components/Counter.tsx";
const example = \`<Counter island={{ condition: "on:client" }} />\`;
// <Counter island={{ condition: "on:client" }} />
export default function Page() {
  return <div><Counter island={{ condition: "on:client" }} /></div>;
}`;
		const out = runTransform(code);
		// Exactly one real usage is transformed; the string + comment copies remain intact.
		expect(out.match(/__pageRenderIsland\(/g)).toHaveLength(1);
		expect(out).toContain('`<Counter island={{ condition: "on:client" }} />`');
		expect(out).toContain('// <Counter island={{ condition: "on:client" }} />');
	});
});
