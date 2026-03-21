/**
 * Nitro SSR Entry — auto-detected by Nitro's Vite plugin.
 *
 * Exports a fetch handler that renders pages using Avalon's SSR pipeline.
 * Nitro calls this for every request that doesn't match an API route or static file.
 */

import { h } from 'preact';
import { loadPage } from 'virtual:avalon/page-loader';
import preactRenderToString from 'preact-render-to-string';

// @ts-ignore — virtual import resolved by Nitro's Vite assets plugin at build time
import clientAssets from './entry-client?assets=client';

// ── Pre-register framework integrations for SSR ──────────────────────
import { registry } from '@useavalon/avalon/islands/integration-registry';
import { render as preactRender } from '@useavalon/preact/server';
import { render as vueRender } from '@useavalon/vue/server';
import { render as svelteRender } from '@useavalon/svelte/server';
import { render as solidRender } from '@useavalon/solid/server';
import { render as litRender } from '@useavalon/lit/server';
import { render as qwikRender } from '@useavalon/qwik/server';

import type { Integration, IntegrationConfig } from '@useavalon/core/types';

function makeIntegration(
	name: string,
	render: Integration['render'],
	fileExtensions: string[],
	jsxImportSources: string[] = [],
): Integration {
	return {
		name,
		version: '0.1.0',
		render,
		getHydrationScript: () => '',
		config(): IntegrationConfig {
			return { name, fileExtensions, jsxImportSources, detectionPatterns: { imports: [], content: [] } };
		},
	};
}

const ssrIntegrations: Integration[] = [
	makeIntegration('preact', preactRender, ['.tsx', '.jsx'], ['preact']),
	makeIntegration('react', preactRender, ['.tsx', '.jsx'], ['react']),
	makeIntegration('vue', vueRender, ['.vue']),
	makeIntegration('svelte', svelteRender, ['.svelte']),
	makeIntegration('solid', solidRender, ['.tsx', '.jsx'], ['solid-js']),
	makeIntegration('lit', litRender as any, ['.ts', '.js']),
	makeIntegration('qwik', qwikRender, ['.tsx', '.jsx'], ['@builder.io/qwik']),
];
for (const integration of ssrIntegrations) {
	if (!registry.has(integration.name)) registry.register(integration);
}

// ── Layout imports ───────────────────────────────────────────────────
// Static imports so layouts (and their CSS modules) are bundled into SSR.
import RootLayout from './shared/layouts/_layout.tsx';
import DocsLayout from './modules/docs/layouts/_layout.tsx';
import HomeLayout from './modules/home/layouts/_layout.tsx';
import BlogLayout from './modules/blog/layouts/_layout.tsx';

// Module layout map: pathname prefix → { layout, skipRoot }
const moduleLayouts: Array<{
	prefix: string;
	Layout: (props: any) => any;
	skipRoot: boolean;
}> = [
	{ prefix: '/docs', Layout: DocsLayout, skipRoot: false },
	{ prefix: '/blog', Layout: BlogLayout, skipRoot: false },
	// Home layout provides its own <html> shell — skip root
	{ prefix: '/', Layout: HomeLayout, skipRoot: true },
];

function getLayoutsForPath(pathname: string) {
	for (const entry of moduleLayouts) {
		if (entry.prefix === '/' ? pathname === '/' : pathname.startsWith(entry.prefix)) {
			return entry;
		}
	}
	return null;
}

// ── Universal CSS injection ──────────────────────────────────────────
// @ts-ignore — workspace package export
import { getUniversalCSSForHead } from '@useavalon/avalon/islands/universal-css-collector';
// @ts-ignore — workspace package export
import { getUniversalHeadForInjection } from '@useavalon/avalon/islands/universal-head-collector';

// ── Asset injection helpers ──────────────────────────────────────────

function buildAssetTags() {
	const cssLinks = (clientAssets?.css ?? [])
		.map((attr: Record<string, string>) => `<link rel="stylesheet" href="${attr.href}">`)
		.join('\n');
	const jsPreloads = (clientAssets?.js ?? [])
		.map((attr: Record<string, string>) => `<link rel="modulepreload" href="${attr.href}">`)
		.join('\n');
	const entryScript = clientAssets?.entry ? `<script type="module" src="${clientAssets.entry}"></script>` : '';
	return { cssLinks, jsPreloads, entryScript };
}

function injectAssetsIntoHtml(html: string): string {
	const { cssLinks, jsPreloads, entryScript } = buildAssetTags();
	// Inject CSS + preloads before </head>, entry script before </body>
	html = html.replace('</head>', `${cssLinks}\n${jsPreloads}\n</head>`);
	html = html.replace('</body>', `${entryScript}\n</body>`);
	return html;
}

// ── SSR fetch handler ────────────────────────────────────────────────

export default {
	async fetch(request: Request) {
		const url = new URL(request.url);
		const pathname = url.pathname;

		console.log(`[SSR] Handling ${pathname}`);

		try {
			const mod = loadPage(pathname);
			if (!mod || !('default' in mod)) {
				return new Response(
					`<!DOCTYPE html><html><head><title>404</title></head><body><h1>404</h1><p>Not found: ${pathname}</p></body></html>`,
					{ status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
				);
			}

			const PageComponent = (mod as any).default;
			const frontmatter = {
				...((mod as any).frontmatter || {}),
				...((mod as any).metadata || {}),
				currentPath: pathname,
			};

			// Check if page has layoutConfig that skips layouts
			const pageLayoutConfig = (mod as any).layoutConfig as { skipLayouts?: string[] } | undefined;
			const skipAll = pageLayoutConfig?.skipLayouts?.includes('_layout');

			// Render page content first (supports async components)
			const pageResult = PageComponent({});
			const resolvedPage = pageResult instanceof Promise ? await pageResult : pageResult;
			let pageHtml = preactRenderToString(resolvedPage as any);

			// Apply layouts
			const layoutEntry = getLayoutsForPath(pathname);
			let html: string;

			// Shared route info for layout props
			const routeInfo = { path: pathname, params: {}, query: url.searchParams };

			if (!layoutEntry || skipAll) {
				// No layout — wrap in basic HTML shell
				const { cssLinks, jsPreloads, entryScript } = buildAssetTags();
				const title = String(frontmatter.title || 'Avalon');
				html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${title}</title>\n${cssLinks}\n${jsPreloads}\n</head>\n<body>\n<div id="app">${pageHtml}</div>\n${entryScript}\n</body>\n</html>`;
			} else {
				// Apply module layout (wrapper)
				const layoutProps = {
					children: h('div', { dangerouslySetInnerHTML: { __html: pageHtml } }),
					frontmatter,
					data: {},
					route: routeInfo,
				};
				const layoutResult = layoutEntry.Layout(layoutProps);
				const resolvedLayout = layoutResult instanceof Promise ? await layoutResult : layoutResult;
				let wrappedHtml = preactRenderToString(resolvedLayout);

				if (!layoutEntry.skipRoot) {
					// Apply root layout (shell) around the module layout output
					const rootProps = {
						children: h('div', { dangerouslySetInnerHTML: { __html: wrappedHtml } }),
						frontmatter,
						data: {},
						route: routeInfo,
					};
					const rootResult = RootLayout(rootProps);
					const resolvedRoot = rootResult instanceof Promise ? await rootResult : rootResult;
					wrappedHtml = preactRenderToString(resolvedRoot as any);
				}

				// The layout provides the full <html> — just inject assets
				html = '<!DOCTYPE html>\n' + injectAssetsIntoHtml(wrappedHtml);
			}

			// Inject universal CSS collected during island SSR (Svelte scoped, Vue scoped, Lit shadow, etc.)
			const universalCSS = getUniversalCSSForHead(true);
			if (universalCSS && html.includes('</head>')) {
				html = html.replace('</head>', `${universalCSS}\n</head>`);
			}
			const universalHead = getUniversalHeadForInjection(true);
			if (universalHead && html.includes('</head>')) {
				html = html.replace('</head>', `${universalHead}\n</head>`);
			}

			return new Response(html, {
				status: 200,
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			});
		} catch (err) {
			const e = err instanceof Error ? err : new Error(String(err));
			console.error('[SSR Error]', e);
			return new Response(
				`<!DOCTYPE html><html><head><title>Error</title></head><body><h1>SSR Error</h1><pre>${e.message}\n${e.stack}</pre></body></html>`,
				{ status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
			);
		}
	},
};
