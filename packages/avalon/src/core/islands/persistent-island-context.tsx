import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext } from 'preact/hooks';
import type { IslandState } from '../../schemas/layout.ts';
import { defaultIslandPersistence } from './island-persistence.ts';

/**
 * Explicit interface for persistent island context
 * (Zod z.any() inference for function types is unreliable)
 */
export interface PersistentIslandContextType {
	saveState: (state: IslandState) => void;
	loadState: () => IslandState | null;
	clearState: () => void;
}

/**
 * Context for persistent island state operations
 *
 * Provides save, load, and clear operations for island state management
 * across navigation and browser sessions.
 */
export const PersistentIslandContextProvider = createContext<PersistentIslandContextType | null>(null as PersistentIslandContextType | null);

/**
 * Create a persistent island context for a specific island ID
 */
export function createPersistentIslandContext(
	persistentId: string,
	persistence = defaultIslandPersistence
): PersistentIslandContextType {
	return {
		saveState: (state: IslandState) => {
			persistence.saveState(persistentId, state);
		},

		loadState: (): IslandState | null => {
			return persistence.loadState(persistentId);
		},

		clearState: () => {
			persistence.clearState(persistentId);
		},
	};
}

/**
 * Hook to use persistent island context
 * Must be used within a PersistentIsland component
 */
export function usePersistentIslandContext(): PersistentIslandContextType {
	const context = useContext(PersistentIslandContextProvider);

	if (!context) {
		throw new Error('usePersistentIslandContext must be used within a PersistentIsland component');
	}

	return context;
}

/**
 * Provider component for persistent island context
 */
export function PersistentIslandProvider({
	persistentId,
	children,
	persistence = defaultIslandPersistence,
}: Readonly<{
	persistentId: string;
	children: ComponentChildren;
	persistence?: typeof defaultIslandPersistence;
}>) {
	const contextValue = createPersistentIslandContext(persistentId, persistence);

	return (
		<PersistentIslandContextProvider.Provider value={contextValue}>
			{children}
		</PersistentIslandContextProvider.Provider>
	);
}
