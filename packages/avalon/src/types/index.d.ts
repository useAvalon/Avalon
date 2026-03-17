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

// Re-export island prop types
export * from './island-prop.d.ts';

// Import JSX augmentations (side-effect import for type augmentation)
import './island-jsx.d.ts';

// Import image type declarations
import './image.d.ts';
