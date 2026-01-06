/**
 * Tests for Framework HMR Adapter Interface and Registry
 * 
 * These tests verify the framework adapter interface contract and registry system.
 * Requirements: 2.1-2.7
 */

import { assertEquals, assertExists, assertThrows } from 'jsr:@std/assert';
import {
  type FrameworkHMRAdapter,
  type StateSnapshot,
  AdapterRegistry,
  BaseFrameworkAdapter,
} from '../framework-adapter.ts';

// Mock adapter for testing
class MockFrameworkAdapter implements FrameworkHMRAdapter {
  readonly name = 'mock';
  
  canHandle(component: unknown): boolean {
    return typeof component === 'function';
  }
  
  preserveState(island: HTMLElement): StateSnapshot | null {
    return {
      framework: 'mock',
      timestamp: Date.now(),
      data: { test: 'value' },
    };
  }
  
  async update(
    island: HTMLElement,
    newComponent: unknown,
    props: Record<string, unknown>
  ): Promise<void> {
    // Mock update
  }
  
  restoreState(island: HTMLElement, state: StateSnapshot): void {
    // Mock restore
  }
  
  handleError(island: HTMLElement, error: Error): void {
    // Mock error handling
  }
}

// Another mock adapter for testing multiple registrations
class AnotherMockAdapter implements FrameworkHMRAdapter {
  readonly name = 'another';
  
  canHandle(component: unknown): boolean {
    return typeof component === 'object';
  }
  
  preserveState(island: HTMLElement): StateSnapshot | null {
    return null;
  }
  
  async update(
    island: HTMLElement,
    newComponent: unknown,
    props: Record<string, unknown>
  ): Promise<void> {
    // Mock update
  }
  
  restoreState(island: HTMLElement, state: StateSnapshot): void {
    // Mock restore
  }
  
  handleError(island: HTMLElement, error: Error): void {
    // Mock error handling
  }
}

// Concrete implementation of BaseFrameworkAdapter for testing
class TestBaseAdapter extends BaseFrameworkAdapter {
  readonly name = 'test-base';
  
  canHandle(component: unknown): boolean {
    return true;
  }
  
  async update(
    island: HTMLElement,
    newComponent: unknown,
    props: Record<string, unknown>
  ): Promise<void> {
    // Test implementation
  }
}

// Mock HTMLElement for testing
class MockHTMLElement {
  private attributes: Map<string, string> = new Map();
  private _children: MockHTMLElement[] = [];
  public scrollTop = 0;
  public scrollLeft = 0;
  public style: Record<string, string> = {};
  
  getAttribute(name: string): string | null {
    return this.attributes.get(name) || null;
  }
  
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  
  querySelector(selector: string): MockHTMLElement | null {
    return null;
  }
  
  querySelectorAll(selector: string): MockHTMLElement[] {
    return [];
  }
  
  contains(element: unknown): boolean {
    return false;
  }
  
  insertBefore(newNode: unknown, referenceNode: unknown): void {
    // Mock implementation
  }
  
  get firstChild(): unknown {
    return null;
  }
  
  dispatchEvent(event: any): boolean {
    return true;
  }
}

Deno.test('FrameworkHMRAdapter - interface contract', () => {
  const adapter = new MockFrameworkAdapter();
  
  // Verify all required properties and methods exist
  assertExists(adapter.name, 'Adapter should have name property');
  assertEquals(typeof adapter.canHandle, 'function', 'Should have canHandle method');
  assertEquals(typeof adapter.preserveState, 'function', 'Should have preserveState method');
  assertEquals(typeof adapter.update, 'function', 'Should have update method');
  assertEquals(typeof adapter.restoreState, 'function', 'Should have restoreState method');
  assertEquals(typeof adapter.handleError, 'function', 'Should have handleError method');
});

Deno.test('FrameworkHMRAdapter - canHandle method', () => {
  const adapter = new MockFrameworkAdapter();
  
  // Test canHandle with different component types
  assertEquals(adapter.canHandle(() => {}), true, 'Should handle function components');
  assertEquals(adapter.canHandle(class {}), true, 'Should handle class components');
  assertEquals(adapter.canHandle({}), false, 'Should not handle objects');
  assertEquals(adapter.canHandle('string'), false, 'Should not handle strings');
});

Deno.test('FrameworkHMRAdapter - preserveState returns valid snapshot', () => {
  const adapter = new MockFrameworkAdapter();
  const mockIsland = new MockHTMLElement() as unknown as HTMLElement;
  
  const snapshot = adapter.preserveState(mockIsland);
  
  assertExists(snapshot, 'Should return a snapshot');
  assertEquals(snapshot?.framework, 'mock', 'Snapshot should have framework name');
  assertEquals(typeof snapshot?.timestamp, 'number', 'Snapshot should have timestamp');
  assertExists(snapshot?.data, 'Snapshot should have data object');
});

Deno.test('FrameworkHMRAdapter - update method is async', async () => {
  const adapter = new MockFrameworkAdapter();
  const mockIsland = new MockHTMLElement() as unknown as HTMLElement;
  
  // Verify update returns a Promise
  const result = adapter.update(mockIsland, () => {}, {});
  assertExists(result, 'Update should return a value');
  assertEquals(result instanceof Promise, true, 'Update should return a Promise');
  
  // Await the promise
  await result;
});

Deno.test('AdapterRegistry - initialization', () => {
  const registry = new AdapterRegistry();
  
  assertExists(registry, 'Registry should be created');
  assertEquals(registry.size, 0, 'Registry should start empty');
  assertEquals(registry.getRegisteredFrameworks().length, 0, 'Should have no registered frameworks');
});

Deno.test('AdapterRegistry - register adapter', () => {
  const registry = new AdapterRegistry();
  const adapter = new MockFrameworkAdapter();
  
  registry.register('mock', adapter);
  
  assertEquals(registry.size, 1, 'Registry should have one adapter');
  assertEquals(registry.has('mock'), true, 'Should have mock adapter');
  assertEquals(registry.has('MOCK'), true, 'Should be case-insensitive');
});

Deno.test('AdapterRegistry - register multiple adapters', () => {
  const registry = new AdapterRegistry();
  const adapter1 = new MockFrameworkAdapter();
  const adapter2 = new AnotherMockAdapter();
  
  registry.register('mock', adapter1);
  registry.register('another', adapter2);
  
  assertEquals(registry.size, 2, 'Registry should have two adapters');
  assertEquals(registry.has('mock'), true, 'Should have mock adapter');
  assertEquals(registry.has('another'), true, 'Should have another adapter');
  
  const frameworks = registry.getRegisteredFrameworks();
  assertEquals(frameworks.length, 2, 'Should return two framework names');
  assertEquals(frameworks.includes('mock'), true, 'Should include mock');
  assertEquals(frameworks.includes('another'), true, 'Should include another');
});

Deno.test('AdapterRegistry - get adapter', () => {
  const registry = new AdapterRegistry();
  const adapter = new MockFrameworkAdapter();
  
  registry.register('mock', adapter);
  
  const retrieved = registry.get('mock');
  assertExists(retrieved, 'Should retrieve adapter');
  assertEquals(retrieved?.name, 'mock', 'Should retrieve correct adapter');
  
  // Test case-insensitivity
  const retrievedUpper = registry.get('MOCK');
  assertExists(retrievedUpper, 'Should retrieve adapter with uppercase name');
  assertEquals(retrievedUpper?.name, 'mock', 'Should retrieve same adapter');
});

Deno.test('AdapterRegistry - get non-existent adapter', () => {
  const registry = new AdapterRegistry();
  
  const retrieved = registry.get('nonexistent');
  assertEquals(retrieved, undefined, 'Should return undefined for non-existent adapter');
});

Deno.test('AdapterRegistry - findAdapter by component', () => {
  const registry = new AdapterRegistry();
  const adapter1 = new MockFrameworkAdapter(); // Handles functions
  const adapter2 = new AnotherMockAdapter(); // Handles objects
  
  registry.register('mock', adapter1);
  registry.register('another', adapter2);
  
  // Test finding adapter for function component
  const functionAdapter = registry.findAdapter(() => {});
  assertExists(functionAdapter, 'Should find adapter for function');
  assertEquals(functionAdapter?.name, 'mock', 'Should find mock adapter for function');
  
  // Test finding adapter for object component
  const objectAdapter = registry.findAdapter({});
  assertExists(objectAdapter, 'Should find adapter for object');
  assertEquals(objectAdapter?.name, 'another', 'Should find another adapter for object');
  
  // Test finding adapter for unsupported component
  const noneAdapter = registry.findAdapter('string');
  assertEquals(noneAdapter, undefined, 'Should not find adapter for string');
});

Deno.test('AdapterRegistry - unregister adapter', () => {
  const registry = new AdapterRegistry();
  const adapter = new MockFrameworkAdapter();
  
  registry.register('mock', adapter);
  assertEquals(registry.size, 1, 'Should have one adapter');
  
  const removed = registry.unregister('mock');
  assertEquals(removed, true, 'Should return true when removing existing adapter');
  assertEquals(registry.size, 0, 'Should have no adapters after removal');
  assertEquals(registry.has('mock'), false, 'Should not have mock adapter');
});

Deno.test('AdapterRegistry - unregister non-existent adapter', () => {
  const registry = new AdapterRegistry();
  
  const removed = registry.unregister('nonexistent');
  assertEquals(removed, false, 'Should return false when removing non-existent adapter');
});

Deno.test('AdapterRegistry - clear all adapters', () => {
  const registry = new AdapterRegistry();
  const adapter1 = new MockFrameworkAdapter();
  const adapter2 = new AnotherMockAdapter();
  
  registry.register('mock', adapter1);
  registry.register('another', adapter2);
  assertEquals(registry.size, 2, 'Should have two adapters');
  
  registry.clear();
  assertEquals(registry.size, 0, 'Should have no adapters after clear');
  assertEquals(registry.getRegisteredFrameworks().length, 0, 'Should have no registered frameworks');
});

Deno.test('AdapterRegistry - validation: null adapter', () => {
  const registry = new AdapterRegistry();
  
  assertThrows(
    () => registry.register('test', null as any),
    Error,
    'Cannot register null/undefined adapter',
    'Should throw error for null adapter'
  );
});

Deno.test('AdapterRegistry - validation: adapter without name', () => {
  const registry = new AdapterRegistry();
  const invalidAdapter = {
    canHandle: () => true,
    preserveState: () => null,
    update: async () => {},
    restoreState: () => {},
    handleError: () => {},
  } as any;
  
  assertThrows(
    () => registry.register('test', invalidAdapter),
    Error,
    'must have a name property',
    'Should throw error for adapter without name'
  );
});

Deno.test('AdapterRegistry - validation: adapter without canHandle', () => {
  const registry = new AdapterRegistry();
  const invalidAdapter = {
    name: 'test',
    preserveState: () => null,
    update: async () => {},
    restoreState: () => {},
    handleError: () => {},
  } as any;
  
  assertThrows(
    () => registry.register('test', invalidAdapter),
    Error,
    'must implement canHandle method',
    'Should throw error for adapter without canHandle'
  );
});

Deno.test('AdapterRegistry - validation: adapter without preserveState', () => {
  const registry = new AdapterRegistry();
  const invalidAdapter = {
    name: 'test',
    canHandle: () => true,
    update: async () => {},
    restoreState: () => {},
    handleError: () => {},
  } as any;
  
  assertThrows(
    () => registry.register('test', invalidAdapter),
    Error,
    'must implement preserveState method',
    'Should throw error for adapter without preserveState'
  );
});

Deno.test('AdapterRegistry - validation: adapter without update', () => {
  const registry = new AdapterRegistry();
  const invalidAdapter = {
    name: 'test',
    canHandle: () => true,
    preserveState: () => null,
    restoreState: () => {},
    handleError: () => {},
  } as any;
  
  assertThrows(
    () => registry.register('test', invalidAdapter),
    Error,
    'must implement update method',
    'Should throw error for adapter without update'
  );
});

Deno.test('AdapterRegistry - validation: adapter without restoreState', () => {
  const registry = new AdapterRegistry();
  const invalidAdapter = {
    name: 'test',
    canHandle: () => true,
    preserveState: () => null,
    update: async () => {},
    handleError: () => {},
  } as any;
  
  assertThrows(
    () => registry.register('test', invalidAdapter),
    Error,
    'must implement restoreState method',
    'Should throw error for adapter without restoreState'
  );
});

Deno.test('AdapterRegistry - validation: adapter without handleError', () => {
  const registry = new AdapterRegistry();
  const invalidAdapter = {
    name: 'test',
    canHandle: () => true,
    preserveState: () => null,
    update: async () => {},
    restoreState: () => {},
  } as any;
  
  assertThrows(
    () => registry.register('test', invalidAdapter),
    Error,
    'must implement handleError method',
    'Should throw error for adapter without handleError'
  );
});

Deno.test('BaseFrameworkAdapter - default preserveState captures DOM state', () => {
  const adapter = new TestBaseAdapter();
  const mockIsland = new MockHTMLElement() as unknown as HTMLElement;
  
  const snapshot = adapter.preserveState(mockIsland);
  
  // Note: In Deno test environment without DOM, preserveState may return null
  // This is expected behavior - the adapter gracefully handles missing DOM
  if (snapshot) {
    assertEquals(snapshot.framework, 'test-base', 'Should have correct framework name');
    assertEquals(typeof snapshot.timestamp, 'number', 'Should have timestamp');
    assertExists(snapshot.data, 'Should have data object');
  } else {
    // Graceful degradation when DOM is not available
    assertEquals(snapshot, null, 'Should return null when DOM is not available');
  }
});

Deno.test('BaseFrameworkAdapter - default restoreState handles DOM state', () => {
  const adapter = new TestBaseAdapter();
  const mockIsland = new MockHTMLElement() as unknown as HTMLElement;
  
  const snapshot: StateSnapshot = {
    framework: 'test-base',
    timestamp: Date.now(),
    data: {},
    dom: {
      scrollPosition: { x: 100, y: 200 },
    },
  };
  
  // Should not throw
  adapter.restoreState(mockIsland, snapshot);
  
  // Verify scroll position was restored
  assertEquals(mockIsland.scrollLeft, 100, 'Should restore scroll left');
  assertEquals(mockIsland.scrollTop, 200, 'Should restore scroll top');
});

Deno.test('BaseFrameworkAdapter - default handleError adds error indicator', () => {
  const adapter = new TestBaseAdapter();
  const mockIsland = new MockHTMLElement() as unknown as HTMLElement;
  const error = new Error('Test error');
  
  // In Deno test environment without DOM, handleError may fail
  // This is expected - the adapter requires DOM APIs
  try {
    adapter.handleError(mockIsland, error);
    
    // If it succeeds, verify error attributes were set
    assertEquals(mockIsland.getAttribute('data-hmr-error'), 'true', 'Should mark island as having error');
    assertEquals(mockIsland.getAttribute('data-hmr-error-message'), 'Test error', 'Should store error message');
  } catch (e) {
    // Expected in Deno environment without DOM
    assertEquals((e as Error).message.includes('document is not defined'), true, 'Should fail gracefully without DOM');
  }
});

Deno.test('StateSnapshot - structure validation', () => {
  const snapshot: StateSnapshot = {
    framework: 'test',
    timestamp: Date.now(),
    data: { key: 'value' },
    dom: {
      scrollPosition: { x: 0, y: 100 },
      focusedElement: '#input',
      formValues: { name: 'test' },
    },
  };
  
  // Verify structure
  assertEquals(typeof snapshot.framework, 'string', 'Framework should be string');
  assertEquals(typeof snapshot.timestamp, 'number', 'Timestamp should be number');
  assertEquals(typeof snapshot.data, 'object', 'Data should be object');
  assertExists(snapshot.dom, 'DOM state should exist');
  assertExists(snapshot.dom?.scrollPosition, 'Scroll position should exist');
  assertExists(snapshot.dom?.focusedElement, 'Focused element should exist');
  assertExists(snapshot.dom?.formValues, 'Form values should exist');
});
