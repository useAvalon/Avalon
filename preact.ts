export { default as Island } from './src/islands/preact.tsx';

export { withImports } from './src/HOF/preact.ts';
export { from } from './src/helpers/from.ts';
export type {
	PreactIslandProps,
	PreactComponentFunction,
	PreactComponentWithMetadata,
} from './src/schemas/frameworks.ts';
export type { ImportConfig, IslandCondition, ComponentMetadata } from './src/schemas/core.ts';
