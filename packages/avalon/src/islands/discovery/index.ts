/**
 * Island Discovery Module
 * 
 * Exports all types and functions for discovering island components
 * in nested directory structures.
 */

// Types
export type {
  IslandDirectory,
  DiscoveredIsland,
  IslandCollision,
  IslandChangeEvent,
  IslandFileExtension,
  IslandDiscoveryConfig,
} from "./types.ts";

export {
  ISLAND_FILE_EXTENSIONS,
  DEFAULT_DISCOVERY_CONFIG,
  isSupportedIslandExtension,
} from "./types.ts";

// Scanner functions
export {
  discoverIslandDirectories,
  discoverIslandsInDirectory,
  discoverAllIslands,
  isIslandsDirectory,
  getDefaultIslandsPath,
  hasDefaultIslandsDirectory,
  getQualifiedIslandName,
  parseQualifiedIslandName,
} from "./scanner.ts";

// Registry
export {
  IslandRegistry,
  createIslandRegistry,
} from "./registry.ts";

// Resolver
export type {
  ResolutionResult,
  ImportPathOptions,
} from "./resolver.ts";

export {
  IslandResolver,
  createIslandResolver,
} from "./resolver.ts";

// Validator
export type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  CircularDependency,
} from "./validator.ts";

export {
  IslandValidator,
  createIslandValidator,
  validateAllIslands,
  formatValidationError,
  formatValidationWarning,
  formatCircularDependency,
  formatValidationResult,
} from "./validator.ts";

// Watcher
export type {
  IslandChangeCallback,
  IslandWatcherOptions,
} from "./watcher.ts";

export {
  IslandWatcher,
  createIslandWatcher,
} from "./watcher.ts";
