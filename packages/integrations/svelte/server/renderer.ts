import { readFile } from 'node:fs/promises';
import { render as svelteRender } from 'svelte/server';
import type { RenderParams, RenderResult } from '@useavalon/core/types';
import type { SvelteSsrRenderResult } from '../types.ts';
import { toImportSpecifier } from '@useavalon/core/utils';
import { resolveIslandPath } from '@useavalon/avalon/islands/framework-detection';

async function loadComponent(src: string) {
	const isDev = process.env.NODE_ENV !== 'production';

	if (isDev && globalThis.__viteDevServer) {
		const resolvedPath = await resolveIslandPath(src);
		const module = await globalThis.__viteDevServer.ssrLoadModule(resolvedPath);
		return module.default || module;
	}

	const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace(/\.svelte$/, '.js');
	const module = (await import(
		/* @vite-ignore */
		toImportSpecifier(ssrPath)
	)) as Record<string, unknown>;
	return module.default || module;
}

async function extractCSS(src: string, scopeId: string | null) {
	try {
		const resolved = await resolveIslandPath(src);
		const filePath = resolved.startsWith('/') ? resolved.slice(1) : resolved;
		const sourceCode = await readFile(filePath, 'utf-8');
		const styleMatch = sourceCode.match(/<style[^>]*>([\s\S]*?)<\/style>/);

		if (styleMatch) {
			const rawCSS = styleMatch[1].trim();
			// If we have a scopeId, apply scoping to class selectors
			if (scopeId) {
				const scopedCSS = rawCSS.replaceAll(/(\.[a-zA-Z_-][a-zA-Z0-9_-]*)/g, match => match + '.' + scopeId);
				return scopedCSS;
			}
			// Return raw CSS if no scopeId (Svelte 5 handles scoping differently)
			return rawCSS;
		}
	} catch (e) {
		console.error('CSS extraction failed:', e);
	}
	return undefined;
}

export async function render(params: RenderParams): Promise<RenderResult> {
	const { props = {}, src, condition = 'on:client', ssrOnly = false } = params;

	try {
		const Component = await loadComponent(src);
		if (!Component) {
			throw new Error('No component found');
		}

		// Type assertions needed because loadComponent returns unknown and props are dynamic

		const result: SvelteSsrRenderResult = svelteRender(Component as any, { props: props || {}, context: new Map() });
		const ssrHtml = result.body;
		const ssrHead = result.head || '';

		const scopeMatch = ssrHtml.match(/class="[^"]*\b(svelte-[a-z0-9]+)\b/);
		const scopeId = scopeMatch ? scopeMatch[1] : null;

		// Always try to extract CSS, even without a scopeId (Svelte 5 may not add scope classes)
		const css = await extractCSS(src, scopeId);

		return {
			html: ssrHtml,
			head: ssrHead || undefined,
			css: css || undefined,
			hydrationData: { src, props, framework: 'svelte', condition, ssrOnly },
		};
	} catch (error) {
		console.error('Svelte SSR failed:', error);
		throw error;
	}
}
