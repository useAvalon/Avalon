import type { IslandState } from "../schemas/layout.ts";

/**
 * Serializes and deserializes island state for browser storage.
 *
 * Handles complex types that `JSON.stringify` drops: Date, RegExp, Map, and Set.
 * Functions are silently stripped.
 */

function transformForSerialization(obj: unknown): unknown {
	if (obj === null || obj === undefined) return null;
	if (obj instanceof Date) return { __type: "Date", __value: obj.toISOString() };
	if (obj instanceof RegExp)
		return { __type: "RegExp", __value: { source: obj.source, flags: obj.flags } };
	if (obj instanceof Map) {
		return {
			__type: "Map",
			__value: Array.from(obj.entries()).map(([k, v]) => [
				transformForSerialization(k),
				transformForSerialization(v),
			]),
		};
	}
	if (obj instanceof Set) {
		return {
			__type: "Set",
			__value: Array.from(obj.values()).map((v) => transformForSerialization(v)),
		};
	}
	if (typeof obj === "function") return null;
	if (Array.isArray(obj)) return obj.map((item) => transformForSerialization(item));
	if (typeof obj === "object") {
		const result: Record<string, unknown> = {};
		const record = obj as Record<string, unknown>;
		for (const key in record) {
			if (Object.hasOwn(record, key)) {
				result[key] = transformForSerialization(record[key]);
			}
		}
		return result;
	}
	return obj;
}

function reviver(_key: string, value: unknown): unknown {
	if (value && typeof value === "object") {
		const v = value as Record<string, unknown>;
		if (v.__type && v.__value !== undefined) {
			switch (v.__type) {
				case "Date":
					return new Date(v.__value as string);
				case "RegExp": {
					const rv = v.__value as { source: string; flags: string };
					return new RegExp(rv.source, rv.flags);
				}
				case "Map":
					return new Map(v.__value as Iterable<[unknown, unknown]>);
				case "Set":
					return new Set(v.__value as Iterable<unknown>);
				default:
					return v.__value;
			}
		}
	}
	return value;
}

export function serialize(state: IslandState): string {
	try {
		const transformed = transformForSerialization(state);
		return JSON.stringify(transformed);
	} catch (error) {
		throw new Error(
			`State serialization failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

export function deserialize(serializedState: string): IslandState {
	try {
		return JSON.parse(serializedState, reviver);
	} catch (error) {
		throw new Error(
			`State deserialization failed: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

export function validate(state: IslandState): { valid: boolean; errors: string[] } {
	const errors: string[] = [];
	try {
		const serialized = serialize(state);
		const sizeInBytes = new Blob([serialized]).size;
		if (sizeInBytes > 5 * 1024 * 1024) {
			errors.push(`Serialized state size (${Math.round(sizeInBytes / 1024)}KB) exceeds 5MB limit`);
		}
		deserialize(serialized);
	} catch (error) {
		errors.push(error instanceof Error ? error.message : String(error));
	}
	return { valid: errors.length === 0, errors };
}

export function clone(state: IslandState): IslandState {
	try {
		return deserialize(serialize(state));
	} catch {
		return { ...state };
	}
}

export function equals(state1: IslandState, state2: IslandState): boolean {
	try {
		return serialize(state1) === serialize(state2);
	} catch {
		return false;
	}
}
