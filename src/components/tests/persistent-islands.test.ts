import { assertEquals, assertExists } from 'jsr:@std/assert';
import { IslandPersistence } from '../../core/islands/island-persistence.ts';
import { IslandStateSerializer } from '../../core/islands/island-state-serializer.ts';
import { createPersistentIslandContext } from '../../core/islands/persistent-island-context.ts';
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

// Also mock the global storage objects
(globalThis as any).sessionStorage = mockStorage;
(globalThis as any).localStorage = mockStorage;

Deno.test('IslandPersistence - Basic Operations', async t => {
	await t.step('should save and load state', () => {
		mockStorage.clear();
		const persistence = new IslandPersistence();
		const testState: IslandState = { count: 42, name: 'test' };

		persistence.saveState('test-island', testState);
		const loadedState = persistence.loadState('test-island');

		assertEquals(loadedState, testState);
	});

	await t.step('should return null for non-existent state', () => {
		mockStorage.clear();
		const persistence = new IslandPersistence();
		const loadedState = persistence.loadState('non-existent');

		assertEquals(loadedState, null);
	});

	await t.step('should clear state', () => {
		mockStorage.clear();
		const persistence = new IslandPersistence();
		const testState: IslandState = { count: 42 };

		persistence.saveState('test-island', testState);
		assertEquals(persistence.hasState('test-island'), true);

		persistence.clearState('test-island');
		assertEquals(persistence.hasState('test-island'), false);
		assertEquals(persistence.loadState('test-island'), null);
	});

	await t.step('should check if state exists', () => {
		mockStorage.clear();
		const persistence = new IslandPersistence();
		const testState: IslandState = { count: 42 };

		assertEquals(persistence.hasState('test-island'), false);

		persistence.saveState('test-island', testState);
		assertEquals(persistence.hasState('test-island'), true);

		// Clean up after this test
		persistence.clearState('test-island');
	});

	await t.step('should get stored IDs', () => {
		mockStorage.clear();
		const persistence = new IslandPersistence();

		persistence.saveState('island-1', { count: 1 });
		persistence.saveState('island-2', { count: 2 });

		const storedIds = persistence.getStoredIds();
		assertEquals(storedIds.sort(), ['island-1', 'island-2']);
	});

	await t.step('should clear all states', () => {
		mockStorage.clear();
		const persistence = new IslandPersistence();

		persistence.saveState('island-1', { count: 1 });
		persistence.saveState('island-2', { count: 2 });

		assertEquals(persistence.getStoredIds().length, 2);

		persistence.clearAllStates();
		assertEquals(persistence.getStoredIds().length, 0);
	});
});

Deno.test('IslandPersistence - Configuration', async t => {
	await t.step('should use custom key prefix', () => {
		mockStorage.clear();
		const persistence = new IslandPersistence({ keyPrefix: 'custom-prefix' });
		const testState: IslandState = { count: 42 };

		persistence.saveState('test-island', testState);

		// Check that the key was stored with custom prefix
		const config = persistence.getConfig();
		assertEquals(config.keyPrefix, 'custom-prefix');

		// Verify state can be loaded
		const loadedState = persistence.loadState('test-island');
		assertEquals(loadedState, testState);

		// Clean up
		persistence.clearState('test-island');
	});

	await t.step('should provide storage stats', () => {
		mockStorage.clear();
		const persistence = new IslandPersistence();

		persistence.saveState('island-1', { count: 1 });
		persistence.saveState('island-2', { count: 2, name: 'test' });

		const stats = persistence.getStorageStats();
		assertEquals(stats.islandKeys, 2);
		assertEquals(stats.estimatedSize > 0, true);
	});
});

Deno.test('IslandStateSerializer - Basic Serialization', async t => {
	await t.step('should serialize and deserialize basic types', () => {
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

		assertEquals(deserialized, state);
	});

	await t.step('should handle Date objects', () => {
		const date = new Date('2023-01-01T00:00:00.000Z');
		const state: IslandState = { timestamp: date };

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		assertEquals(deserialized.timestamp instanceof Date, true);
		assertEquals((deserialized.timestamp as Date).getTime(), date.getTime());
	});

	await t.step('should handle RegExp objects', () => {
		const regex = /test/gi;
		const state: IslandState = { pattern: regex };

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		assertEquals(deserialized.pattern instanceof RegExp, true);
		assertEquals((deserialized.pattern as RegExp).source, regex.source);
		assertEquals((deserialized.pattern as RegExp).flags, regex.flags);
	});

	await t.step('should handle Map objects', () => {
		const map = new Map([
			['key1', 'value1'],
			['key2', 'value2'],
		]);
		const state: IslandState = { map };

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		assertEquals(deserialized.map instanceof Map, true);
		assertEquals((deserialized.map as Map<string, string>).get('key1'), 'value1');
		assertEquals((deserialized.map as Map<string, string>).get('key2'), 'value2');
	});

	await t.step('should handle Set objects', () => {
		const set = new Set(['value1', 'value2']);
		const state: IslandState = { set };

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		assertEquals(deserialized.set instanceof Set, true);
		assertEquals((deserialized.set as Set<string>).has('value1'), true);
		assertEquals((deserialized.set as Set<string>).has('value2'), true);
	});

	await t.step('should convert functions to null', () => {
		const state: IslandState = {
			func: () => 'test',
			value: 42,
		};

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		assertEquals(deserialized.func, null);
		assertEquals(deserialized.value, 42);
	});

	await t.step('should convert undefined to null', () => {
		const state: IslandState = {
			undef: undefined,
			value: 42,
		};

		const serialized = IslandStateSerializer.serialize(state);
		const deserialized = IslandStateSerializer.deserialize(serialized);

		assertEquals(deserialized.undef, null);
		assertEquals(deserialized.value, 42);
	});
});

Deno.test('IslandStateSerializer - Validation and Utilities', async t => {
	await t.step('should validate serializable state', () => {
		const validState: IslandState = { count: 42, name: 'test' };
		const validation = IslandStateSerializer.validate(validState);

		assertEquals(validation.valid, true);
		assertEquals(validation.errors.length, 0);
	});

	await t.step('should calculate state size', () => {
		const state: IslandState = { count: 42, name: 'test' };
		const size = IslandStateSerializer.getSize(state);

		assertEquals(size.bytes > 0, true);
		assertEquals(size.kilobytes > 0, true);
		assertEquals(typeof size.readable, 'string');
	});

	await t.step('should clone state', () => {
		const original: IslandState = {
			count: 42,
			nested: { value: 'test' },
			date: new Date('2023-01-01'),
		};

		const cloned = IslandStateSerializer.clone(original);

		// Should be equal but not the same reference
		assertEquals(IslandStateSerializer.equals(original, cloned), true);
		assertEquals(original === cloned, false);
		assertEquals(original.nested === cloned.nested, false);
	});

	await t.step('should compare states for equality', () => {
		const state1: IslandState = { count: 42, name: 'test' };
		const state2: IslandState = { count: 42, name: 'test' };
		const state3: IslandState = { count: 43, name: 'test' };

		assertEquals(IslandStateSerializer.equals(state1, state2), true);
		assertEquals(IslandStateSerializer.equals(state1, state3), false);
	});

	await t.step('should sanitize state', () => {
		const state: IslandState = {
			count: 42,
			func: () => 'test',
			undef: undefined,
			date: new Date('2023-01-01'),
		};

		const sanitized = IslandStateSerializer.sanitize(state);

		assertEquals(sanitized.count, 42);
		assertEquals(sanitized.func, null);
		assertEquals(sanitized.undef, null);
		assertEquals(sanitized.date instanceof Date, true);
	});
});

Deno.test('PersistentIslandContext - Context Creation', async t => {
	await t.step('should create context with save/load/clear functions', () => {
		const context = createPersistentIslandContext('test-island');

		assertExists(context.saveState);
		assertExists(context.loadState);
		assertExists(context.clearState);

		assertEquals(typeof context.saveState, 'function');
		assertEquals(typeof context.loadState, 'function');
		assertEquals(typeof context.clearState, 'function');
	});

	await t.step('should save and load state through context', () => {
		mockStorage.clear();
		const persistence = new IslandPersistence();
		const context = createPersistentIslandContext('test-island', persistence);
		const testState: IslandState = { count: 42 };

		context.saveState(testState);
		const loadedState = context.loadState();

		assertEquals(loadedState, testState);
	});

	await t.step('should clear state through context', () => {
		mockStorage.clear();
		const persistence = new IslandPersistence();
		const context = createPersistentIslandContext('test-island', persistence);
		const testState: IslandState = { count: 42 };

		context.saveState(testState);
		assertEquals(context.loadState(), testState);

		context.clearState();
		assertEquals(context.loadState(), null);
	});
});

Deno.test('Integration - Complete Persistent Islands Flow', async t => {
	await t.step('should handle complete save/load/clear cycle', () => {
		mockStorage.clear();
		const persistence = new IslandPersistence();
		const context = createPersistentIslandContext('integration-test', persistence);

		// Complex state with various data types
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

		// Save through context
		context.saveState(complexState);

		// Verify persistence layer has the state
		assertEquals(persistence.hasState('integration-test'), true);

		// Load through context
		const loadedState = context.loadState();
		assertExists(loadedState);

		// Verify complex data types are preserved
		assertEquals(loadedState.counter, 42);
		assertEquals(loadedState.user.name, 'John Doe');
		assertEquals(loadedState.timestamps[0] instanceof Date, true);
		assertEquals(loadedState.patterns[0] instanceof RegExp, true);
		assertEquals(loadedState.cache instanceof Map, true);
		assertEquals(loadedState.tags instanceof Set, true);

		// Verify Map contents
		const loadedMap = loadedState.cache as Map<string, any>;
		assertEquals(loadedMap.get('key1').value, 'cached1');
		assertEquals(loadedMap.get('key1').expires instanceof Date, true);

		// Verify Set contents
		const loadedSet = loadedState.tags as Set<string>;
		assertEquals(loadedSet.has('tag1'), true);
		assertEquals(loadedSet.has('tag2'), true);
		assertEquals(loadedSet.has('tag3'), true);

		// Clear through context
		context.clearState();
		assertEquals(context.loadState(), null);
		assertEquals(persistence.hasState('integration-test'), false);
	});

	await t.step('should handle serialization errors gracefully', () => {
		mockStorage.clear();
		const persistence = new IslandPersistence();

		// Create a circular reference that will cause serialization to fail
		const circularState: any = { count: 42 };
		circularState.self = circularState;

		// This should not throw, but should log an error
		persistence.saveState('circular-test', circularState);

		// Should return null since save failed
		const loadedState = persistence.loadState('circular-test');
		assertEquals(loadedState, null);
	});
});

// Clean up after tests
Deno.test('Cleanup', () => {
	mockStorage.clear();
});
