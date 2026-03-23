import { useCallback, useEffect, useState } from "preact/hooks";
import { deserialize, serialize } from "./island-state-serializer.ts";

const KEY_PREFIX = "avalon-island";

/**
 * `useState` that survives page navigations.
 *
 * State is serialized to sessionStorage (or localStorage) via
 * {@link serialize}/{@link deserialize}, so Date, Map, Set, and RegExp are preserved.
 * On the server or when storage is unavailable, falls back to in-memory state.
 *
 * @param id - Unique key for this piece of state.
 * @param initialValue - Default value when nothing is stored yet.
 * @param options - Optional `{ storage: 'session' | 'local' }`. Defaults to `'session'`.
 * @returns `[value, setValue, clearValue]` — same shape as `useState` plus a clear function.
 *
 * @example
 * ```tsx
 * import { usePersistentState } from '@useavalon/avalon';
 *
 * function Counter() {
 *   const [count, setCount, clearCount] = usePersistentState('my-counter', 0);
 *   return (
 *     <div>
 *       <p>{count}</p>
 *       <button onClick={() => setCount(c => c + 1)}>+1</button>
 *       <button onClick={clearCount}>Reset</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePersistentState<T>(
	id: string,
	initialValue: T,
	options?: { storage?: "session" | "local" },
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
	const storageType = options?.storage ?? "session";
	const key = `${KEY_PREFIX}:${id}`;

	const [value, setValueInternal] = useState<T>(() => {
		if (globalThis.window === undefined) return initialValue;
		try {
			const store = storageType === "local" ? localStorage : sessionStorage;
			const raw = store.getItem(key);
			if (raw === null) return initialValue;
			const parsed = deserialize(raw);
			return (parsed as { v: T }).v ?? initialValue;
		} catch {
			return initialValue;
		}
	});

	useEffect(() => {
		if (globalThis.window === undefined) return;
		try {
			const store = storageType === "local" ? localStorage : sessionStorage;
			store.setItem(key, serialize({ v: value }));
		} catch {
			/* storage full or unavailable */
		}
	}, [value, key, storageType]);

	const setValue = useCallback((next: T | ((prev: T) => T)) => {
		setValueInternal((prev) =>
			typeof next === "function" ? (next as (prev: T) => T)(prev) : next,
		);
	}, []);

	const clear = useCallback(() => {
		setValueInternal(initialValue);
		if (globalThis.window === undefined) return;
		try {
			const store = storageType === "local" ? localStorage : sessionStorage;
			store.removeItem(key);
		} catch {
			/* ignore */
		}
	}, [initialValue, key, storageType]);

	return [value, setValue, clear];
}
