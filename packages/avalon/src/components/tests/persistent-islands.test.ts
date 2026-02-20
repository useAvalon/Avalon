import { describe, it, expect, beforeEach } from 'vitest';
import { IslandPersistence } from '../../core/islands/island-persistence.ts';
import { IslandStateSerializer } from '../../core/islands/island-state-serializer.ts';
import { createPersistentIslandContext } from '../../core/islands/persistent-island-context.tsx';
import type { IslandState } from '../../schemas/layout.ts';

// Mock Storage for testing
class MockStorage implements Storage {
	private data: Map<string, string> = new Map();

	get length(): number {
		return this.data.size;
	}

	clear(): void {
		this.data.clear();
	}

	getItem(key: string): string | null {
		return this.data.get(key) || null;
	}

	key(index: number): string | null {
		const keys = Array.from(this.data.keys());
		return keys[index] || null;
	}

	removeItem(key: string): void {
		this.data.delete(key);
	}

	setItem(key: string, value: string): void {
		this.data.set(key, value);
	}
}

// Mock global window and storage for testing
const mockStorage = new MockStorage();
(globalThis as any).window = {
	sessionStorage: mockStorage,
	localStorage: mockStorage,
};
(globalThis as any).sessionStorage = mockStorage;
(globalThis as any).localStorage = mockStorage;

describe('IslandPersistence - Basic Operations', () => {
	beforeEach(() => { mockStorage.clear(); });

	it('should save and load state', () => {
		const persistence = new IslandPersistence();
		const testState: IslandState = { count: 42, name: 'test' };

		persistence.saveState('test-island', testState);
		const loadedState = persistence.loadState('test-island');

		expect(loadedState).toEqual(testState);
	});

	it('should return null for non-existent state', () => {
		const persistence = new IslandPersistence();
		const loadedState = persistence.loadState('non-existent');

		expect(loadedState).toEqual(null);
	});

	it('should clear state', () => {
		const persistence = new IslandPersistence();
		const testState: IslandState = { count: 42 };

		persistence.saveState('test-island', testState);
		expect(persistence.hasState('test-island')).toEqual(true);

		persistence.clearState('test-island');
		expect(persistence.hasState('test-island')).toEqual(false);
		expect(persistence.loadState('test-island')).toEqual(null);
	});

	it('should check if state exists', () => {
		const persistence = new IslandPersistence();
		const testState: IslandState = { count: 42 };

		expect(persistence.hasState('test-island')).toEqual(false);

		persistence.saveState('test-island', testState);
		expect(persistence.hasState('test-island')).toEqual(true);

		persistence.clearState('test-island');
	});

	it('should get stored IDs', () => {
		const persistence = new IslandPersistence();

		persistence.saveState('island-1', { count: 1 });
		persistence.saveState('island-2', { count: 2 });

		const storedIds = persistence.getStoredIds();
		expect(storedIds.sort()).toEqual(['island-1', 'island-2']);
	});

	it('should clear all states', () => {
		const persistence = new IslandPersistence();

		persistence.saveState('island-1', { count: 1 });
		persistence.saveState('island-2', { count: 2 });

		expect(persistence.getStoredIds().length).toEqual(2);

		persistence.clearAllStates();
		expect(persistence.getStoredIds().length).toEqual(0);
	});
});

describe('IslandPersistence - Configuration', () => {
	beforeEach(() => { mockStorage.clear(); });

	it('should use custom key prefix', () => {
		const persistence = new IslandPersistence({ keyPrefix: 'custom-prefix' });
		const testState: IslandState = { count: 42 };

		persistence.saveState('test-island', testState);

		const config = persistence.getConfig();
		expect(config.keyPrefix).toEqual('custom-prefix');

		const loadedState = persistence.loadState('test-island');
		expect(loadedState).toEqual(testState);

		persistence.clearState('test-island');
	});

	it('should provide storage stats', () => {
		const persistence = new IslandPersistence();

		persistence.saveState('island-1', { count: 1 });
		persistence.saveState('island-2', { count: 2, name: 'test' });

		const stats = persistence.getStorageStats();
		expect(stats.islandKeys).toEqual(2);
		expect(stats.estimatedSize > 0).toEqual(true);
	});
});

describe('IslandStateSerializer - Basic Serialization', () => {
	it('should serialize and deserialize basic types', () => {
		const state: IslandState = {
			string: 'hello',
			number: 42,
			boolean: true,
			null: null,
			array: [1, 2, 3],
			object: { nested: 'value' },
		};

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		expect(deserialized).toEqual(state);
	});

	it('should handle Date objects', () => {
		const date = new Date('2023-01-01T00:00:00.000Z');
		const state: IslandState = { timestamp: date };

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		expect(deserialized.timestamp instanceof Date).toEqual(true);
		expect((deserialized.timestamp as Date).getTime()).toEqual(date.getTime());
	});

	it('should handle RegExp objects', () => {
		const regex = /test/gi;
		const state: IslandState = { pattern: regex };

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		expect(deserialized.pattern instanceof RegExp).toEqual(true);
		expect((deserialized.pattern as RegExp).source).toEqual(regex.source);
		expect((deserialized.pattern as RegExp).flags).toEqual(regex.flags);
	});

	it('should handle Map objects', () => {
		const map = new Map([
			['key1', 'value1'],
			['key2', 'value2'],
		]);
		const state: IslandState = { map };

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		expect(deserialized.map instanceof Map).toEqual(true);
		expect((deserialized.map as Map<string, string>).get('key1')).toEqual('value1');
		expect((deserialized.map as Map<string, string>).get('key2')).toEqual('value2');
	});

	it('should handle Set objects', () => {
		const set = new Set(['value1', 'value2']);
		const state: IslandState = { set };

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		expect(deserialized.set instanceof Set).toEqual(true);
		expect((deserialized.set as Set<string>).has('value1')).toEqual(true);
		expect((deserialized.set as Set<string>).has('value2')).toEqual(true);
	});

	it('should convert functions to null', () => {
		const state: IslandState = {
			func: () => 'test',
			value: 42,
		};

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		expect(deserialized.func).toEqual(null);
		expect(deserialized.value).toEqual(42);
	});

	it('should convert undefined to null', () => {
		const state: IslandState = {
			undef: undefined,
			value: 42,
		};

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		expect(deserialized.undef).toEqual(null);
		expect(deserialized.value).toEqual(42);
	});
});

describe('IslandStateSerializer - Validation and Utilities', () => {
	it('should validate serializable state', () => {
		const validState: IslandState = { count: 42, name: 'test' };
		const validation = IslandStateSerializer.validate(validState);

		expect(validation.valid).toEqual(true);
		expect(validation.errors.length).toEqual(0);
	});

	it('should calculate state size', () => {
		const state: IslandState = { count: 42, name: 'test' };
		const size = IslandStateSerializer.getSize(state);

		expect(size.bytes > 0).toEqual(true);
		expect(size.kilobytes > 0).toEqual(true);
		expect(typeof size.readable).toEqual('string');
	});

	it('should clone state', () => {
		const original: IslandState = {
			count: 42,
			nested: { value: 'test' },
			date: new Date('2023-01-01'),
		};

		const cloned = IslandStateSerializer.clone(original);

		expect(IslandStateSerializer.equals(original, cloned)).toEqual(true);
		expect(original === cloned).toEqual(false);
		expect(original.nested === cloned.nested).toEqual(false);
	});

	it('should compare states for equality', () => {
		const state1: IslandState = { count: 42, name: 'test' };
		const state2: IslandState = { count: 42, name: 'test' };
		const state3: IslandState = { count: 43, name: 'test' };

		expect(IslandStateSerializer.equals(state1, state2)).toEqual(true);
		expect(IslandStateSerializer.equals(state1, state3)).toEqual(false);
	});

	it('should sanitize state', () => {
		const state: IslandState = {
			count: 42,
			func: () => 'test',
			undef: undefined,
			date: new Date('2023-01-01'),
		};

		const sanitized = IslandStateSerializer.sanitize(state);

		expect(sanitized.count).toEqual(42);
		expect(sanitized.func).toEqual(null);
		expect(sanitized.undef).toEqual(null);
		expect(sanitized.date instanceof Date).toEqual(true);
	});
});

describe('PersistentIslandContext - Context Creation', () => {
	beforeEach(() => { mockStorage.clear(); });

	it('should create context with save/load/clear functions', () => {
		const context = createPersistentIslandContext('test-island');

		expect(context.saveState).toBeDefined();
		expect(context.loadState).toBeDefined();
		expect(context.clearState).toBeDefined();

		expect(typeof context.saveState).toEqual('function');
		expect(typeof context.loadState).toEqual('function');
		expect(typeof context.clearState).toEqual('function');
	});

	it('should save and load state through context', () => {
		const persistence = new IslandPersistence();
		const context = createPersistentIslandContext('test-island', persistence);
		const testState: IslandState = { count: 42 };

		context.saveState(testState);
		const loadedState = context.loadState();

		expect(loadedState).toEqual(testState);
	});

	it('should clear state through context', () => {
		const persistence = new IslandPersistence();
		const context = createPersistentIslandContext('test-island', persistence);
		const testState: IslandState = { count: 42 };

		context.saveState(testState);
		expect(context.loadState()).toEqual(testState);

		context.clearState();
		expect(context.loadState()).toEqual(null);
	});
});

describe('Integration - Complete Persistent Islands Flow', () => {
	beforeEach(() => { mockStorage.clear(); });

	it('should handle complete save/load/clear cycle', () => {
		const persistence = new IslandPersistence();
		const context = createPersistentIslandContext('integration-test', persistence);

		const complexState: IslandState = {
			counter: 42,
			user: {
				name: 'John Doe',
				preferences: {
					theme: 'dark',
					notifications: true,
				},
			},
			timestamps: [new Date('2023-01-01'), new Date('2023-01-02')],
			patterns: [/test/gi, /another/i],
			cache: new Map([
				['key1', { value: 'cached1', expires: new Date('2023-12-31') }],
				['key2', { value: 'cached2', expires: new Date('2023-12-31') }],
			]),
			tags: new Set(['tag1', 'tag2', 'tag3']),
		};

		context.saveState(complexState);

		expect(persistence.hasState('integration-test')).toEqual(true);

		const loadedState = context.loadState();
		expect(loadedState).toBeDefined();

		expect(loadedState!.counter).toEqual(42);
		expect(loadedState!.user.name).toEqual('John Doe');
		expect(loadedState!.timestamps[0] instanceof Date).toEqual(true);
		expect(loadedState!.patterns[0] instanceof RegExp).toEqual(true);
		expect(loadedState!.cache instanceof Map).toEqual(true);
		expect(loadedState!.tags instanceof Set).toEqual(true);

		const loadedMap = loadedState!.cache as Map<string, any>;
		expect(loadedMap.get('key1').value).toEqual('cached1');
		expect(loadedMap.get('key1').expires instanceof Date).toEqual(true);

		const loadedSet = loadedState!.tags as Set<string>;
		expect(loadedSet.has('tag1')).toEqual(true);
		expect(loadedSet.has('tag2')).toEqual(true);
		expect(loadedSet.has('tag3')).toEqual(true);

		context.clearState();
		expect(context.loadState()).toEqual(null);
		expect(persistence.hasState('integration-test')).toEqual(false);
	});

	it('should handle serialization errors gracefully', () => {
		const persistence = new IslandPersistence();

		const circularState: any = { count: 42 };
		circularState.self = circularState;

		persistence.saveState('circular-test', circularState);

		const loadedState = persistence.loadState('circular-test');
		expect(loadedState).toEqual(null);
	});
});
