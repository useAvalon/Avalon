/**
 * Discover file-based page routes for tooling (sitemaps, llms.txt, etc.).
 *
 * Uses the same page directories as Avalon's Nitro integration: modular
 * `app/modules` when configured or present, plus the traditional pages dir.
 */

import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { discoverPageRoutesFromMultipleDirs } from "./nitro/route-discovery.ts";
import { getAllPageDirs } from "./vite-plugin/module-discovery.ts";
import type { ResolvedModulesConfig } from "./vite-plugin/types.ts";

export interface DiscoverProjectPageRoutesOptions {
	/** Project root (Vite root in dev, `process.cwd()` at build). */
	projectRoot: string;
	/** Match dev-server logging in route discovery. */
	developmentMode?: boolean;
	/** Traditional pages directory relative to project root (default `src/pages`). */
	pagesDir?: string;
	/**
	 * Modular layout. Omitted: infer from `app/modules` when present.
	 * Explicit `null`: traditional pages only (no modular dirs).
	 */
	modules?: ResolvedModulesConfig | null;
}

export interface DiscoveredProjectPageRoute {
	pattern: string;
	type?: string;
}

const DEFAULT_MODULES_CONFIG: ResolvedModulesConfig = {
	dir: "app/modules",
	pagesDirName: "pages",
	layoutsDirName: "layouts",
};

async function directoryExists(dir: string): Promise<boolean> {
	try {
		const stats = await stat(dir);
		return stats.isDirectory();
	} catch {
		return false;
	}
}

async function resolveModulesConfig(
	projectRoot: string,
	modules: ResolvedModulesConfig | null | undefined,
): Promise<ResolvedModulesConfig | null> {
	if (modules !== undefined) return modules;
	const modulesPath = join(projectRoot, DEFAULT_MODULES_CONFIG.dir);
	if (await directoryExists(modulesPath)) return DEFAULT_MODULES_CONFIG;
	return null;
}

/**
 * List URL patterns for all page routes in the project.
 */
export async function discoverProjectPageRoutes(
	options: DiscoverProjectPageRoutesOptions,
): Promise<DiscoveredProjectPageRoute[]> {
	const projectRoot = resolve(options.projectRoot);
	const pagesDir = options.pagesDir ?? "src/pages";
	const modulesConfig = await resolveModulesConfig(projectRoot, options.modules);

	const pageDirs = modulesConfig
		? await getAllPageDirs(pagesDir, modulesConfig, projectRoot)
		: await traditionalPageDirOnly(projectRoot, pagesDir);

	if (pageDirs.length === 0) return [];

	const routes = await discoverPageRoutesFromMultipleDirs(pageDirs, {
		developmentMode: options.developmentMode,
	});
	return routes.filter((route) => route.type === "page");
}

async function traditionalPageDirOnly(
	projectRoot: string,
	pagesDir: string,
): Promise<Array<{ dir: string; prefix: string }>> {
	const dir = resolve(projectRoot, pagesDir);
	if (!(await directoryExists(dir))) return [];
	return [{ dir, prefix: "/" }];
}
