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

export default createNitroRenderer({
	avalonConfig,
	isDev: avalonConfig.isDev,
	resolvePageRoute: async (pathname: string, _pagesDir: string) => {
		const mod = loadPage(pathname);
		if (!mod) return null;
		// Return a resolved route — filePath is just for logging, the module
		// is already loaded so loadPageModule below returns it directly.
		return { filePath: `[virtual:${pathname}]`, pattern: pathname, params: {} };
	},
	loadPageModule: async (filePath: string) => {
		// Extract the pathname we encoded in resolvePageRoute
		const match = new RegExp(/^\[virtual:(.+)\]$/).exec(filePath);
		const pathname = match ? match[1] : filePath;
		const mod = loadPage(pathname);
		if (mod && 'default' in mod) return mod as { default: unknown; metadata?: Record<string, unknown> };
		return { default: () => null, metadata: { title: 'Avalon' } };
	},
});
