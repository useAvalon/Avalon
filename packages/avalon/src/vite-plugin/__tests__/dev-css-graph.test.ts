import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	appendDevCssLinks,
	appendDevStyleTags,
	layoutPrefixMatches,
	matchPathPattern,
} from "../../render/dev-css-select.ts";
import {
	buildDevCssRouteTable,
	collectCssHrefsFromEntry,
	resolveProjectImport,
	selectDevCssHrefs,
} from "../dev-css-graph.ts";

function fixtureRoot(): string {
	const root = join(
		tmpdir(),
		`avalon-css-graph-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(join(root, "pages"), { recursive: true });
	mkdirSync(join(root, "components"), { recursive: true });
	mkdirSync(join(root, "layouts"), { recursive: true });
	mkdirSync(join(root, "styles"), { recursive: true });
	return root;
}

function write(root: string, rel: string, body: string): string {
	const abs = join(root, rel);
	mkdirSync(join(abs, ".."), { recursive: true });
	writeFileSync(abs, body);
	return abs;
}

describe("dev-css-graph", () => {
	it("walks page imports, CSS @import, and skips unrelated files", () => {
		const root = fixtureRoot();
		write(root, "styles/reset.css", "html{box-sizing:border-box}");
		write(root, "styles/main.css", '@import "./reset.css";\nbody{margin:0}');
		write(root, "layouts/_layout.module.css", ".shell{display:flex}");
		write(
			root,
			"layouts/_layout.tsx",
			`import styles from "./_layout.module.css";\nimport "../styles/main.css";\nexport default function L(){return <html class={styles.shell}/>}`,
		);
		write(root, "components/Hero.module.css", ".hero{padding:1rem}");
		write(
			root,
			"components/Hero.tsx",
			`import styles from "./Hero.module.css";\nexport default function Hero(){return <div class={styles.hero}/>}`,
		);
		write(root, "components/Unused.module.css", ".unused{color:red}");
		write(
			root,
			"components/Unused.tsx",
			`import styles from "./Unused.module.css";\nexport default function Unused(){return <div class={styles.unused}/>}`,
		);
		write(root, "pages/index.module.css", ".page{min-height:100vh}");
		const index = write(
			root,
			"pages/index.tsx",
			`import styles from "./index.module.css";\nimport Hero from "../components/Hero.tsx";\nexport default function Page(){return <div class={styles.page}><Hero/></div>}`,
		);
		write(root, "pages/other.module.css", ".other{color:blue}");
		write(
			root,
			"pages/other.tsx",
			`import styles from "./other.module.css";\nexport default function Other(){return <div class={styles.other}/>}`,
		);

		const hrefs = collectCssHrefsFromEntry(index, root);
		expect(hrefs).toContain("/pages/index.module.css");
		expect(hrefs).toContain("/components/Hero.module.css");
		expect(hrefs).not.toContain("/components/Unused.module.css");
		expect(hrefs).not.toContain("/pages/other.module.css");
	});

	it("walks aliased MDX island imports to their CSS modules", () => {
		const root = fixtureRoot();
		mkdirSync(join(root, "app/shared/components"), { recursive: true });
		write(
			root,
			"app/shared/components/InteractiveExample.module.css",
			".wrapper{border:1px solid}",
		);
		write(
			root,
			"app/shared/components/InteractiveExample.tsx",
			`import styles from "./InteractiveExample.module.css";\nexport default function Example(){return <div class={styles.wrapper}/>}`,
		);
		const page = write(
			root,
			"pages/quick-start.mdx",
			`import InteractiveExample from '@shared/components/InteractiveExample.tsx';\n\n<InteractiveExample island={{ condition: 'on:interaction' }} />\n`,
		);
		expect(
			resolveProjectImport(page, "@shared/components/InteractiveExample.tsx", root)?.endsWith(
				"InteractiveExample.tsx",
			),
		).toBe(true);
		expect(collectCssHrefsFromEntry(page, root)).toContain(
			"/app/shared/components/InteractiveExample.module.css",
		);
	});

	it("resolves extensionless and directory index imports", () => {
		const root = fixtureRoot();
		write(root, "components/Card.module.css", ".card{}");
		write(
			root,
			"components/Card.tsx",
			`import styles from "./Card.module.css";\nexport default function Card(){return <div class={styles.card}/>}`,
		);
		const page = write(
			root,
			"pages/index.tsx",
			`import Card from "../components/Card";\nexport default function Page(){return <Card/>}`,
		);
		expect(resolveProjectImport(page, "../components/Card", root)?.endsWith("Card.tsx")).toBe(true);
		expect(collectCssHrefsFromEntry(page, root)).toContain("/components/Card.module.css");
	});

	it("builds per-route tables so sibling pages do not share CSS", () => {
		const root = fixtureRoot();
		write(root, "layouts/_layout.module.css", ".root{}");
		const layout = write(
			root,
			"layouts/_layout.tsx",
			`import styles from "./_layout.module.css";\nexport default function L(){return <html class={styles.root}/>}`,
		);
		const billing = write(
			root,
			"pages/billing.tsx",
			`import "./billing.module.css";\nexport default function Billing(){return <div/>}`,
		);
		write(root, "pages/billing.module.css", ".bill{}");
		const chat = write(
			root,
			"pages/chat.tsx",
			`import "./ChatPanel.module.css";\nexport default function Chat(){return <div/>}`,
		);
		write(root, "pages/ChatPanel.module.css", ".chat{}");

		const table = buildDevCssRouteTable({
			cwd: root,
			globalCSS: ["/styles/tokens.css"],
			routes: [
				{ pattern: "/billing", filePath: billing },
				{ pattern: "/chat", filePath: chat },
			],
			layouts: [{ prefix: "/", filePath: layout, isRoot: true, skipRoot: false }],
		});

		const billingEntry = table.routes.find((r) => r.pattern === "/billing");
		const chatEntry = table.routes.find((r) => r.pattern === "/chat");
		expect(billingEntry?.hrefs).toContain("/pages/billing.module.css");
		expect(billingEntry?.hrefs).toContain("/layouts/_layout.module.css");
		expect(billingEntry?.hrefs).toContain("/styles/tokens.css");
		expect(billingEntry?.hrefs).not.toContain("/pages/ChatPanel.module.css");
		expect(chatEntry?.hrefs).toContain("/pages/ChatPanel.module.css");
		expect(chatEntry?.hrefs).not.toContain("/pages/billing.module.css");
		expect(table.fallbackHrefs).toContain("/layouts/_layout.module.css");
	});

	it("walks @import from each global stylesheet", () => {
		const root = fixtureRoot();
		write(root, "styles/reset.css", "*{box-sizing:border-box}");
		write(root, "styles/tokens.css", '@import "./reset.css";\n:root{--x:1}');
		const page = write(root, "pages/index.tsx", `export default function Page(){return <div/>}`);

		const table = buildDevCssRouteTable({
			cwd: root,
			globalCSS: ["/styles/tokens.css"],
			routes: [{ pattern: "/", filePath: page }],
			layouts: [],
		});

		expect(table.globalHrefs).toContain("/styles/tokens.css");
		expect(table.globalHrefs).toContain("/styles/reset.css");
		expect(table.routes[0]?.hrefs).toContain("/styles/reset.css");
	});

	it("selects only the matching route's hrefs", () => {
		const table = {
			globalHrefs: ["/g.css"],
			fallbackHrefs: ["/g.css", "/root.css"],
			routes: [
				{
					pattern: "/billing",
					hrefs: ["/g.css", "/root.css", "/billing.css"],
					pageHrefs: ["/g.css", "/billing.css"],
				},
				{
					pattern: "/chat",
					hrefs: ["/g.css", "/root.css", "/chat.css"],
					pageHrefs: ["/g.css", "/chat.css"],
				},
			],
		};
		expect(selectDevCssHrefs(table, "/billing", false)).toEqual([
			"/g.css",
			"/root.css",
			"/billing.css",
		]);
		expect(selectDevCssHrefs(table, "/chat", false)).not.toContain("/billing.css");
		expect(selectDevCssHrefs(table, "/billing", true)).toEqual(["/g.css", "/billing.css"]);
		expect(selectDevCssHrefs(table, "/unknown", false)).toEqual(["/g.css", "/root.css"]);
	});

	it("matches dynamic segments and rest params", () => {
		expect(matchPathPattern("/docs/introduction", "/docs/:slug")).toBe(true);
		expect(matchPathPattern("/docs/a/b", "/docs/:slug")).toBe(false);
		expect(matchPathPattern("/docs/a/b", "/docs/**")).toBe(true);
		expect(matchPathPattern("/billing/", "/billing")).toBe(true);
		expect(matchPathPattern("/", "/:slug")).toBe(false);
		expect(matchPathPattern("/hello", "/:slug")).toBe(true);
	});

	it("matches a layout prefix without matching a longer sibling path", () => {
		expect(layoutPrefixMatches("/blog", "/blog")).toBe(true);
		expect(layoutPrefixMatches("/blog/post", "/blog")).toBe(true);
		expect(layoutPrefixMatches("/blogger", "/blog")).toBe(false);
		expect(layoutPrefixMatches("/", "/")).toBe(true);
		expect(layoutPrefixMatches("/blog", "/")).toBe(false);
	});

	it("appends style tags before </head>", () => {
		const html = appendDevStyleTags("<html><head></head></html>", [
			{ href: "/a.css", css: "a{}" },
			{ href: "/b.css", css: "b{}" },
		]);
		expect(html).toContain('data-avalon-css="/a.css"');
		expect(html).toContain("a{}");
		expect(html).not.toContain("?direct");
		expect(appendDevStyleTags("<html></html>", [{ href: "/a.css", css: "a{}" }])).toBe(
			"<html></html>",
		);
	});

	it("appends ?direct stylesheet links and the HMR client before </head>", () => {
		const html = appendDevCssLinks("<html><head></head></html>", ["/a.css", "/b.css"]);
		expect(html).toContain('href="/a.css?direct"');
		expect(html).toContain('data-avalon-css="/a.css"');
		expect(html).toContain('src="/@vite/client"');
		expect(html).toContain("virtual:avalon/dev-css-hmr");
		expect(appendDevCssLinks("<html></html>", ["/a.css"])).toBe("<html></html>");
	});

	it("injects the Avalon CSS HMR module even when /@vite/client is already present", () => {
		const html = appendDevCssLinks(
			'<html><head><script type="module" src="/@vite/client"></script></head></html>',
			["/a.css"],
		);
		expect(html).toContain('src="/@vite/client"');
		expect(html).toContain("virtual:avalon/dev-css-hmr");
		expect(html.match(/\/@vite\/client/g)?.length).toBe(1);
	});
});
