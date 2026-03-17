/** @jsxImportSource preact */
import type { ComponentChildren } from 'preact';
import { PersistentIslandProvider } from '../core/islands/persistent-island-context.tsx';
import { defaultIslandPersistence, type IslandPersistence } from '../core/islands/island-persistence.ts';

interface PersistentIslandProps {
	/** Unique ID used as the storage key for this island's state */
	persistentId: string;
	/** The island component(s) to wrap with persistence context */
	children: ComponentChildren;
	/** Custom persistence instance (defaults to sessionStorage-backed) */
	persistence?: IslandPersistence;
}

/**
 * PersistentIsland — provides automatic state persistence context to child islands.
 *
 * Wrap any island with this component and use `usePersistentIslandContext()` inside
 * the island to get `saveState`, `loadState`, and `clearState` functions.
 *
 * Usage in a page:
 * ```tsx
 * <PersistentIsland persistentId="my-counter" island={{ condition: 'on:client' }}>
 *   <MyCounter />
 * </PersistentIsland>
 * ```
 *
 * Usage inside the island:
 * ```tsx
 * import { usePersistentIslandContext } from '@useavalon/avalon';
 *
 * function MyCounter() {
 *   const { saveState, loadState, clearState } = usePersistentIslandContext();
 *   // ...
 * }
 * ```
 */
export function PersistentIsland({
	persistentId,
	children,
	persistence = defaultIslandPersistence,
}: Readonly<PersistentIslandProps>) {
	return (
		<PersistentIslandProvider persistentId={persistentId} persistence={persistence}>
			<div data-persistent-id={persistentId}>
				{children}
			</div>
		</PersistentIslandProvider>
	);
}

export default PersistentIsland;
