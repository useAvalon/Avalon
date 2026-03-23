/**
 * Nitro SSR Renderer — matches the scaffolded project structure.
 *
 * Uses createNitroRenderer with a custom wrapWithLayouts hook
 * for the www site's module-based layout system.
 */

import { loadPage } from "virtual:avalon/page-loader";
// ── Pre-register framework integrations for SSR ──────────────────────
import { registry } from "@useavalon/avalon/islands/integration-registry";
import type { Integration, IntegrationConfig } from "@useavalon/core/types";
import { render as litRender } from "@useavalon/lit/server";
import { render as preactRender } from "@useavalon/preact/server";
import { render as qwikRender } from "@useavalon/qwik/server";
import { render as solidRender } from "@useavalon/solid/server";
import { render as svelteRender } from "@useavalon/svelte/server";
import { render as vueRender } from "@useavalon/vue/server";
import { h } from "preact";
import preactRenderToString from "preact-render-to-string";
// @ts-expect-error — virtual import resolved by Nitro's Vite assets plugin at build time
import clientAssets from "../app/entry-client?assets=client";

function makeIntegration(
	name: string,
	render: Integration["render"],
	fileExtensions: string[],
	jsxImportSources: string[] = [],
): Integration {
	return {
		name,
		version: "0.1.0",
		render,
		getHydrationScript: () => "",
		config(): IntegrationConfig {
			return {
				name,
				fileExtensions,
				jsxImportSources,
				detectionPatterns: { imports: [], content: [] },
			};
		},
	};
}

const ssrIntegrations: Integration[] = [
	makeIntegration("preact", preactRender, [".tsx", ".jsx"], ["preact"]),
	makeIntegration("react", preactRender, [".tsx", ".jsx"], ["react"]),
	makeIntegration("vue", vueRender, [".vue"]),
	makeIntegration("svelte", svelteRender, [".svelte"]),
	makeIntegration("solid", solidRender, [".tsx", ".jsx"], ["solid-js"]),
	makeIntegration("lit", litRender as any, [".ts", ".js"]),
	makeIntegration("qwik", qwikRender, [".tsx", ".jsx"], ["@builder.io/qwik"]),
];
for (const integration of ssrIntegrations) {
	if (!registry.has(integration.name)) registry.register(integration);
}

// ── Register built-in custom hydration directives ────────────────────
import { registerBuiltinDirectives } from "@useavalon/avalon";

registerBuiltinDirectives();

// ── Universal CSS injection ──────────────────────────────────────────
// @ts-expect-error — workspace package export
import { getUniversalCSSForHead } from "@useavalon/avalon/islands/universal-css-collector";
// @ts-expect-error — workspace package export
import { getUniversalHeadForInjection } from "@useavalon/avalon/islands/universal-head-collector";
import { createNitroRenderer } from "@useavalon/avalon/nitro/renderer";
import type { NitroRenderContext, PageModule } from "@useavalon/avalon/nitro/types";
import BlogLayout from "../app/modules/blog/layouts/_layout.tsx";
import DocsLayout from "../app/modules/docs/layouts/_layout.tsx";
import HomeLayout from "../app/modules/home/layouts/_layout.tsx";
// ── Layout imports ───────────────────────────────────────────────────
import RootLayout from "../app/shared/layouts/_layout.tsx";

// ── Module layout map ────────────────────────────────────────────────

const moduleLayouts: Array<{
	prefix: string;
	Layout: (props: any) => any;
	skipRoot: boolean;
}> = [
	{ prefix: "/docs", Layout: DocsLayout, skipRoot: false },
	{ prefix: "/blog", Layout: BlogLayout, skipRoot: false },
	{ prefix: "/", Layout: HomeLayout, skipRoot: true },
];

function getLayoutsForPath(pathname: string) {
	for (const entry of moduleLayouts) {
		if (entry.prefix === "/" ? pathname === "/" : pathname.startsWith(entry.prefix)) {
			return entry;
		}
	}
	return null;
}

// ── Asset injection helpers ──────────────────────────────────────────

function buildAssetTags() {
	const cssLinks = (clientAssets?.css ?? [])
		.map((attr: Record<string, string>) => `<link rel="stylesheet" href="${attr.href}">`)
		.join("\n");
	const jsPreloads = (clientAssets?.js ?? [])
		.map((attr: Record<string, string>) => `<link rel="modulepreload" href="${attr.href}">`)
		.join("\n");
	const entryScript = clientAssets?.entry
		? `<script type="module" src="${clientAssets.entry}"></script>`
		: "";
	return { cssLinks, jsPreloads, entryScript };
}

function injectAssetsIntoHtml(html: string): string {
	const { cssLinks, jsPreloads, entryScript } = buildAssetTags();
	html = html.replace("</head>", `${cssLinks}\n${jsPreloads}\n</head>`);
	html = html.replace("</body>", `${entryScript}\n</body>`);
	return html;
}

function injectUniversalAssets(html: string): string {
	const universalCSS = getUniversalCSSForHead(true);
	if (universalCSS && html.includes("</head>")) {
		html = html.replace("</head>", `${universalCSS}\n</head>`);
	}
	const universalHead = getUniversalHeadForInjection(true);
	if (universalHead && html.includes("</head>")) {
		html = html.replace("</head>", `${universalHead}\n</head>`);
	}
	return html;
}

// ── wrapWithLayouts ──────────────────────────────────────────────────

async function wrapWithLayouts(
	pageHtml: string,
	pageModule: PageModule,
	context: NitroRenderContext,
): Promise<string> {
	const pathname = context.url.pathname;
	const frontmatter = {
		...((pageModule as any).frontmatter || {}),
		...((pageModule as any).metadata || {}),
		currentPath: pathname,
	};

	const pageLayoutConfig = (pageModule as any).layoutConfig as
		| { skipLayouts?: string[] }
		| undefined;
	const skipAll = pageLayoutConfig?.skipLayouts?.includes("_layout");

	const layoutEntry = getLayoutsForPath(pathname);
	const routeInfo = { path: pathname, params: context.params, query: context.url.searchParams };

	let html: string;

	if (!layoutEntry || skipAll) {
		const { cssLinks, jsPreloads, entryScript } = buildAssetTags();
		const title = String(frontmatter.title || "Avalon");
		html = [
			"<!DOCTYPE html>",
			'<html lang="en">',
			"<head>",
			'<meta charset="utf-8">',
			'<meta name="viewport" content="width=device-width, initial-scale=1">',
			`<title>${title}</title>`,
			cssLinks,
			jsPreloads,
			"</head>",
			"<body>",
			`<div id="app">${pageHtml}</div>`,
			entryScript,
			"</body>",
			"</html>",
		].join("\n");
	} else {
		const layoutProps = {
			children: h("div", { dangerouslySetInnerHTML: { __html: pageHtml } }),
			frontmatter,
			data: {},
			route: routeInfo,
		};
		const layoutResult = layoutEntry.Layout(layoutProps);
		const resolvedLayout = layoutResult instanceof Promise ? await layoutResult : layoutResult;
		let wrappedHtml = preactRenderToString(resolvedLayout);

		if (!layoutEntry.skipRoot) {
			const rootProps = {
				children: h("div", { dangerouslySetInnerHTML: { __html: wrappedHtml } }),
				frontmatter,
				data: {},
				route: routeInfo,
			};
			const rootResult = RootLayout(rootProps);
			const resolvedRoot = rootResult instanceof Promise ? await rootResult : rootResult;
			wrappedHtml = preactRenderToString(resolvedRoot as any);
		}

		html = "<!DOCTYPE html>\n" + injectAssetsIntoHtml(wrappedHtml);
	}

	return injectUniversalAssets(html);
}

// ── Renderer ─────────────────────────────────────────────────────────

export default createNitroRenderer({
	avalonConfig: {
		streaming: false,
		pagesDir: "app",
		layoutsDir: "app/shared/layouts",
		srcDir: "app",
	},
	isDev: process.env.NODE_ENV !== "production",
	resolvePageRoute: async (pathname) => {
		const mod = loadPage(pathname);
		if (!mod || !("default" in mod)) return null;
		return { filePath: `[virtual:${pathname}]`, pattern: pathname, params: {} };
	},
	loadPageModule: async (filePath) => {
		const match = /^\[virtual:(.+)\]$/.exec(filePath);
		const pathname = match ? match[1] : filePath;
		const mod = loadPage(pathname);
		if (mod) return mod as PageModule;
		return { default: () => null, metadata: { title: "Avalon" } };
	},
	wrapWithLayouts,
});
