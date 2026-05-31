import { readFile } from "node:fs/promises";
import { resolveIslandPath } from "@useavalon/avalon/islands/framework-detection";
import type { RenderParams, RenderResult } from "@useavalon/core/types";
import { toImportSpecifier } from "@useavalon/core/utils";
import { render as svelteRender } from "svelte/server";
import type { SvelteSsrRenderResult } from "../types.ts";

async function loadComponent(src: string) {
	const isDev = process.env.NODE_ENV !== "production";

	if (isDev && globalThis.__viteDevServer) {
		const resolvedPath = await resolveIslandPath(src);
		const module = await globalThis.__viteDevServer.ssrLoadModule(resolvedPath);
		return module.default || module;
	}

	const ssrPath = src.replace("/islands/", "/dist/ssr/islands/").replace(/\.svelte$/, ".js");
	const module = (await import(
		/* @vite-ignore */
		toImportSpecifier(ssrPath)
	)) as Record<string, unknown>;
	return module.default || module;
}

async function extractCSS(src: string, scopeId: string | null) {
	try {
		const resolved = await resolveIslandPath(src);
		const filePath = resolved.startsWith("/") ? resolved.slice(1) : resolved;
		const sourceCode = await readFile(filePath, "utf-8");
		const styleMatch = sourceCode.match(/<style[^>]*>([\s\S]*?)<\/style>/);

		if (styleMatch) {
			const rawCSS = styleMatch[1].trim();
			// If we have a scopeId, apply scoping to class selectors
			if (scopeId) {
				const scopedCSS = rawCSS.replaceAll(
					/(\.[a-zA-Z_-][a-zA-Z0-9_-]*)/g,
					(match) => match + "." + scopeId,
				);
				return scopedCSS;
			}
			// Return raw CSS if no scopeId (Svelte 5 handles scoping differently)
			return rawCSS;
		}
	} catch (e) {
		console.error("CSS extraction failed:", e);
	}
	return undefined;
}

export async function render(params: RenderParams): Promise<RenderResult> {
	const {
		component: preloaded,
		props = {},
		src,
		condition = "on:client",
		ssrOnly = false,
	} = params;

	try {
		const Component = preloaded || (await loadComponent(src));
		if (!Component) {
			throw new Error("No component found");
		}

		// Type assertions needed because loadComponent returns unknown and props are dynamic

		const result: SvelteSsrRenderResult = svelteRender(Component as any, {
			props: props || {},
			context: new Map(),
		});
		const ssrHtml = result.body;
		const ssrHead = result.head || "";

		// Svelte 5's render() returns CSS directly in the result — use it first.
		// Only fall back to extractCSS (reads source file from disk) in dev when render() doesn't provide CSS.
		let css: string | undefined;
		if (result.css?.code) {
			css = result.css.code;
		} else {
			const scopeMatch = ssrHtml.match(/class="[^"]*\b(svelte-[a-z0-9]+)\b/);
			const scopeId = scopeMatch ? scopeMatch[1] : null;
			css = await extractCSS(src, scopeId);
		}

		return {
			html: ssrHtml,
			head: ssrHead || undefined,
			css: css || undefined,
			hydrationData: { src, props, framework: "svelte", condition, ssrOnly },
		};
	} catch (error) {
		console.error("Svelte SSR failed:", error);
		throw error;
	}
}
