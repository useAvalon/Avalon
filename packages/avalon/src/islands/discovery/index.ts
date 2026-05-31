/**
 * Island Discovery Module
 *
 * Exports all types and functions for discovering island components
 * in nested directory structures.
 */

// Registry
export {
	createIslandRegistry,
	IslandRegistry,
} from "./registry.ts";
// Resolver
export type {
	ImportPathOptions,
	ResolutionResult,
} from "./resolver.ts";
export {
	createIslandResolver,
	IslandResolver,
} from "./resolver.ts";
// Scanner functions
export {
	discoverAllIslands,
	discoverIslandDirectories,
	discoverIslandsInDirectory,
	getDefaultIslandsPath,
	getQualifiedIslandName,
	hasDefaultIslandsDirectory,
	isIslandsDirectory,
	parseQualifiedIslandName,
} from "./scanner.ts";
// Types
export type {
	DiscoveredIsland,
	IslandChangeEvent,
	IslandCollision,
	IslandDirectory,
	IslandDiscoveryConfig,
	IslandFileExtension,
} from "./types.ts";
export {
	DEFAULT_DISCOVERY_CONFIG,
	ISLAND_FILE_EXTENSIONS,
	isSupportedIslandExtension,
} from "./types.ts";

// Validator
export type {
	CircularDependency,
	ValidationError,
	ValidationResult,
	ValidationWarning,
} from "./validator.ts";

export {
	createIslandValidator,
	formatCircularDependency,
	formatValidationError,
	formatValidationResult,
	formatValidationWarning,
	IslandValidator,
	validateAllIslands,
} from "./validator.ts";

// Watcher
export type {
	IslandChangeCallback,
	IslandWatcherOptions,
} from "./watcher.ts";

export {
	createIslandWatcher,
	IslandWatcher,
} from "./watcher.ts";
