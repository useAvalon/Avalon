import type { IslandState } from '../../schemas/layout.ts';

/**
 * Island State Serializer
 *
 * Handles serialization and deserialization of island state for browser storage.
 * Supports complex data types including Dates, RegExp, and circular references.
 */
export class IslandStateSerializer {
	/**
	 * Serialize island state to JSON string
	 */
	static serialize(state: IslandState): string {
		try {
			// Deep clone and transform the state to handle special types
			const transformedState = IslandStateSerializer.transformForSerialization(state);
			return JSON.stringify(transformedState);
		} catch (error) {
			console.error('Failed to serialize island state:', error);
			throw new Error(`State serialization failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Deserialize JSON string to island state
	 */
	static deserialize(serializedState: string): IslandState {
		try {
			return JSON.parse(serializedState, IslandStateSerializer.reviver);
		} catch (error) {
			console.error('Failed to deserialize island state:', error);
			throw new Error(`State deserialization failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Transform state for serialization, handling special types
	 */
	private static transformForSerialization(obj: unknown): unknown {
		if (obj === null) {
			return obj;
		}

		if (obj === undefined) {
			return null;
		}

		// Handle Date objects
		if (obj instanceof Date) {
			return {
				__type: 'Date',
				__value: obj.toISOString(),
			};
		}

		// Handle RegExp objects
		if (obj instanceof RegExp) {
			return {
				__type: 'RegExp',
				__value: {
					source: obj.source,
					flags: obj.flags,
				},
			};
		}

		// Handle Map objects
		if (obj instanceof Map) {
			return {
				__type: 'Map',
				__value: Array.from(obj.entries()).map(([k, v]) => [
					IslandStateSerializer.transformForSerialization(k),
					IslandStateSerializer.transformForSerialization(v),
				]),
			};
		}

		// Handle Set objects
		if (obj instanceof Set) {
			return {
				__type: 'Set',
				__value: Array.from(obj.values()).map(v => IslandStateSerializer.transformForSerialization(v)),
			};
		}

		// Handle functions (convert to null - functions can't be serialized)
		if (typeof obj === 'function') {
			console.warn(`Function found in island state, converting to null`);
			return null;
		}

		// Handle undefined (convert to null - already handled at the top)
		// This check is redundant but kept for safety

		// Handle arrays
		if (Array.isArray(obj)) {
			return obj.map(item => IslandStateSerializer.transformForSerialization(item));
		}

		// Handle plain objects
		if (typeof obj === 'object') {
			const result: Record<string, unknown> = {};
			const record = obj as Record<string, unknown>;
			for (const key in record) {
				if (Object.hasOwn(record, key)) {
					result[key] = IslandStateSerializer.transformForSerialization(record[key]);
				}
			}
			return result;
		}

		return obj;
	}

	/**
	 * JSON.parse reviver function to restore special types
	 */
	private static reviver(key: string, value: unknown): unknown {
		// Check if this is a special type object
		if (value && typeof value === 'object') {
			const v = value as Record<string, unknown>;
			if (v.__type && v.__value !== undefined) {
				switch (v.__type) {
					case 'Date':
						return new Date(v.__value as string);

					case 'RegExp': {
						const rv = v.__value as { source: string; flags: string };
						return new RegExp(rv.source, rv.flags);
					}

					case 'Map':
						return new Map(v.__value as Iterable<[unknown, unknown]>);

					case 'Set':
						return new Set(v.__value as Iterable<unknown>);

					case 'undefined':
						return null;

					default:
						console.warn(`Unknown special type "${v.__type}" in serialized state`);
						return v.__value;
				}
			}
		}

		return value;
	}

	/**
	 * Validate that state can be safely serialized
	 */
	static validate(state: IslandState): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		try {
			// Attempt serialization to check for issues
			const serialized = this.serialize(state);

			// Check size limits (most browsers have ~5-10MB limit for localStorage)
			const sizeInBytes = new Blob([serialized]).size;
			const maxSize = 5 * 1024 * 1024; // 5MB limit

			if (sizeInBytes > maxSize) {
				errors.push(
					`Serialized state size (${Math.round(sizeInBytes / 1024)}KB) exceeds recommended limit (${Math.round(
						maxSize / 1024
					)}KB)`
				);
			}

			// Attempt deserialization to ensure round-trip works
			this.deserialize(serialized);
		} catch (error) {
			errors.push(error instanceof Error ? error.message : String(error));
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Get size information for serialized state
	 */
	static getSize(state: IslandState): {
		bytes: number;
		kilobytes: number;
		megabytes: number;
		readable: string;
	} {
		try {
			const serialized = this.serialize(state);
			const bytes = new Blob([serialized]).size;
			const kilobytes = bytes / 1024;
			const megabytes = kilobytes / 1024;

			let readable: string;
			if (megabytes >= 1) {
				readable = `${megabytes.toFixed(2)} MB`;
			} else if (kilobytes >= 1) {
				readable = `${kilobytes.toFixed(2)} KB`;
			} else {
				readable = `${bytes} bytes`;
			}

			return { bytes, kilobytes, megabytes, readable };
		} catch (error) {
			console.error('Failed to calculate state size:', error);
			return { bytes: 0, kilobytes: 0, megabytes: 0, readable: '0 bytes' };
		}
	}

	/**
	 * Deep clone state object (useful for preventing mutations)
	 */
	static clone(state: IslandState): IslandState {
		try {
			const serialized = this.serialize(state);
			return this.deserialize(serialized);
		} catch (error) {
			console.error('Failed to clone island state:', error);
			// Fallback to shallow clone
			return { ...state };
		}
	}

	/**
	 * Compare two states for equality
	 */
	static equals(state1: IslandState, state2: IslandState): boolean {
		try {
			const serialized1 = this.serialize(state1);
			const serialized2 = this.serialize(state2);
			return serialized1 === serialized2;
		} catch (error) {
			console.error('Failed to compare island states:', error);
			return false;
		}
	}

	/**
	 * Sanitize state by removing non-serializable values
	 */
	static sanitize(state: IslandState): IslandState {
		try {
			// Use the serialization process to remove non-serializable values
			const serialized = this.serialize(state);
			return this.deserialize(serialized);
		} catch (error) {
			console.error('Failed to sanitize island state:', error);
			// Return empty state as fallback
			return {};
		}
	}
}
