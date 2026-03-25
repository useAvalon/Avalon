/**
 * Solid server-side renderer
 * Handles SSR for Solid components using solid-js/web
 *
 * Migrated from src/islands/renderers/solid-renderer.ts
 */

import type { RenderParams, RenderResult } from '@useavalon/core/types';
import { loadComponent } from './utils.ts';
import { resolveIslandPath } from '@useavalon/avalon/islands/framework-detection';
import { setSolidHydrationScript } from '@useavalon/avalon/islands/universal-head-collector';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

/**
 * Collect CSS imported by a Solid component.
 * Reads the component source to find CSS imports and returns their content.
 */
async function collectComponentCSS(src: string): Promise<string | undefined> {
	try {
		const resolvedPath = await resolveIslandPath(src);
		const filePath = resolvedPath.startsWith('/') ? resolvedPath.slice(1) : resolvedPath;
		const source = await readFile(filePath, 'utf-8');

		// Match CSS imports: import './Foo.css' or import "./Foo.css"
		const cssImports = [...source.matchAll(/import\s+['"]([^'"]+\.css)['"]/g)];
		if (cssImports.length === 0) return undefined;

		const dir = dirname(filePath);
		const chunks: string[] = [];

		for (const [, cssPath] of cssImports) {
			try {
				const fullPath = resolve(dir, cssPath);
				const css = await readFile(fullPath, 'utf-8');
				if (css.trim()) chunks.push(css.trim());
			} catch {
				// CSS file not found, skip
			}
		}

		return chunks.length > 0 ? chunks.join('\n') : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Extract inline <style> tags from Solid's rendered HTML.
 *
 * Solid's compiled output can produce `<style>` blocks (e.g. from CSS-in-JS
 * or `<style jsx>` patterns) that are embedded directly in the rendered HTML.
 * When the same component is rendered multiple times, these blocks repeat
 * per instance. By extracting them here, we route them through the universal
 * CSS collector which deduplicates by content hash, resulting in a single
 * `<style>` block in `<head>` instead of repeated inline styles.
 *
 * @returns Object with cleaned HTML and extracted CSS chunks (deduplicated)
 */
export function extractInlineStyles(html: string): { html: string; css: string[] } {
	const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
	const cssChunks: string[] = [];
	const seen = new Set<string>();

	let match = styleRegex.exec(html);
	while (match !== null) {
		const cssContent = match[1].trim();
		if (cssContent && !seen.has(cssContent)) {
			seen.add(cssContent);
			cssChunks.push(cssContent);
		}
		match = styleRegex.exec(html);
	}

	// Strip all <style> tags from the HTML
	const cleanedHtml = html.replaceAll(styleRegex, '');

	return { html: cleanedHtml, css: cssChunks };
}

/**
 * Render a Solid component to HTML string
 *
 * Uses Solid's renderToStringAsync for proper SSR with reactive system support.
 * Handles both named and default exports from solid-js/web.
 *
 * @param params - Render parameters including component, props, and source path
 * @returns Render result with HTML and hydration data
 */
export async function render(params: RenderParams): Promise<RenderResult> {
	const { component, props = {}, src, condition = 'on:client', ssrOnly = false } = params;

	try {
		const Component = component || (await loadComponent(src));

		if (!Component || typeof Component !== 'function') {
			throw new Error(`Invalid Solid component in ${src}: expected function, got ${typeof Component}`);
		}

		// Import Solid.js SSR utilities
		const solidWeb = await import('solid-js/web');

		const solidWebModule = solidWeb as any;
		const renderToStringAsync: (fn: () => unknown, options?: { nonce?: string; renderId?: string }) => Promise<string> =
			solidWebModule.renderToStringAsync ||
			solidWebModule.default?.renderToStringAsync ||
			(() => {
				const renderToString = solidWebModule.renderToString || solidWebModule.default?.renderToString;
				if (!renderToString) throw new Error('Neither renderToStringAsync nor renderToString found in solid-js/web');
				return (fn: () => unknown) => Promise.resolve(renderToString(fn));
			})();
		const createComponent: (component: any, props: any) => any =
			solidWebModule.createComponent || solidWebModule.default?.createComponent;
		const generateHydrationScript: ((options?: { nonce?: string; eventNames?: string[] }) => string) | undefined =
			solidWebModule.generateHydrationScript || solidWebModule.default?.generateHydrationScript;

		if (!createComponent) throw new Error('createComponent not found in solid-js/web');

		// Cache the Solid hydration bootstrap script on first render.
		// It will only be injected into pages that contain Solid islands.
		if (generateHydrationScript && !globalThis.__solidHydrationScript) {
			setSolidHydrationScript(generateHydrationScript());
		}

		const renderId = `s${Math.random().toString(36).slice(2, 11)}`;

		const html = await renderToStringAsync(() => createComponent(Component, props), { renderId });

		// Allow empty strings (component might render nothing visible)
		// Only reject null/undefined or non-string types
		if (html === null || html === undefined) {
			throw new Error(`renderToStringAsync returned null/undefined`);
		}
		if (typeof html !== 'string') {
			throw new Error(`renderToStringAsync returned invalid type: ${typeof html}`);
		}

		const containerId = `solid-island-${src.replaceAll(/[^a-zA-Z0-9]/g, '-')}`;

		// Extract inline <style> tags from the rendered HTML so they go through
		// the universal CSS collector for deduplication (one <style> in <head>
		// instead of repeated per-instance blocks).
		const { html: cleanedHtml, css: inlineCSS } = extractInlineStyles(html);

		// Collect CSS from imported .css files
		const fileCSS = await collectComponentCSS(src);

		// Merge file-imported CSS and extracted inline CSS
		const allCSS = [fileCSS, ...inlineCSS].filter(Boolean).join('\n');

		// NOTE: The Solid hydration bootstrap script (window._$HY, ~300 bytes)
		// is NOT returned in `head` here. It is injected once at the HTML
		// assembly level only when Solid islands are present on the page.
		// See universal-head-collector.ts `injectSolidHydrationScriptIfNeeded`.
		return {
			html: cleanedHtml,
			css: allCSS || undefined,
			hydrationData: { src, props, framework: 'solid', condition, containerId, ssrOnly, renderId },
		};
	} catch (error) {
		throw new Error(
			`Failed to render Solid component ${src}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

/**
 * Render a Solid component with error boundary
 */
export async function renderWithErrorBoundary(params: RenderParams): Promise<RenderResult | null> {
	try {
		return await render(params);
	} catch {
		return null;
	}
}
