import type { IslandState } from '../../schemas/layout.ts';
import type { IIslandPersistence } from '../../types/layout.ts';
import { IslandStateSerializer } from './island-state-serializer.ts';

/**
 * IslandPersistence class for state management across navigation
 *
 * Handles saving, loading, and clearing island state using browser storage
 * with support for both sessionStorage and localStorage persistence strategies.
 */
export class IslandPersistence implements IIslandPersistence {
	private storageType: 'session' | 'local';
	private keyPrefix: string;
	private storage: Storage | null = null;

	constructor(
		options: {
			storageType?: 'session' | 'local';
			keyPrefix?: string;
		} = {}
	) {
		this.storageType = options.storageType || 'session';
		this.keyPrefix = options.keyPrefix || 'island-state';

		// Initialize storage if available (browser environment)
		if (typeof window !== 'undefined') {
			this.storage = this.storageType === 'session' ? sessionStorage : localStorage;
		}
	}

	/**
	 * Save island state to browser storage
	 */
	saveState(id: string, state: IslandState): void {
		if (!this.storage) {
			console.warn('Island persistence: Storage not available (server-side or unsupported browser)');
			return;
		}

		try {
			const key = this.getStorageKey(id);

			// Use the IslandStateSerializer for proper serialization
			const serializedState = IslandStateSerializer.serialize({
				state,
				timestamp: Date.now(),
				version: '1.0',
			});

			this.storage.setItem(key, serializedState);
			console.log(`Island state saved for ${id}`);
		} catch (error) {
			console.error(`Failed to save island state for ${id}:`, error);
		}
	}

	/**
	 * Load island state from browser storage
	 */
	loadState(id: string): IslandState | null {
		if (!this.storage) {
			console.warn('Island persistence: Storage not available (server-side or unsupported browser)');
			return null;
		}

		try {
			const key = this.getStorageKey(id);
			const serializedState = this.storage.getItem(key);

			if (!serializedState) {
				return null;
			}

			// Use the IslandStateSerializer for proper deserialization
			const parsed = IslandStateSerializer.deserialize(serializedState);

			// Validate the stored data structure
			if (!parsed.state || !parsed.timestamp || !parsed.version) {
				console.warn(`Invalid island state format for ${id}, clearing...`);
				this.clearState(id);
				return null;
			}

			console.log(`Island state loaded for ${id}`);
			return parsed.state as Record<string, unknown>;
		} catch (error) {
			console.error(`Failed to load island state for ${id}:`, error);
			// Clear corrupted state
			this.clearState(id);
			return null;
		}
	}

	/**
	 * Clear island state from browser storage
	 */
	clearState(id: string): void {
		if (!this.storage) {
			return;
		}

		try {
			const key = this.getStorageKey(id);
			this.storage.removeItem(key);
			console.log(`Island state cleared for ${id}`);
		} catch (error) {
			console.error(`Failed to clear island state for ${id}:`, error);
		}
	}

	/**
	 * Check if state exists for an island
	 */
	hasState(id: string): boolean {
		if (!this.storage) {
			return false;
		}

		try {
			const key = this.getStorageKey(id);
			return this.storage.getItem(key) !== null;
		} catch (error) {
			console.error(`Failed to check island state for ${id}:`, error);
			return false;
		}
	}

	/**
	 * Get all stored island IDs
	 */
	getStoredIds(): string[] {
		if (!this.storage) {
			return [];
		}

		try {
			const ids: string[] = [];
			const prefixLength = this.keyPrefix.length + 1; // +1 for the separator

			for (let i = 0; i < this.storage.length; i++) {
				const key = this.storage.key(i);
				if (key && key.startsWith(this.keyPrefix + ':')) {
					ids.push(key.substring(prefixLength));
				}
			}

			return ids;
		} catch (error) {
			console.error('Failed to get stored island IDs:', error);
			return [];
		}
	}

	/**
	 * Clear all stored states
	 */
	clearAllStates(): void {
		if (!this.storage) {
			return;
		}

		try {
			const keysToRemove: string[] = [];

			for (let i = 0; i < this.storage.length; i++) {
				const key = this.storage.key(i);
				if (key && key.startsWith(this.keyPrefix + ':')) {
					keysToRemove.push(key);
				}
			}

			keysToRemove.forEach(key => this.storage!.removeItem(key));
			console.log(`Cleared ${keysToRemove.length} island states`);
		} catch (error) {
			console.error('Failed to clear all island states:', error);
		}
	}

	/**
	 * Get the storage key for an island ID
	 */
	private getStorageKey(id: string): string {
		return `${this.keyPrefix}:${id}`;
	}

	/**
	 * Get current storage configuration
	 */
	getConfig(): { storageType: string; keyPrefix: string; available: boolean } {
		return {
			storageType: this.storageType,
			keyPrefix: this.keyPrefix,
			available: this.storage !== null,
		};
	}

	/**
	 * Get storage usage statistics
	 */
	getStorageStats(): { totalKeys: number; islandKeys: number; estimatedSize: number } {
		if (!this.storage) {
			return { totalKeys: 0, islandKeys: 0, estimatedSize: 0 };
		}

		try {
			let islandKeys = 0;
			let estimatedSize = 0;

			for (let i = 0; i < this.storage.length; i++) {
				const key = this.storage.key(i);
				if (key && key.startsWith(this.keyPrefix + ':')) {
					islandKeys++;
					const value = this.storage.getItem(key);
					if (value) {
						estimatedSize += key.length + value.length;
					}
				}
			}

			return {
				totalKeys: this.storage.length,
				islandKeys,
				estimatedSize,
			};
		} catch (error) {
			console.error('Failed to get storage stats:', error);
			return { totalKeys: 0, islandKeys: 0, estimatedSize: 0 };
		}
	}

	/**
	 * JSON.stringify replacer function to handle special types
	 */
	private replacer(key: string, value: unknown): unknown {
		// Handle Date objects
		if (value instanceof Date) {
			return {
				__type: 'Date',
				__value: value.toISOString(),
			};
		}

		// Handle RegExp objects
		if (value instanceof RegExp) {
			return {
				__type: 'RegExp',
				__value: {
					source: value.source,
					flags: value.flags,
				},
			};
		}

		// Handle Map objects
		if (value instanceof Map) {
			return {
				__type: 'Map',
				__value: Array.from(value.entries()),
			};
		}

		// Handle Set objects
		if (value instanceof Set) {
			return {
				__type: 'Set',
				__value: Array.from(value.values()),
			};
		}

		// Handle functions (convert to null - functions can't be serialized)
		if (typeof value === 'function') {
			console.warn(`Function found in island state at key "${key}", converting to null`);
			return null;
		}

		// Handle undefined (convert to null)
		if (value === undefined) {
			return null;
		}

		return value;
	}

	/**
	 * JSON.parse reviver function to restore special types
	 */
	private reviver(key: string, value: unknown): unknown {
		// Check if this is a special type object
		if (value && typeof value === 'object') {
			const obj = value as Record<string, unknown>;
			if (obj.__type && obj.__value !== undefined) {
				switch (obj.__type) {
					case 'Date':
						return new Date(obj.__value as string);

					case 'RegExp': {
						const rv = obj.__value as { source: string; flags: string };
						return new RegExp(rv.source, rv.flags);
					}

					case 'Map':
						return new Map(obj.__value as Iterable<[unknown, unknown]>);

					case 'Set':
						return new Set(obj.__value as Iterable<unknown>);

					default:
						console.warn(`Unknown special type "${obj.__type}" in serialized state`);
						return obj.__value;
				}
			}
		}

		return value;
	}
}

/**
 * Default island persistence instance
 * Uses sessionStorage by default for better privacy and performance
 */
export const defaultIslandPersistence = new IslandPersistence({
	storageType: 'session',
	keyPrefix: 'island-state',
});
