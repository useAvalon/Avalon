/**
 * Module Discovery for Modular Architecture
 *
 * Discovers pages and layouts within feature modules for file-based routing.
 * Supports co-located architecture where each module contains its own pages/layouts.
 */

import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ResolvedModulesConfig } from "./types.ts";

/**
 * Discovered module with its pages and layouts directories
 */
export interface DiscoveredModule {
	/** Module name (folder name) */
	name: string;
	/** Absolute path to the module directory */
	path: string;
	/** Absolute path to pages directory (if exists) */
	pagesDir: string | null;
	/** Absolute path to layouts directory (if exists) */
	layoutsDir: string | null;
	/** Route prefix derived from module name */
	routePrefix: string;
}

/**
 * Result of module discovery
 */
export interface ModuleDiscoveryResult {
	/** All discovered modules */
	modules: DiscoveredModule[];
	/** All page directories (for route discovery) */
	pageDirs: Array<{ dir: string; prefix: string }>;
	/** All layout directories */
	layoutDirs: Array<{ dir: string; prefix: string }>;
}

/**
 * Discover all modules within the modules directory
 *
 * @param modulesConfig - Resolved modules configuration
 * @param projectRoot - Project root directory
 * @returns Discovery result with modules, page dirs, and layout dirs
 */
export async function discoverModules(
	modulesConfig: ResolvedModulesConfig,
	projectRoot: string,
): Promise<ModuleDiscoveryResult> {
	const modulesDir = resolve(projectRoot, modulesConfig.dir);
	const modules: DiscoveredModule[] = [];
	const pageDirs: Array<{ dir: string; prefix: string }> = [];
	const layoutDirs: Array<{ dir: string; prefix: string }> = [];

	try {
		const entries = await readdir(modulesDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;

			// Skip hidden directories and common non-module folders
			if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

			const modulePath = join(modulesDir, entry.name);
			const pagesPath = join(modulePath, modulesConfig.pagesDirName);
			const layoutsPath = join(modulePath, modulesConfig.layoutsDirName);

			// Check if pages/layouts directories exist
			const [pagesExists, layoutsExists] = await Promise.all([
				directoryExists(pagesPath),
				directoryExists(layoutsPath),
			]);

			// Determine route prefix
			// 'home' or 'root' module maps to '/', others map to '/moduleName'
			const routePrefix = getRoutePrefix(entry.name);

			const module: DiscoveredModule = {
				name: entry.name,
				path: modulePath,
				pagesDir: pagesExists ? pagesPath : null,
				layoutsDir: layoutsExists ? layoutsPath : null,
				routePrefix,
			};

			modules.push(module);

			if (pagesExists) {
				pageDirs.push({ dir: pagesPath, prefix: routePrefix });
			}

			if (layoutsExists) {
				layoutDirs.push({ dir: layoutsPath, prefix: routePrefix });
			}
		}
	} catch (error) {
		// Modules directory doesn't exist or can't be read
		// This is fine - modules are optional
	}

	// Sort modules so 'home'/'root' comes first (for route priority)
	modules.sort((a, b) => {
		if (a.routePrefix === "/") return -1;
		if (b.routePrefix === "/") return 1;
		return a.name.localeCompare(b.name);
	});

	return { modules, pageDirs, layoutDirs };
}

/**
 * Get the route prefix for a module
 * Special modules like 'home', 'root', 'main' map to '/'
 */
function getRoutePrefix(moduleName: string): string {
	const rootModules = ["home", "root", "main", "index"];
	if (rootModules.includes(moduleName.toLowerCase())) {
		return "/";
	}
	return "/" + moduleName;
}

/**
 * Check if a directory exists
 */
async function directoryExists(path: string): Promise<boolean> {
	try {
		const stats = await stat(path);
		return stats.isDirectory();
	} catch {
		return false;
	}
}

/**
 * Get all page directories including both traditional and modular
 *
 * @param pagesDir - Traditional pages directory
 * @param modulesConfig - Modules configuration (if any)
 * @param projectRoot - Project root
 * @returns Array of page directories with their route prefixes
 */
export async function getAllPageDirs(
	pagesDir: string,
	modulesConfig: ResolvedModulesConfig | null,
	projectRoot: string,
): Promise<Array<{ dir: string; prefix: string }>> {
	const dirs: Array<{ dir: string; prefix: string }> = [];

	// Add traditional pages directory
	const traditionalPagesPath = resolve(projectRoot, pagesDir);
	if (await directoryExists(traditionalPagesPath)) {
		dirs.push({ dir: traditionalPagesPath, prefix: "/" });
	}

	// Add modular page directories
	if (modulesConfig) {
		const { pageDirs } = await discoverModules(modulesConfig, projectRoot);
		dirs.push(...pageDirs);
	}

	return dirs;
}

/**
 * Get all layout directories including both traditional and modular
 */
export async function getAllLayoutDirs(
	layoutsDir: string,
	modulesConfig: ResolvedModulesConfig | null,
	projectRoot: string,
): Promise<Array<{ dir: string; prefix: string }>> {
	const dirs: Array<{ dir: string; prefix: string }> = [];

	// Add traditional layouts directory
	const traditionalLayoutsPath = resolve(projectRoot, layoutsDir);
	if (await directoryExists(traditionalLayoutsPath)) {
		dirs.push({ dir: traditionalLayoutsPath, prefix: "/" });
	}

	// Add modular layout directories
	if (modulesConfig) {
		const { layoutDirs } = await discoverModules(modulesConfig, projectRoot);
		dirs.push(...layoutDirs);
	}

	return dirs;
}
