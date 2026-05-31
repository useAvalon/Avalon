/**
 * Island Discovery Types
 *
 * Type definitions for the nested islands discovery system.
 * Supports discovering island components in modular architectures
 * like /src/modules/[module]/islands/ and arbitrary nesting patterns.
 */

import type { Framework } from "../types.ts";

/**
 * Represents a discovered islands directory
 */
export interface IslandDirectory {
	/** Absolute path to the islands directory */
	path: string;
	/** Relative path from src/ (e.g., "modules/auth/islands") */
	relativePath: string;
	/** Namespace prefix for components (e.g., "modules/auth") */
	namespace: string;
	/** Whether this is the default /src/islands/ directory */
	isDefault: boolean;
}

/**
 * Represents a discovered island component
 */
export interface DiscoveredIsland {
	/** Component name without extension */
	name: string;
	/** Full absolute path to the component file */
	filePath: string;
	/** Relative path from project root */
	relativePath: string;
	/** Namespace (empty string for default islands directory) */
	namespace: string;
	/** Detected framework */
	framework: Framework;
	/** File extension (e.g., ".tsx", ".vue", ".svelte") */
	extension: string;
	/** The directory this island belongs to */
	directory: IslandDirectory;
}

/**
 * Represents a naming collision between islands
 */
export interface IslandCollision {
	/** Component name that has collisions */
	name: string;
	/** All islands with this name */
	islands: DiscoveredIsland[];
	/** Resolution strategy used */
	resolution: "namespace" | "priority";
}

/**
 * Event emitted when island files change
 */
export interface IslandChangeEvent {
	/** Type of change */
	type: "add" | "change" | "remove";
	/** Affected island (null for remove events before discovery) */
	island: DiscoveredIsland | null;
	/** File path that changed */
	filePath: string;
	/** Timestamp of the change */
	timestamp: number;
}

/**
 * Supported file extensions for island components
 */
export const ISLAND_FILE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".vue", ".svelte"] as const;

export type IslandFileExtension = (typeof ISLAND_FILE_EXTENSIONS)[number];

/**
 * Check if a file extension is supported for islands
 */
export function isSupportedIslandExtension(ext: string): ext is IslandFileExtension {
	return ISLAND_FILE_EXTENSIONS.includes(ext as IslandFileExtension);
}

/**
 * Configuration options for island discovery
 */
export interface IslandDiscoveryConfig {
	/** Root directory to scan (defaults to "src") */
	rootDir?: string;
	/** Additional directories to scan (beyond default patterns) */
	include?: string[];
	/** Directories to exclude from scanning */
	exclude?: string[];
	/** Custom namespace mapping */
	namespaces?: Record<string, string>;
	/** Whether to fail on naming collisions */
	strictCollisions?: boolean;
}

/**
 * Default configuration for island discovery
 */
export const DEFAULT_DISCOVERY_CONFIG: Required<IslandDiscoveryConfig> = {
	rootDir: "src",
	include: [],
	exclude: ["node_modules", ".git", "dist", "build"],
	namespaces: {},
	strictCollisions: false,
};
