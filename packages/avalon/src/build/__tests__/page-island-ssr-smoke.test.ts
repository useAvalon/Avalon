import { transformSync } from "oxc-transform";
import { Fragment, h } from "preact";
import renderToString from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import { pageIslandTransform } from "../page-island-transform.ts";

const PAGE_ID = "/project/app/modules/home/pages/index.tsx";

function runTransform(code: string): string {
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
	const result = hook.call({}, code, PAGE_ID);
	if (!result) throw new Error("pageIslandTransform returned null (no transform applied)");
	return result.code;
}

/**
 * Stand-in for `renderIsland` so the smoke test exercises the rewritten page
 * (async functions, Promise.all, sole-child returns) without loading Vite.
 */
async function mockRenderIsland(opts: {
	src: string;
	props?: Record<string, unknown>;
	key?: string | number;
}): Promise<ReturnType<typeof h>> {
	const vnode = h("avalon-island", { "data-src": opts.src, ...(opts.props ?? {}) });
	return mockWithListKey(opts.key, vnode);
}

/** Stand-in for `withListKey` so keyed helper rewrites resolve in `new Function`. */
function mockWithListKey(key: unknown, vnode: ReturnType<typeof h>): ReturnType<typeof h> {
	if (key === undefined || key === null) return vnode;
	return h(Fragment, { key }, vnode);
}

/**
 * Transform → compile JSX → run the page like Nitro does (`await Page(props)`,
 * then `renderToString`). Matches the SSR contract in `renderPageComponent`.
 */
async function renderPage(source: string, props: Record<string, unknown> = {}): Promise<string> {
	const transformed = runTransform(source);
	const stripped = transformed.replaceAll(/^import\s.+from\s+['"][^'"]+['"];?\s*$/gm, "").trim();
	const compiled = transformSync("page.tsx", stripped, {
		typescript: { onlyRemoveTypeImports: false },
		jsx: { runtime: "classic", pragma: "h", pragmaFrag: "Fragment" },
	});
	expect(compiled.errors.map((e) => e.message)).toEqual([]);

	const importNames = [...source.matchAll(/^import\s+([A-Z]\w*)\s+from/gm)].map((m) => m[1]);
	const prelude = importNames.map((name) => `const ${name} = null;`).join("\n");
	const body = `${prelude}\n${compiled.code.replaceAll(/\bexport\s+default\s+/g, "")}\nreturn Page;`;
	const Page = new Function("h", "Fragment", "__pageRenderIsland", "__pageKeyed", body)(
		h,
		Fragment,
		mockRenderIsland,
		mockWithListKey,
	) as (p: Record<string, unknown>) => Promise<unknown>;

	const vnode = await Page(props);
	return renderToString(vnode as Parameters<typeof renderToString>[0]);
}

describe("page island SSR smoke", () => {
	it("renders a page whose only child is an island", async () => {
		const html = await renderPage(`import Counter from "../components/Counter.tsx";
export default function Page() {
  return <Counter island={{ condition: "on:client" }} label="solo" />;
}`);
		expect(html).toContain("<avalon-island");
		expect(html).toContain('label="solo"');
		expect(html).not.toContain("<div");
	});

	it("renders a parenthesized sole-island return", async () => {
		const html = await renderPage(`import Counter from "../components/Counter.tsx";
export default function Page() {
  return (
    <Counter island={{ condition: "on:client" }} label="paren" />
  );
}`);
		expect(html).toContain("<avalon-island");
		expect(html).toContain('label="paren"');
	});

	it("renders a list of islands through Promise.all", async () => {
		const html = await renderPage(
			`import Button from "../components/Button.tsx";
export default function Page({ items }: { items: { id: string }[] }) {
  return (
    <ul>
      {items.map((item) => (
        <Button island={{ condition: "on:client" }} id={item.id} />
      ))}
    </ul>
  );
}`,
			{ items: [{ id: "a" }, { id: "b" }, { id: "c" }] },
		);
		expect(html.match(/<avalon-island/g)).toHaveLength(3);
		expect(html).toContain('id="a"');
		expect(html).toContain('id="b"');
		expect(html).toContain('id="c"');
	});

	it("renders islands inside a nested helper used from .map()", async () => {
		const html = await renderPage(
			`import DeleteButton from "../components/DeleteButton.tsx";
function Card({ id, name }: { id: string; name: string }) {
  return (
    <li>
      <span>{name}</span>
      <DeleteButton island={{ condition: "on:client" }} projectId={id} />
    </li>
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
}`,
			{
				items: [
					{ id: "1", name: "alpha" },
					{ id: "2", name: "beta" },
				],
			},
		);
		expect(html.match(/<avalon-island/g)).toHaveLength(2);
		expect(html).toContain("alpha");
		expect(html).toContain("beta");
		expect(html).toContain('projectId="1"');
		expect(html).toContain('projectId="2"');
	});
});
