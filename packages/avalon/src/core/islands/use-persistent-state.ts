/** @jsxImportSource preact */
import { useState, useEffect, useCallback } from 'preact/hooks';
import { IslandStateSerializer } from './island-state-serializer.ts';

const KEY_PREFIX = 'avalon-island';

/**
 * Hook for persistent island state — like useState but survives navigations.
 *
 * State is serialized to sessionStorage (supports Date, Map, Set, RegExp).
 * On the server or when storage is unavailable, falls back to in-memory state.
 *
 * ```tsx
 * const [count, setCount, clearCount] = usePersistentState('my-counter', 0);
 * ```
 *
 * @param id - Unique storage key for this piece of state
 * @param initialValue - Default value when no persisted state exists
 * @param options - Optional: `storage` ('session' | 'local'), defaults to 'session'
 */
export function usePersistentState<T>(
	id: string,
	initialValue: T,
	options?: { storage?: 'session' | 'local' },
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
	const storageType = options?.storage ?? 'session';
	const key = `${KEY_PREFIX}:${id}`;

	const [value, setValueInternal] = useState<T>(() => {
		if (typeof window === 'undefined') return initialValue;
		try {
			const store = storageType === 'local' ? localStorage : sessionStorage;
			const raw = store.getItem(key);
			if (raw === null) return initialValue;
			const parsed = IslandStateSerializer.deserialize(raw);
			return (parsed as { v: T }).v ?? initialValue;
		} catch {
			return initialValue;
		}
	});

	// Persist whenever value changes
	useEffect(() => {
		if (typeof window === 'undefined') return;
		try {
			const store = storageType === 'local' ? localStorage : sessionStorage;
			store.setItem(key, IslandStateSerializer.serialize({ v: value }));
		} catch { /* storage full or unavailable */ }
	}, [value, key, storageType]);

	const setValue = useCallback((next: T | ((prev: T) => T)) => {
		setValueInternal(prev => {
			const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
			return resolved;
		});
	}, []);

	const clear = useCallback(() => {
		setValueInternal(initialValue);
		if (typeof window === 'undefined') return;
		try {
			const store = storageType === 'local' ? localStorage : sessionStorage;
			store.removeItem(key);
		} catch { /* ignore */ }
	}, [initialValue, key, storageType]);

	return [value, setValue, clear];
}
