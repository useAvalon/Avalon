/**
 * Nitro SSR Renderer
 *
 * Connects Nitro to Avalon's SSR pipeline for page rendering.
 * This is the catch-all handler — requests that don't match API routes
 * or static files are rendered here as pages.
 */

import { createNitroRenderer } from '@useavalon/avalon/nitro/renderer';
import avalonConfig from 'virtual:avalon/config';
import { loadPage } from 'virtual:avalon/page-loader';

const handler = createNitroRenderer({
	avalonConfig,
	isDev: avalonConfig.isDev,
	resolvePageRoute: async (pathname: string, _pagesDir: string) => {
		const mod = loadPage(pathname);
		if (!mod) return null;
		return { filePath: `[virtual:${pathname}]`, pattern: pathname, params: {} };
	},
	loadPageModule: async (filePath: string) => {
		const match = new RegExp(/^\[virtual:(.+)\]$/).exec(filePath);
		const pathname = match ? match[1] : filePath;
		const mod = loadPage(pathname);
		if (mod && 'default' in mod) return mod as { default: unknown; metadata?: Record<string, unknown> };
		return { default: () => null, metadata: { title: 'Avalon' } };
	},
});

// Wrap with diagnostic error boundary so we never get a blank page
export default async function rendererWithDiagnostics(event: Parameters<typeof handler>[0]) {
	try {
		return await handler(event);
	} catch (err) {
		const e = err instanceof Error ? err : new Error(String(err));
		return new Response(
			`<!DOCTYPE html><html><body><h1>SSR Error</h1><pre>${e.message}\n${e.stack}</pre></body></html>`,
			{ status: 500, headers: { 'Content-Type': 'text/html' } },
		);
	}
}
