import { createContext, h } from 'preact';
import { useContext } from 'preact/hooks';
import type { IslandState, PersistentIslandContext } from '../../schemas/layout.ts';
import { defaultIslandPersistence } from './island-persistence.ts';

/**
 * Context for persistent island state operations
 *
 * Provides save, load, and clear operations for island state management
 * across navigation and browser sessions.
 */
export const PersistentIslandContextProvider = createContext<PersistentIslandContext | null>(null);

/**
 * Create a persistent island context for a specific island ID
 */
export function createPersistentIslandContext(
	persistentId: string,
	persistence = defaultIslandPersistence
): PersistentIslandContext {
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
export function usePersistentIslandContext(): PersistentIslandContext {
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
}: {
	persistentId: string;
	children: any;
	persistence?: typeof defaultIslandPersistence;
}) {
	const contextValue = createPersistentIslandContext(persistentId, persistence);

	return h(PersistentIslandContextProvider.Provider, { value: contextValue }, children);
}
