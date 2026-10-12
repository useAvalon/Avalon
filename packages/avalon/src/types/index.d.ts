/**
 * Avalon type definitions.
 *
 * Include this in your tsconfig.json `types` array to get island prop support:
 *
 * ```json
 * {
 *   "compilerOptions": {
 *     "types": ["@useavalon/avalon/types"]
 *   }
 * }
 * ```
 */

// Triple-slash references keep augmentations ambient when this entry is loaded
// via `compilerOptions.types` (side-effect `import()` of a module .d.ts does not
// always merge `declare module` augmentations into the consumer program).
/// <reference path="./island-jsx.d.ts" />
/// <reference path="./image.d.ts" />
/// <reference path="./virtual-modules.d.ts" />

// Re-export island prop types
export * from "./island-prop.d.ts";
