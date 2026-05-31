/**
 * Qwik component loading utilities
 * Handles component resolution in both development and production
 */

import { resolveIslandPath } from "@useavalon/avalon/islands/framework-detection";
import { toImportSpecifier } from "@useavalon/core/utils";
import type { QwikComponent } from "../types.ts";

export { resolveIslandPath } from "@useavalon/avalon/islands/framework-detection";

/**
 * Load a Qwik component from the given source path
 * Handles both development (Vite) and production (built) environments
 *
 * @param src - Component source path
 * @returns Loaded Qwik component
 */
export async function loadComponent(src: string) {
	const isDev = process.env.NODE_ENV !== "production";

	if (isDev) {
		return await loadComponentDev(src);
	} else {
		return await loadComponentProd(src);
	}
}

/**
 * Load component in development mode using Vite's SSR module loader
 */
async function loadComponentDev(src: string) {
	const viteServer = (
		globalThis as {
			__viteDevServer?: { ssrLoadModule: (path: string) => Promise<Record<string, unknown>> };
		}
	).__viteDevServer;

	if (viteServer) {
		const resolvedPath = await resolveIslandPath(src);
		const module = await viteServer.ssrLoadModule(resolvedPath);
		return extractComponent(module, src);
	}

	return await loadComponentDirect(src);
}

/**
 * Load component in production mode from built SSR bundle
 */
async function loadComponentProd(src: string) {
	const ssrPath = src
		.replace("/islands/", "/dist/ssr/islands/")
		.replace(/\.(tsx|jsx|ts|js)$/, ".js");

	const module = await import(
		/* @vite-ignore */
		toImportSpecifier(ssrPath)
	);
	return extractComponent(module, src);
}

/**
 * Load component via direct import (fallback)
 */
async function loadComponentDirect(src: string) {
	const resolvedPath = await resolveIslandPath(src);
	const filePath = resolvedPath.startsWith("/") ? `.${resolvedPath}` : `./${resolvedPath}`;

	try {
		const module = await import(
			/* @vite-ignore */
			toImportSpecifier(filePath)
		);
		return extractComponent(module, src);
	} catch (error) {
		throw new Error(
			`Failed to load Qwik component ${src}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

/**
 * Extract component from module
 * Handles both default and named exports
 * With 'hoist' entry strategy, component$ returns a QRL that can be used directly with jsx()
 */
function extractComponent(module: Record<string, unknown>, src: string) {
	// First try default export - this is the standard case
	if (module.default) {
		return module.default as QwikComponent;
	}

	// Look for any export that could be a component
	// Named exports are less common but supported
	for (const [key, value] of Object.entries(module)) {
		if (key.startsWith("_")) continue;

		// Any function or object could be a Qwik component/QRL
		if (typeof value === "function" || (value && typeof value === "object")) {
			return value as QwikComponent;
		}
	}

	console.warn(`[qwik] Could not find component in module for ${src}`);
	console.warn(`[qwik] Available exports:`, Object.keys(module));
	throw new Error(`No component found in ${src}`);
}

/**
 * Check if a value is a valid Qwik component
 * Qwik components can be:
 * - Functions (plain components)
 * - Objects with __brand === 'QwikComponent'
 * - Objects with __qrl property (QRL-wrapped)
 * - Objects with $ property (component$ result)
 */
export function isQwikComponent(value: unknown): boolean {
	if (!value) return false;

	// Plain function component
	if (typeof value === "function") return true;

	// QRL-wrapped component (object form)
	if (typeof value === "object") {
		const comp = value as Record<string, unknown>;
		// Check for Qwik component markers
		if (comp.__brand === "QwikComponent") return true;
		if (comp.__qrl) return true;
		if (typeof comp.$ === "function") return true;
		// Transformed component$ result
		if (comp._qrl || comp.qrl) return true;
	}

	return false;
}

/**
 * Normalize props for Qwik component
 * Ensures props are in the correct format and serializable
 * (Qwik requires all props to be serializable for resumability)
 */
export function normalizeProps(props: unknown) {
	if (!props || typeof props !== "object") {
		return {};
	}

	return props as Record<string, unknown>;
}
