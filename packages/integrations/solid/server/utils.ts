/**
 * Solid component loading utilities
 * Handles component resolution in both development and production
 */

import type { SolidComponent } from '../types.ts';
import { toImportSpecifier } from '@useavalon/core/utils';
import { resolveIslandPath } from '@useavalon/avalon/islands/framework-detection';
export { resolveIslandPath } from '@useavalon/avalon/islands/framework-detection';

/**
 * Load a Solid component from the given source path
 * Handles both development (Vite) and production (built) environments
 *
 * @param src - Component source path
 * @returns Loaded Solid component
 */
export async function loadComponent(src: string) {
	const isDev = process.env.NODE_ENV !== 'production';

	if (isDev) {
		return await loadComponentDev(src);
	} else {
		return await loadComponentProd(src);
	}
}

/**
 * Load component in development mode using Vite's SSR module loader
 *
 * @param src - Component source path
 * @returns Loaded component
 */
async function loadComponentDev(src: string) {
	const viteServer = (
		globalThis as { __viteDevServer?: { 
			ssrLoadModule: (path: string) => Promise<Record<string, unknown>>;
		} }
	).__viteDevServer;

	if (viteServer) {
		const resolvedPath = await resolveIslandPath(src);
		const module = await viteServer.ssrLoadModule(resolvedPath);
		return extractComponent(module, src);
	}

	// Fallback: direct import when Vite server is not available
	return await loadComponentDirect(src);
}

/**
 * Load component in production mode from built SSR bundle
 *
 * @param src - Component source path
 * @returns Loaded component
 */
async function loadComponentProd(src: string) {
	const ssrPath = src.replace('/islands/', '/dist/ssr/islands/').replace(/\.(tsx|jsx|ts|js)$/, '.js');

	const module = await import(
		/* @vite-ignore */
		toImportSpecifier(ssrPath)
	);
	return extractComponent(module, src);
}

/**
 * Load component via direct import (fallback)
 *
 * @param src - Component source path
 * @returns Loaded component
 */
async function loadComponentDirect(src: string) {
	const resolvedPath = await resolveIslandPath(src);
	const filePath = resolvedPath.startsWith('/') ? `.${resolvedPath}` : `./${resolvedPath}`;

	try {
		const module = await import(
			/* @vite-ignore */
			toImportSpecifier(filePath)
		);
		return extractComponent(module, src);
	} catch (error) {
		throw new Error(
			`Failed to load Solid component ${src}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}

/**
 * Extract component from module
 * Handles both default and named exports
 *
 * @param module - Imported module
 * @param src - Component source path (for error messages)
 * @returns Extracted component
 */
function extractComponent(module: Record<string, unknown>, src: string) {
	const component = module.default || module;

	if (!component || typeof component !== 'function') {
		throw new Error(`Invalid Solid component in ${src}: expected function, got ${typeof component}`);
	}

	return component as SolidComponent;
}

/**
 * Check if a value is a valid Solid component
 *
 * @param value - Value to check
 * @returns True if value is a Solid component
 */
export function isSolidComponent(value: unknown) {
	return typeof value === 'function';
}

/**
 * Normalize props for Solid component
 * Ensures props are in the correct format
 *
 * @param props - Raw props object
 * @returns Normalized props
 */
export function normalizeProps(props: unknown) {
	if (!props || typeof props !== 'object') {
		return {};
	}

	return props as Record<string, unknown>;
}
