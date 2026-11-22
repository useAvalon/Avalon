import { describe, expect, it } from "vitest";
import { precompileJsx } from "../precompile-jsx.ts";
import { createHarness } from "./precompile-harness.ts";

const { render, expectParity } = await createHarness();

describe("precompileJsx output matches Preact's normal rendering", () => {
	it("renders static markup and text", async () => {
		const { transformed } = await expectParity(
			`export default () => <div id="a" class="b"><h1>Title</h1><p>Some <b>bold</b> text.</p></div>;`,
		);
		expect(transformed).toContain("_$t(");
	});

	it("applies JSX whitespace rules to multi-line text", async () => {
		await expectParity(`export default () => (
			<div>
				first line
				second   line
				<span> kept </span>
			</div>
		);`);
	});

	it("decodes entities in text and attributes, then re-escapes", async () => {
		await expectParity(
			`export default () => <p title="a &amp; b &quot;q&quot;">1 &lt; 2 &amp; &nbsp;3 &gt; 2 &copy;</p>;`,
		);
	});

	it("escapes dynamic text and attribute values", async () => {
		await expectParity(
			`export default ({ v }: { v: string }) => <p title={v} data-x={v}>{v}</p>;`,
			{ v: `a "q" <b> & c` },
		);
	});

	it("maps className and htmlFor", async () => {
		await expectParity(`export default () => <label className="x y" htmlFor="f">Name</label>;`);
		await expectParity(
			`export default ({ c }: { c: string }) => <label className={c} htmlFor={c}>Name</label>;`,
			{ c: "dyn" },
		);
	});

	it("renders boolean, null and false attributes", async () => {
		await expectParity(
			`export default ({ on }: { on: boolean }) => (
				<input type="checkbox" disabled checked={on} hidden={false} name={null as never} data-a={undefined} />
			);`,
			{ on: true },
		);
	});

	it("renders void elements", async () => {
		await expectParity(
			`export default () => <div><br /><img src="/a.png" alt="A" /><hr/><input value="x" /></div>;`,
		);
	});

	it("renders empty and self-closing non-void elements", async () => {
		await expectParity(`export default () => <div><span /><p></p></div>;`);
	});

	it("renders conditionals, logical expressions and null children", async () => {
		await expectParity(
			`export default ({ show, n }: { show: boolean; n: number }) => (
				<ul>
					{show && <li>shown</li>}
					{!show && <li>hidden</li>}
					{show ? <li>yes</li> : <li>no</li>}
					{null}{undefined}{false}{true}{0}{n}
				</ul>
			);`,
			{ show: true, n: 7 },
		);
	});

	it("renders lists built with map, with keys", async () => {
		await expectParity(
			`export default ({ items }: { items: string[] }) => (
				<ul>{items.map((item, i) => <li key={i} class="row"><a href={"/x/" + item}>{item}</a></li>)}</ul>
			);`,
			{ items: ["a", "b & c", "<d>"] },
		);
	});

	it("renders fragments at the root and inside elements", async () => {
		await expectParity(`export default () => <><p>one</p><p>two</p></>;`);
		await expectParity(
			`export default ({ x }: { x: string }) => <div><>{x}<b>in fragment</b></></div>;`,
			{ x: "dyn" },
		);
	});

	it("renders style objects and strings", async () => {
		await expectParity(
			`export default ({ s }: { s: Record<string, string | number> }) => (
				<div style="color:red"><p style={s}>x</p><p style={{ marginTop: 4, "--v": "1" }}>y</p></div>
			);`,
			{ s: { backgroundColor: "blue", opacity: 0.5 } },
		);
	});

	it("renders custom elements", async () => {
		await expectParity(
			`export default () => <avalon-page id="app" data-x="1"><span>inner</span></avalon-page>;`,
		);
	});

	it("ignores JSX comments", async () => {
		await expectParity(`export default () => <div>{/* note */}<p>x</p>{/* another */}</div>;`);
	});

	it("keeps components working with props and children", async () => {
		await expectParity(`
			function Card({ title, children }: { title: string; children?: unknown }) {
				return <section data-title={title}><h2>{title}</h2>{children}</section>;
			}
			export default () => (
				<main>
					<Card title="One"><p>static child</p></Card>
					<Card title="Two"><b>bold</b> and text</Card>
				</main>
			);`);
	});

	it("leaves direct children of a component inspectable", async () => {
		const { plain, compiled } = await render(`
			import { toChildArray } from "preact";
			function Count({ children }: { children?: unknown }) {
				const kids = toChildArray(children as never);
				return <p>{kids.length}:{kids.map((c: any) => c.type ?? "text").join(",")}</p>;
			}
			export default () => <Count><b>x</b><i>y</i>text</Count>;
		`);
		expect(compiled).toBe(plain);
		expect(compiled).toContain("b,i,text");
	});

	it("passes elements as props to components", async () => {
		await expectParity(`
			function Frame({ header, children }: { header: unknown; children?: unknown }) {
				return <div><header>{header}</header>{children}</div>;
			}
			export default () => <Frame header={<h1>Head</h1>}><p>body</p></Frame>;
		`);
	});

	it("supports hooks inside components used in a template", async () => {
		await expectParity(`
			import { useMemo, useRef, useState } from "preact/hooks";
			function Counter({ start }: { start: number }) {
				const [n] = useState(start);
				const ref = useRef(5);
				const doubled = useMemo(() => n * 2, [n]);
				return <span>{n}/{ref.current}/{doubled}</span>;
			}
			export default () => <div><b>static</b><Counter start={3} /></div>;
		`);
	});

	it("supports context across templates", async () => {
		await expectParity(`
			import { createContext } from "preact";
			import { useContext } from "preact/hooks";
			const Theme = createContext("light");
			function Badge() {
				const theme = useContext(Theme);
				return <i class={"badge " + theme}>{theme}</i>;
			}
			export default () => (
				<div>
					<Badge />
					<Theme.Provider value="dark"><section><p>text</p><Badge /></section></Theme.Provider>
				</div>
			);
		`);
	});

	it("keeps elements with spread attributes", async () => {
		await expectParity(
			`export default ({ a }: { a: Record<string, string> }) => <div {...a} id="x"><p>child</p></div>;`,
			{ a: { title: "t", "data-k": "v" } },
		);
	});

	it("keeps dangerouslySetInnerHTML, event handlers and camelCase props", async () => {
		await expectParity(
			`export default () => (
				<div>
					<div dangerouslySetInnerHTML={{ __html: "<b>raw</b>" }} />
					<button onClick={() => undefined} type="button">go</button>
					<svg viewBox="0 0 10 10" strokeWidth="2"><path d="M0 0" /></svg>
				</div>
			);`,
		);
	});

	it("keeps select, option and textarea", async () => {
		await expectParity(
			`export default () => (
				<form>
					<select value="b"><option value="a">A</option><option value="b">B</option></select>
					<textarea value="hello" />
				</form>
			);`,
		);
	});

	it("drops key and ref on host elements", async () => {
		await expectParity(`export default () => <ul><li key="a" ref={() => undefined}>a</li></ul>;`);
	});

	it("matches the renderer's attribute rules for aria, data, enumerated and empty values", async () => {
		await expectParity(
			`export default ({ t, f, n }: { t: boolean; f: boolean; n: number }) => (
				<div aria-hidden={t} aria-expanded={f} data-on={t} data-off={f} draggable={t} spellcheck={f} tabindex={n} data-n={n}>
					<img alt="" src="/a.png" />
					<input value="" disabled="" />
					<a href={""} title={0 as never} data-zero={0}>x</a>
				</div>
			);`,
			{ t: true, f: false, n: 0 },
		);
	});

	it("falls back for character references it cannot decode, with identical output", async () => {
		const { transformed } = await expectParity(
			`export default () => <div><p title="&copy; &hellip;">&copy; 2026 &mdash; &#8594; &#x2192;</p><b>kept</b></div>;`,
		);
		// The unsupported text stays JSX for the normal transform; the sibling is still templated.
		expect(transformed).toContain("<b>kept</b>");
	});

	it("decodes supported references in text and attributes", async () => {
		await expectParity(
			`export default () => <p title="x&nbsp;y &lt;&gt; &amp; &quot; &apos;">a&nbsp;b &lt;i&gt; &amp;&amp; &#65;&#x42;</p>;`,
		);
	});

	it("keeps dynamic style on Preact's own path but bakes literal styles", async () => {
		const { transformed } = await expectParity(
			`export default ({ s }: { s: Record<string, number> }) => (
				<div style="color:red"><p style={s}>x</p><p style={"top:1px"}>y</p></div>
			);`,
			{ s: { marginTop: 4, zIndex: 2 } },
		);
		expect(transformed).toContain("color:red");
	});

	it("handles text next to expressions and entities in expressions", async () => {
		await expectParity(
			`export default ({ a }: { a: string }) => <p>Hello, {a}! &amp; {"<b>" + a}</p>;`,
			{ a: "x & y" },
		);
	});

	it("keeps the attribute order of the source", async () => {
		const { compiled } = await expectParity(
			`export default () => <header class="nav" id="top" data-x="1"><p>x</p></header>;`,
		);
		expect(compiled).toBe('<header class="nav" id="top" data-x="1"><p>x</p></header>');
	});

	it("keeps noscript and translate on Preact's path", async () => {
		await expectParity(
			`export default () => (
				<div><noscript><b>fallback</b></noscript><p translate="no">a</p><p translate="yes">b</p></div>
			);`,
		);
	});

	it("keeps elements that spell the class both ways on Preact's path", async () => {
		await expectParity(
			`export default () => <div class="a" className="b" id="x"><p>child</p></div>;`,
		);
	});

	it("reuses one constant for identical templates", async () => {
		const { transformed } = await expectParity(
			`export default () => <div><p>same</p><p>same</p></div>;`,
		);
		expect(transformed?.match(/const _\$tpl\d+=/g)?.length).toBe(1);
	});

	it("handles nested JSX inside expressions and component props", async () => {
		await expectParity(
			`
			function Item({ render }: { render: () => unknown }) { return <li>{render()}</li>; }
			export default ({ rows }: { rows: number[] }) => (
				<ul>{rows.map((n) => <Item render={() => <b>{n}</b>} />)}</ul>
			);`,
			{ rows: [1, 2] },
		);
	});

	it("handles async-style page components that return templates", async () => {
		await expectParity(
			`export default function Page({ items }: { items: number[] }) {
				const total = items.reduce((a, b) => a + b, 0);
				return <article><h1>{total}</h1>{items.map((i) => <p>{i}</p>)}</article>;
			}`,
			{ items: [1, 2, 3] },
		);
	});
});

describe("precompileJsx edge cases", () => {
	const KINDS = `
		import { toChildArray } from "preact";
		function Kinds({ children }: { children?: unknown }) {
			const kids = toChildArray(children as never);
			return <p>{kids.map((c: any) => (c && c.type) || "text").join(",")}</p>;
		}
	`;

	it("keeps JSX written as an expression child of a component inspectable", async () => {
		const { compiled, plain } = await render(
			`${KINDS}
			export default ({ on }: { on: boolean }) => (
				<div>
					<Kinds>{<b>direct</b>}</Kinds>
					<Kinds>{on ? <b>x</b> : <i>y</i>}</Kinds>
					<Kinds>{on && <u>z</u>}</Kinds>
					<Kinds>{[<b>1</b>, <i>2</i>]}</Kinds>
				</div>
			);`,
			{ on: true },
		);
		expect(compiled).toBe(plain);
		expect(compiled).toContain("<p>b</p><p>b</p><p>u</p><p>b,i</p>");
	});

	it("keeps JSX in a component prop inspectable, but still compiles callback bodies", async () => {
		const { compiled, plain, transformed } = await render(
			`
			function Probe({ header, render }: { header: any; render: () => any }) {
				return <section><i>{header?.type}</i>{render()}</section>;
			}
			export default ({ on }: { on: boolean }) => (
				<Probe header={on ? <h1>t</h1> : null} render={() => <em>callback</em>} />
			);`,
			{ on: true },
		);
		expect(compiled).toBe(plain);
		expect(compiled).toContain("<i>h1</i>");
		// The callback body is not a direct value, so its markup is a template.
		expect(transformed).toContain("<em>callback</em>");
	});

	it("keeps svg and foreignObject as vnodes so nested components render in the right mode", async () => {
		await expectParity(`
			function Icon() { return <path strokeWidth="2" d="M0 0" />; }
			function Label() { return <p className="x" tabIndex={0}>html</p>; }
			export default () => (
				<div>
					<svg viewBox="0 0 10 10"><g><Icon /></g><foreignObject><Label /></foreignObject></svg>
					<span>after</span>
				</div>
			);`);
	});

	it("keeps elements that spell for and htmlFor together on Preact's path", async () => {
		await expectParity(`export default () => <label for="a" htmlFor="b" id="x">name</label>;`);
	});

	it("still runs key and ref expressions that have side effects, in order", async () => {
		const { compiled, plain } = await render(`
			export default () => {
				let calls = 0;
				const next = () => ++calls;
				const list = <ul><li key={next()}>a</li><li key={next()} ref={() => next()}>b</li></ul>;
				return <div>{list}<p>{calls}</p></div>;
			}`);
		expect(compiled).toBe(plain);
		expect(compiled).toContain("<p>2</p>");
	});

	it("does not collide with identifiers already in the module", async () => {
		await expectParity(`
			const _$t = "t"; const _$a = "a"; const _$c = "c"; const _$d = "d"; const _$tpl0 = "tpl";
			function inner() { const _$$t = 5; return <b>{_$$t}</b>; }
			export default () => <p>{_$t}{_$a}{_$c}{_$d}{_$tpl0}{inner()}</p>;`);
	});

	it("treats every name outside ascii-lowercase as a component, like the JSX transform", async () => {
		await expectParity(`
			function Écran() { return <b>screen</b>; }
			function _card() { return <i>card</i>; }
			function $cash() { return <u>cash</u>; }
			export default () => <div><Écran /><_card /><$cash /></div>;`);
	});

	it("renders arrays of strings once-escaped and leaves the caller's array alone", async () => {
		const { compiled } = await expectParity(`
			export default () => {
				const items = ["a & b", "<c>"];
				const list = <ul>{items}</ul>;
				return <div>{list}<i>{items[0]}</i></div>;
			}`);
		expect(compiled).toContain("<ul>a &amp; b&lt;c></ul>");
		expect(compiled).toContain("<i>a &amp; b</i>");
	});

	it("renders mixed and nested array children like the renderer does", async () => {
		await expectParity(
			`
			export default ({ n }: { n: number }) => (
				<ul>{["x & y", [<li>nested</li>, null, false, "<z>", 7], n, <li>last</li>]}</ul>
			);`,
			{ n: 3 },
		);
	});

	it("falls back for unsupported entities without recompiling nested markup", async () => {
		const depth = 400;
		const source = `export default () => ${"<div>".repeat(depth)}&copy;${"</div>".repeat(depth)};`;
		const started = performance.now();
		const result = await render(source);
		expect(performance.now() - started).toBeLessThan(5000);
		expect(result.compiled).toBe(result.plain);
	});
});

describe("precompileJsx output shape", () => {
	it("returns null when the file has no JSX", () => {
		expect(precompileJsx("export const a = 1 < 2;", "/a.tsx")).toBeNull();
	});

	it("returns null for syntax it cannot parse, leaving the normal transform to report it", () => {
		expect(precompileJsx("const x = <div>;", "/a.tsx")).toBeNull();
	});

	it("returns null when nothing can be templated", () => {
		expect(precompileJsx("export default () => <Foo a={1} />;", "/a.tsx")).toBeNull();
	});

	it("places the header after a jsxImportSource pragma", () => {
		const result = precompileJsx(
			"/** @jsxImportSource preact */\nexport default () => <div>x</div>;",
			"/a.tsx",
		);
		expect(result?.code.startsWith("/** @jsxImportSource preact */import{")).toBe(true);
	});

	it("keeps line numbers stable for code after multi-line JSX", () => {
		const source = `export const a = (
	<div>
		<p>one</p>
		<p>two</p>
	</div>
);
export const marker = 1;`;
		const result = precompileJsx(source, "/a.tsx");
		const line = (code: string) => code.split("\n").findIndex((l) => l.includes("marker"));
		expect(line(result?.code ?? "")).toBe(line(source));
	});

	it("skips files that select another JSX runtime with a pragma", () => {
		const source = "/** @jsxImportSource preact/compat */\nexport default () => <div>x</div>;";
		expect(precompileJsx(source, "/a.tsx")).toBeNull();
		expect(precompileJsx("/** @jsx h */\nexport const a = <div>x</div>;", "/a.tsx")).toBeNull();
	});

	it("places the header after a hashbang and directives", () => {
		const result = precompileJsx(
			'#!/usr/bin/env node\n"use client";\nexport default () => <div>x</div>;',
			"/a.tsx",
		);
		expect(result?.code).toMatch(/^#!\/usr\/bin\/env node\n"use client";import\{/);
	});
});

describe("precompileJsx review edge cases", () => {
	it("avoids generated names that match escaped identifiers", async () => {
		const result = await expectParity(
			'export default () => { const \\u005f$t = "original"; return <p>{\\u005f$t}</p>; };',
		);
		expect(result.compiled).toBe("<p>original</p>");
	});

	it("keeps a left || operand passed to a component inspectable", async () => {
		const source = `const Probe = (p: { header: any }) => <i>{p.header.type}</i>;
export default () => <Probe header={<h1>Title</h1> || "x"} />;`;
		const result = await expectParity(source);
		expect(result.compiled).toBe("<i>h1</i>");
	});

	it("keeps effectful keys on the JSX path so evaluation order holds", async () => {
		const source = `export default () => {
	const log: string[] = [];
	const record = (v: string) => { log.push(v); return v; };
	return <ul><li key={record("key")}>{record("child")}</li><b>{log.join(",")}</b></ul>;
};`;
		await expectParity(source);
	});

	it("does not template panose1, which the renderer rewrites in SVG", async () => {
		await expectParity('export default () => <svg><font-face panose1="1" /></svg>;');
	});

	it("decodes character references after whitespace rules", async () => {
		await expectParity("export default () => <pre>x&#10;y</pre>;");
	});

	it("keeps spread children as JSX", async () => {
		await expectParity(
			"export default () => { const items = ['a', 'b']; return <div>{...items}</div>; };",
		);
	});

	it("renders signal children and attributes like the normal path", async () => {
		const signal = `{ peek() { return 0; }, value: false }`;
		await expectParity(`const flag = ${signal};
export default () => <p title={{ peek: 0, value: "internal", toString: () => "display" } as any}>{flag as any}</p>;`);
	});
});
