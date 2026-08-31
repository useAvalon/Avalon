import { parseSync } from "oxc-parser";
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

/** Asserts the transformed TSX is valid — including `await` only inside async functions. */
function expectParses(code: string): void {
	const oxc = parseSync("page.tsx", code, { lang: "tsx", range: true });
	expect(oxc.errors.map((e) => e.message)).toEqual([]);

	const result = ts.transpileModule(code, {
		reportDiagnostics: true,
		compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ESNext },
	});
	const errors = (result.diagnostics ?? [])
		.filter((d) => d.category === ts.DiagnosticCategory.Error)
		.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
	expect(errors).toEqual([]);
}

describe("pageIslandTransform — async enclosing function", () => {
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

describe("pageIslandTransform — nested helpers and list maps", () => {
	it("makes a .map() callback async and wraps it in Promise.all", () => {
		const code = `import DeleteButton from "../components/DeleteButton.react.tsx";
export default function Page({ items }: { items: { id: string }[] }) {
  return (
    <ul>
      {items.map((item) => (
        <DeleteButton
          island={{ condition: "on:client" }}
          projectId={item.id}
        />
      ))}
    </ul>
  );
}`;
		const out = runTransform(code);
		expect(out).toContain("export default async function Page");
		expect(out).toContain("await Promise.all(");
		expect(out).toContain("async (item) =>");
		expect(out).toContain("await __pageRenderIsland(");
		expect(out).not.toMatch(/\.map\(\s*\(item\)\s*=>/);
		expectParses(out);
	});

	it("does not double-wrap a map already inside Promise.all", () => {
		const code = `import DeleteButton from "../components/DeleteButton.react.tsx";
export default async function Page({ items }: { items: { id: string }[] }) {
  const tiles = await Promise.all(
    items.map(async (item) => (
      <DeleteButton island={{ condition: "on:client" }} projectId={item.id} />
    )),
  );
  return <ul>{tiles}</ul>;
}`;
		const out = runTransform(code);
		expect(out.match(/Promise\.all\(/g)).toHaveLength(1);
		expectParses(out);
	});

	it("makes a nested helper async and rewrites its JSX usage in a list", () => {
		const code = `import DeleteButton from "../components/DeleteButton.react.tsx";

function Card({ id, name }: { id: string; name: string }) {
  return (
    <article>
      <h2>{name}</h2>
      <DeleteButton
        island={{ condition: "on:client" }}
        projectId={id}
      />
    </article>
  );
}

export default function Page({ items }: { items: { id: string; name: string }[] }) {
  return (
    <ul>
      {items.map((item) => (
        <Card key={item.id} id={item.id} name={item.name} />
      ))}
    </ul>
  );
}`;
		const out = runTransform(code);
		expect(out).toContain("async function Card");
		expect(out).toContain("export default async function Page");
		expect(out).toContain("await Card(");
		expect(out).toContain("await Promise.all(");
		expect(out).toContain("async (item) =>");
		expect(out).not.toMatch(/<Card[\s>]/);
		expectParses(out);
	});

	it("makes a const-arrow helper async and rewrites its JSX usage", () => {
		const code = `import Toggle from "../components/Toggle.tsx";
const Row = ({ id }: { id: string }) => (
  <li><Toggle island={{ condition: "on:interaction" }} id={id} /></li>
);
export default function Page({ ids }: { ids: string[] }) {
  return <ul>{ids.map((id) => <Row key={id} id={id} />)}</ul>;
}`;
		const out = runTransform(code);
		expect(out).toMatch(/const Row = async\s*\(/);
		expect(out).toContain("await Row(");
		expect(out).toContain("await Promise.all(");
		expectParses(out);
	});

	it("makes a .map(function) callback async and wraps it", () => {
		const code = `import DeleteButton from "../components/DeleteButton.tsx";
export default function Page({ items }: { items: { id: string }[] }) {
  return (
    <ul>
      {items.map(function (item) {
        return <DeleteButton island={{ condition: "on:client" }} projectId={item.id} />;
      })}
    </ul>
  );
}`;
		const out = runTransform(code);
		expect(out).toContain("async function (item)");
		expect(out).toContain("await Promise.all(");
		expectParses(out);
	});

	it("wraps two list islands independently", () => {
		const code = `import Button from "../components/Button.tsx";
export default function Page({ live, draft }: { live: { id: string }[]; draft: { id: string }[] }) {
  return (
    <div>
      {live.map((item) => <Button island={{ condition: "on:client" }} id={item.id} />)}
      {draft.map((item) => <Button island={{ condition: "on:client" }} id={item.id} />)}
    </div>
  );
}`;
		const out = runTransform(code);
		expect(out.match(/await Promise\.all\(/g)).toHaveLength(2);
		expectParses(out);
	});

	it("handles a typed .map() callback", () => {
		const code = `import DeleteButton from "../components/DeleteButton.tsx";
export default function Page({ items }: { items: { id: string }[] }) {
  return (
    <ul>
      {items.map((item): JSX.Element => (
        <DeleteButton island={{ condition: "on:client" }} projectId={item.id} />
      ))}
    </ul>
  );
}`;
		const out = runTransform(code);
		expect(out).toContain("async (item): JSX.Element =>");
		expect(out).toContain("await Promise.all(");
		expectParses(out);
	});

	it("errors when an island sits in a class method", () => {
		const code = `import Counter from "../components/Counter.tsx";
export default class Page {
  render() {
    return <div><Counter island={{ condition: "on:client" }} /></div>;
  }
}`;
		expect(() => runTransform(code)).toThrow(/method/);
	});

	it("errors when an island sits in a sync generator", () => {
		const code = `import Counter from "../components/Counter.tsx";
export default function* Page() {
  yield <div><Counter island={{ condition: "on:client" }} /></div>;
}`;
		expect(() => runTransform(code)).toThrow(/generator/);
	});

	it("wraps items?.map so Promise.all is not called with undefined", () => {
		const code = `import Button from "../components/Button.tsx";
export default function Page({ items }: { items?: { id: string }[] }) {
  return <div>{items?.map((item) => <Button island={{ condition: "on:client" }} id={item.id} />)}</div>;
}`;
		const out = runTransform(code);
		expect(out).toContain("await Promise.all(");
		expect(out).toContain(" ?? [])");
		expectParses(out);
	});

	it("rewrites .flatMap to map + Promise.all + flat so async callbacks still flatten", () => {
		const code = `import Button from "../components/Button.tsx";
export default function Page({ groups }: { groups: { id: string }[][] }) {
  return <div>{groups.flatMap((group) => group.map((item) => <Button island={{ condition: "on:client" }} id={item.id} />))}</div>;
}`;
		const out = runTransform(code);
		expect(out).not.toContain(".flatMap(");
		expect(out).toContain(")).flat()");
		expect(out.match(/await Promise\.all\(/g)?.length).toBeGreaterThanOrEqual(2);
		expectParses(out);
	});

	it("wraps a nested .map after the inner wrap inserts await", () => {
		const code = `import Button from "../components/Button.tsx";
export default function Page({ groups }: { groups: { id: string }[][] }) {
  return (
    <div>
      {groups.map((group) =>
        group.map((item) => <Button island={{ condition: "on:client" }} id={item.id} />),
      )}
    </div>
  );
}`;
		const out = runTransform(code);
		expect(out.match(/await Promise\.all\(/g)).toHaveLength(2);
		expect(out).toContain("async (group) =>");
		expect(out).toContain("async (item) =>");
		expectParses(out);
	});

	it("wraps items.map(Card) when Card is a local async helper", () => {
		const code = `import DeleteButton from "../components/DeleteButton.tsx";
function Card({ id }: { id: string }) {
  return <li><DeleteButton island={{ condition: "on:client" }} projectId={id} /></li>;
}
export default function Page({ items }: { items: { id: string }[] }) {
  return <ul>{items.map(Card)}</ul>;
}`;
		const out = runTransform(code);
		expect(out).toContain("async function Card");
		expect(out).toContain("await Promise.all(");
		expect(out).toContain("items.map(Card)");
		expectParses(out);
	});

	it("makes a helper async when it is used once, not in a list", () => {
		const code = `import Toggle from "../components/Toggle.tsx";
function Card() {
  return <div><Toggle island={{ condition: "on:interaction" }} /></div>;
}
export default function Page() {
  return <section><Card /></section>;
}`;
		const out = runTransform(code);
		expect(out).toContain("async function Card");
		expect(out).toContain("await Card(");
		expect(out).not.toMatch(/<Card[\s>/]/);
		expectParses(out);
	});

	it("propagates async through nested helpers", () => {
		const code = `import Toggle from "../components/Toggle.tsx";
function Row() {
  return <li><Toggle island={{ condition: "on:client" }} /></li>;
}
function Card() {
  return <ul><Row /></ul>;
}
export default function Page() {
  return <section><Card /></section>;
}`;
		const out = runTransform(code);
		expect(out).toContain("async function Row");
		expect(out).toContain("async function Card");
		expect(out).toContain("await Row(");
		expect(out).toContain("await Card(");
		expectParses(out);
	});

	it("makes an unparenthesized map arrow async", () => {
		const code = `import Button from "../components/Button.tsx";
export default function Page({ items }: { items: { id: string }[] }) {
  return <div>{items.map(item => <Button island={{ condition: "on:client" }} id={item.id} />)}</div>;
}`;
		const out = runTransform(code);
		expect(out).toContain("async item =>");
		expect(out).toContain("await Promise.all(");
		expectParses(out);
	});

	it("errors when an island sits in a forEach callback", () => {
		const code = `import Button from "../components/Button.tsx";
export default function Page({ items }: { items: { id: string }[] }) {
  const nodes = [];
  items.forEach((item) => {
    nodes.push(<Button island={{ condition: "on:client" }} id={item.id} />);
  });
  return <div>{nodes}</div>;
}`;
		expect(() => runTransform(code)).toThrow(/forEach\(\) callback/);
	});
});

describe("pageIslandTransform — JSX position", () => {
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

	it("emits a bare await when the island is the page's only return", () => {
		const code = `import Counter from "../components/Counter.tsx";
export default function Page() {
  return <Counter island={{ condition: "on:client" }} />;
}`;
		const out = runTransform(code);
		expect(out).toContain("return await __pageRenderIsland(");
		expect(out).not.toContain("return {await");
		expectParses(out);
	});

	it("emits a bare await for a parenthesized sole-island return", () => {
		const code = `import Counter from "../components/Counter.tsx";
export default function Page() {
  return (
    <Counter island={{ condition: "on:client" }} />
  );
}`;
		const out = runTransform(code);
		expect(out).toMatch(/return\s*\(\s*await __pageRenderIsland\(/);
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
