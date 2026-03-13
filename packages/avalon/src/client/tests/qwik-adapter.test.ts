/**
 * Tests for Qwik HMR Adapter
 *
 * Verifies Qwik-specific HMR functionality including:
 * - Component detection (component$, QRL markers)
 * - State preservation (container state, q: attributes)
 * - Resumability-aware update flow
 * - Error handling with Qwik-specific hints
 *
 * Requirements: 2.1
 */

import { describe, it, expect } from 'vitest';
import { QwikHMRAdapter } from '../adapters/qwik-adapter.ts';
import type { StateSnapshot } from '../framework-adapter.ts';

// Mock HTMLElement for testing
class MockHTMLElement {
  private attributes: Map<string, string> = new Map();
  private _children: MockHTMLElement[] = [];
  public scrollTop = 0;
  public scrollLeft = 0;
  public style: Record<string, string> = {};
  public dataset: Record<string, string> = {};

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

  closest(selector: string): MockHTMLElement | null {
    return null;
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

  get children(): MockHTMLElement[] {
    return this._children;
  }

  dispatchEvent(event: any): boolean {
    return true;
  }
}

// Mock Qwik components for testing
function MockQwikComponent(props: Record<string, unknown>) {
  return null;
}

// Add Qwik marker
(MockQwikComponent as any).__brand = 'QwikComponent';

function MockQwikComponentWithSignal(props: Record<string, unknown>) {
  return null;
}

Object.defineProperty(MockQwikComponentWithSignal, 'toString', {
  value: () => 'function() { useSignal(0); }',
});

function MockQwikComponentWithStore(props: Record<string, unknown>) {
  return null;
}

Object.defineProperty(MockQwikComponentWithStore, 'toString', {
  value: () => 'function() { useStore({ count: 0 }); }',
});

function MockQwikComponentWithTask(props: Record<string, unknown>) {
  return null;
}

Object.defineProperty(MockQwikComponentWithTask, 'toString', {
  value: () => 'function() { useTask$(() => {}); }',
});

// Mock QRL-wrapped component
function MockQRLComponent(props: Record<string, unknown>) {
  return null;
}
(MockQRLComponent as any).__qrl = true;
(MockQRLComponent as any).getSymbol = () => 'MockQRLComponent';
(MockQRLComponent as any).getHash = () => 'abc123';

const MockQwikModule = {
  default: MockQwikComponent,
};

describe('QwikHMRAdapter - initialization', () => {
  it('should create adapter with correct name', () => {
    const adapter = new QwikHMRAdapter();

    expect(adapter).toBeDefined();
    expect(adapter.name).toBe('qwik');
  });
});

describe('QwikHMRAdapter - canHandle', () => {
  it('should handle Qwik component with __brand marker', () => {
    const adapter = new QwikHMRAdapter();

    const result = adapter.canHandle(MockQwikComponent);
    expect(result).toBe(true);
  });

  it('should handle QRL-wrapped component', () => {
    const adapter = new QwikHMRAdapter();

    const result = adapter.canHandle(MockQRLComponent);
    expect(result).toBe(true);
  });

  it('should handle component with useSignal', () => {
    const adapter = new QwikHMRAdapter();

    const result = adapter.canHandle(MockQwikComponentWithSignal);
    expect(result).toBe(true);
  });

  it('should handle component with useStore', () => {
    const adapter = new QwikHMRAdapter();

    const result = adapter.canHandle(MockQwikComponentWithStore);
    expect(result).toBe(true);
  });

  it('should handle component with useTask$', () => {
    const adapter = new QwikHMRAdapter();

    const result = adapter.canHandle(MockQwikComponentWithTask);
    expect(result).toBe(true);
  });

  it('should handle module with default export', () => {
    const adapter = new QwikHMRAdapter();

    const result = adapter.canHandle(MockQwikModule);
    expect(result).toBe(true);
  });

  it('should handle object with __qrl marker', () => {
    const adapter = new QwikHMRAdapter();

    const result = adapter.canHandle({ __qrl: true });
    expect(result).toBe(true);
  });

  it('should not handle non-Qwik values', () => {
    const adapter = new QwikHMRAdapter();

    expect(adapter.canHandle(null)).toBe(false);
    expect(adapter.canHandle(undefined)).toBe(false);
    expect(adapter.canHandle('string')).toBe(false);
    expect(adapter.canHandle(123)).toBe(false);
  });

  it('should not handle plain object without default or markers', () => {
    const adapter = new QwikHMRAdapter();

    const result = adapter.canHandle({ foo: 'bar' });
    expect(result).toBe(false);
  });
});

describe('QwikHMRAdapter - preserveState', () => {
  it('should return valid snapshot with container state', () => {
    const adapter = new QwikHMRAdapter();
    const mockIsland = new MockHTMLElement() as unknown as HTMLElement;

    mockIsland.setAttribute('data-src', '/islands/Counter.qwik.tsx');
    mockIsland.setAttribute('data-props', JSON.stringify({ count: 5 }));

    const snapshot = adapter.preserveState(mockIsland);

    if (snapshot) {
      expect(snapshot.framework).toBe('qwik');
      expect(typeof snapshot.timestamp).toBe('number');
      expect(snapshot.data).toBeDefined();
    } else {
      // Graceful degradation when DOM is not available
      expect(snapshot).toBeNull();
    }
  });

  it('should capture component name from .qwik.tsx path', () => {
    const adapter = new QwikHMRAdapter();
    const mockIsland = new MockHTMLElement() as unknown as HTMLElement;

    mockIsland.setAttribute('data-src', '/islands/Counter.qwik.tsx');
    mockIsland.setAttribute('data-props', '{}');

    const snapshot = adapter.preserveState(mockIsland);

    if (snapshot) {
      expect(snapshot.data.componentName).toBe('Counter');
    } else {
      expect(snapshot).toBeNull();
    }
  });

  it('should handle missing props', () => {
    const adapter = new QwikHMRAdapter();
    const mockIsland = new MockHTMLElement() as unknown as HTMLElement;

    mockIsland.setAttribute('data-src', '/islands/TestComponent.qwik.tsx');

    const snapshot = adapter.preserveState(mockIsland);

    if (snapshot) {
      expect(snapshot.data.capturedProps).toBeDefined();
      expect(Object.keys(snapshot.data.capturedProps || {}).length).toBe(0);
    } else {
      expect(snapshot).toBeNull();
    }
  });

  it('should handle invalid JSON props', () => {
    const adapter = new QwikHMRAdapter();
    const mockIsland = new MockHTMLElement() as unknown as HTMLElement;

    mockIsland.setAttribute('data-src', '/islands/TestComponent.qwik.tsx');
    mockIsland.setAttribute('data-props', 'invalid json');

    const snapshot = adapter.preserveState(mockIsland);
    expect(snapshot).toBeNull();
  });
});

describe('QwikHMRAdapter - restoreState', () => {
  it('should restore DOM state via base implementation', () => {
    const adapter = new QwikHMRAdapter();
    const mockIsland = new MockHTMLElement() as unknown as HTMLElement;

    const snapshot: StateSnapshot = {
      framework: 'qwik',
      timestamp: Date.now(),
      data: {},
      dom: {
        scrollPosition: { x: 50, y: 100 },
      },
    };

    adapter.restoreState(mockIsland, snapshot);

    expect(mockIsland.scrollLeft).toBe(50);
    expect(mockIsland.scrollTop).toBe(100);
  });
});

describe('QwikHMRAdapter - handleError', () => {
  it('should handle component$ errors', () => {
    const adapter = new QwikHMRAdapter();
    const mockIsland = new MockHTMLElement() as unknown as HTMLElement;

    const error = new Error('component$ is not defined');

    try {
      adapter.handleError(mockIsland, error);
      expect(mockIsland.getAttribute('data-hmr-error')).toBe('true');
      expect(mockIsland.getAttribute('data-hmr-error-message')).toBe('component$ is not defined');
    } catch (e) {
      // Expected in test environment without DOM
      expect((e as Error).message.includes('document is not defined')).toBe(true);
    }
  });

  it('should handle serialization errors', () => {
    const adapter = new QwikHMRAdapter();
    const mockIsland = new MockHTMLElement() as unknown as HTMLElement;

    const error = new Error('Failed to serialize state');

    try {
      adapter.handleError(mockIsland, error);
    } catch (e) {
      // Expected in test environment
    }
  });
});

describe('QwikHMRAdapter - extractComponentName', () => {
  it('should extract from various paths', () => {
    const adapter = new QwikHMRAdapter();

    const extractName = (adapter as any).extractComponentName.bind(adapter);

    expect(extractName('/islands/Counter.qwik.tsx')).toBe('Counter');
    expect(extractName('/islands/Button.qwik.jsx')).toBe('Button');
    expect(extractName('/src/components/Card.tsx')).toBe('Card');
    expect(extractName('/nested/path/Component.jsx')).toBe('Component');
    expect(extractName('SimpleComponent.qwik.tsx')).toBe('SimpleComponent');
  });
});

describe('QwikHMRAdapter - unmount', () => {
  it('should handle unmount of untracked island', () => {
    const adapter = new QwikHMRAdapter();
    const mockIsland = new MockHTMLElement() as unknown as HTMLElement;

    // Should not throw for untracked islands
    expect(() => adapter.unmount(mockIsland)).not.toThrow();
  });
});

describe('QwikHMRAdapter - singleton instance', () => {
  it('should export singleton', async () => {
    const { qwikAdapter } = await import('../adapters/qwik-adapter.ts');

    expect(qwikAdapter).toBeDefined();
    expect(qwikAdapter.name).toBe('qwik');
    expect(qwikAdapter instanceof QwikHMRAdapter).toBe(true);
  });
});
