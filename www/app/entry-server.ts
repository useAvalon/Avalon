/**
 * Nitro SSR Entry — auto-detected by Nitro's Vite plugin.
 *
 * Exports a fetch handler that renders pages using Avalon's SSR pipeline.
 * Nitro calls this for every request that doesn't match an API route or static file.
 */

import { loadPage } from 'virtual:avalon/page-loader';
import preactRenderToString from 'preact-render-to-string';

// Nitro asset manifests — resolved at build time to the correct
// hashed filenames so the HTML includes the right <link>/<script> tags.
// @ts-ignore — virtual import resolved by Nitro's Vite assets plugin at build time
import clientAssets from './entry-client?assets=client';

export default {
	async fetch(request: Request) {
		const url = new URL(request.url);
		const pathname = url.pathname;

		console.log(`[SSR] Handling ${pathname}`);

		try {
			const mod = loadPage(pathname);
			console.log(`[SSR] loadPage result:`, mod ? 'found' : 'null', mod ? Object.keys(mod) : []);

			if (!mod || !('default' in mod)) {
				return new Response(
					`<!DOCTYPE html><html><head><title>404</title></head><body><h1>404</h1><p>Not found: ${pathname}</p></body></html>`,
					{ status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
				);
			}

			const Component = (mod as { default: (props?: Record<string, unknown>) => unknown }).default;
			const metadata = (mod as { metadata?: Record<string, unknown> }).metadata || {};

			// Call the component (supports async)
			let vnode: unknown;
			const result = Component({});
			vnode = result instanceof Promise ? await result : result;

			const body = preactRenderToString(vnode as any);
			const title = String(metadata.title || 'Avalon');
			const desc = metadata.description
				? `<meta name="description" content="${String(metadata.description).replace(/"/g, '&quot;')}">`
				: '';

			// Build asset tags from the Nitro-provided manifest
			const cssLinks = (clientAssets?.css ?? [])
				.map((attr: Record<string, string>) => `<link rel="stylesheet" href="${attr.href}">`)
				.join('\n');
			const jsPreloads = (clientAssets?.js ?? [])
				.map((attr: Record<string, string>) => `<link rel="modulepreload" href="${attr.href}">`)
				.join('\n');
			const entryScript = clientAssets?.entry ? `<script type="module" src="${clientAssets.entry}"></script>` : '';

			const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${desc}
${cssLinks}
${jsPreloads}
</head>
<body>
<div id="app">${body}</div>
${entryScript}
</body>
</html>`;

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
