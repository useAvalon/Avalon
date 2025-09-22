export type ImportConfig = { names: string[]; from: string };
export type CleanupFunction = () => void;

// Re-export layout types for convenience
export * from './layout.ts';
