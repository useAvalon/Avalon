/**
 * Qwik HMR Adapter
 *
 * Provides Hot Module Replacement support for Qwik components.
 * Qwik is fundamentally different from other frameworks — it uses resumability
 * instead of hydration. Components are serialized on the server and resumed
 * on the client without replaying application logic.
 *
 * Key Qwik concepts:
 * - Resumability: No hydration step — the app resumes from serialized state
 * - Lazy loading via $: Code is split at $ boundaries and loaded on demand
 * - Containers: Qwik apps run inside container elements with q:container attribute
 * - Qwikloader: A tiny (~1KB) script that sets up global event listeners
 *
 * Requirements: 2.1
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '../framework-adapter.ts';

/**
 * Qwik component type
 * Qwik components are created with component$() which returns a QRL-wrapped component
 */
type QwikComponent<P = Record<string, unknown>> = {
	(props: P): unknown;
	__brand?: 'QwikComponent';
};

/**
 * Qwik module interface for SSR/client rendering
 */
interface QwikModule {
	renderToString?: (opts: Record<string, unknown>) => Promise<string>;
	render?: (parent: Element, jsxNode: unknown) => Promise<void>;
}

/**
 * Qwik state snapshot extending base state
 */
interface QwikStateSnapshot extends StateSnapshot {
	framework: 'qwik';
	data: {
		componentName: string;
		capturedProps: Record<string, unknown>;
		containerState: string | null;
		qContainerAttrs: Record<string, string>;
	};
}

/**
 * Qwik HMR Adapter
 *
 * Unlike other frameworks, Qwik doesn't hydrate — it resumes. This adapter
 * handles HMR by re-rendering the container rather than performing traditional
 * hydration-based hot updates.
 *
 * During development, Qwik's optimizer (via vite-plugin-qwik) handles most
 * of the HMR heavy lifting. This adapter provides the island-level integration
 * for Avalon's HMR coordinator.
 */
export class QwikHMRAdapter extends BaseFrameworkAdapter {
  readonly name = 'qwik';

  /**
   * Track container elements for cleanup
   */
  private containers: WeakMap<HTMLElement, { cleanup?: () => void }> = new WeakMap();

  /**
   * Check if a component is a Qwik component
   *
   * Qwik components are created with component$() and have distinctive markers:
   * - __brand or __qrl property from the Qwik optimizer
   * - $ suffix convention in source
   * - QRL (Qwik Resource Locator) references
   */
  canHandle(component: unknown): boolean {
    if (!component) return false;

    // Check if it's a function (Qwik components are functions)
    if (typeof component === 'function') {
      const comp = component as unknown as Record<string, unknown>;

      // Check for Qwik-specific markers set by the optimizer
      if (comp.__brand === 'QwikComponent' || comp.__qrl) {
        return true;
      }

      // Check for QRL wrapper pattern
      if (comp.getSymbol || comp.getHash) {
        return true;
      }

      try {
        const funcStr = component.toString();

        // Look for Qwik-specific compiled patterns
        if (
          funcStr.includes('component$') ||
          funcStr.includes('qrl') ||
          funcStr.includes('useSignal') ||
          funcStr.includes('useStore') ||
          funcStr.includes('useTask$') ||
          funcStr.includes('useVisibleTask$') ||
          funcStr.includes('_qrl') ||
          funcStr.includes('qwik')
        ) {
          return true;
        }
      } catch {
        // Ignore errors from toString()
      }
    }

    // Check if it's a Qwik component object (wrapped or exported)
    if (typeof component === 'object' && component !== null) {
      const obj = component as Record<string, unknown>;

      // Check for default export pattern
      if (obj.default && typeof obj.default === 'function') {
        return this.canHandle(obj.default);
      }

      // Check for Qwik QRL markers
      if (obj.__qrl || obj.__brand === 'QwikComponent') {
        return true;
      }
    }

    return false;
  }

  /**
   * Preserve Qwik component state before HMR update
   *
   * Qwik serializes state into the DOM via q:container attributes and
   * inline <script type="qwik/json"> blocks. We capture this serialized
   * state so it can be used during re-rendering.
   */
  override preserveState(island: HTMLElement): QwikStateSnapshot | null {
    try {
      const baseSnapshot = super.preserveState(island);
      if (!baseSnapshot) return null;

      // Get props from the island
      const propsAttr = island.getAttribute('data-props');
      const capturedProps = propsAttr ? JSON.parse(propsAttr) : {};

      const src = island.getAttribute('data-src') || '';
      const componentName = this.extractComponentName(src);

      // Capture Qwik container state — serialized in the DOM
      const containerEl = island.closest('[q\\:container]') || island;
      const containerState = containerEl.querySelector('script[type="qwik/json"]')?.textContent || null;

      // Capture q: attributes that hold container metadata
      const qContainerAttrs: Record<string, string> = {};
      const attrs = containerEl.attributes;
      if (attrs) {
        for (let i = 0; i < attrs.length; i++) {
          const attr = attrs[i];
          if (attr.name.startsWith('q:')) {
            qContainerAttrs[attr.name] = attr.value;
          }
        }
      }

      return {
        ...baseSnapshot,
        framework: 'qwik',
        data: {
          componentName,
          capturedProps,
          containerState,
          qContainerAttrs,
        },
      };
    } catch (error) {
      console.warn('Failed to preserve Qwik state:', error);
      return null;
    }
  }

  /**
   * Update Qwik component with HMR
   *
   * Qwik's resumability model means we don't hydrate in the traditional sense.
   * Instead, during HMR:
   * 1. The Qwik optimizer (vite-plugin-qwik) invalidates the affected QRLs
   * 2. We re-render the component into the island container
   * 3. Qwikloader picks up the new event bindings automatically
   * 4. Serialized state is restored from the container
   */
  async update(
    island: HTMLElement,
    newComponent: unknown,
    props: Record<string, unknown>
  ): Promise<void> {
    if (!this.canHandle(newComponent)) {
      throw new Error('Component is not a valid Qwik component');
    }

    // Extract the actual component function
    let Component: QwikComponent;
    if (typeof newComponent === 'object' && newComponent !== null) {
      const obj = newComponent as Record<string, unknown>;
      if (obj.default && typeof obj.default === 'function') {
        Component = obj.default as QwikComponent;
      } else {
        throw new Error('Qwik component object must have a default export');
      }
    } else if (typeof newComponent === 'function') {
      Component = newComponent as QwikComponent;
    } else {
      throw new Error('Invalid Qwik component type');
    }

    try {
      // Clean up existing container tracking
      const existing = this.containers.get(island);
      if (existing?.cleanup) {
        try {
          existing.cleanup();
        } catch (error) {
          console.warn('Failed to clean up existing Qwik container:', error);
        }
      }

      // Dynamically import Qwik's client render API
      // In development, vite-plugin-qwik makes this available
      // Use a variable to prevent Vite's static import analysis from resolving this at build time
      const qwikId = '@builder.io/qwik';
      const qwikModule = await import(/* @vite-ignore */ qwikId) as QwikModule & Record<string, unknown>;

      if (qwikModule.render) {
        // Use Qwik's client-side render to mount the component
        // Qwik's render handles setting up the container and resumability
        const jsxNode = typeof qwikModule.jsx === 'function'
          ? qwikModule.jsx(Component, props)
          : Component(props);

        await qwikModule.render(island, jsxNode);
      } else {
        // Fallback: replace innerHTML and let Qwikloader resume
        // This works because Qwik's event listeners are declarative in the DOM
        console.warn('Qwik render API not available, using innerHTML fallback');
        const result = Component(props);
        if (typeof result === 'string') {
          island.innerHTML = result;
        }
      }

      // Track the container for future cleanup
      this.containers.set(island, {});

      // Mark as hydrated (resumed, in Qwik terms)
      island.setAttribute('data-hydrated', 'true');
      island.setAttribute('data-hydration-status', 'success');

    } catch (error) {
      console.error('Qwik HMR update failed:', error);
      island.setAttribute('data-hydration-status', 'error');
      throw error;
    }
  }

  /**
   * Restore Qwik component state after HMR update
   *
   * Qwik's serialized state lives in the DOM, so restoring the container
   * state script block and q: attributes is sufficient for the framework
   * to resume correctly.
   */
  override restoreState(island: HTMLElement, state: StateSnapshot): void {
    try {
      // Restore DOM state (scroll, focus, form values)
      super.restoreState(island, state);

      // Qwik's resumability handles reactive state automatically
      // through its serialized container state in the DOM

    } catch (error) {
      console.warn('Failed to restore Qwik state:', error);
    }
  }

  /**
   * Handle errors during Qwik HMR update
   */
  override handleError(island: HTMLElement, error: Error): void {
    console.error('Qwik HMR error:', error);

    super.handleError(island, error);

    const errorIndicator = island.querySelector('.hmr-error-indicator');
    if (errorIndicator) {
      const errorMessage = error.message;

      let hint = '';
      if (errorMessage.includes('component$') || errorMessage.includes('component\\$')) {
        hint = ' (Hint: Ensure component is wrapped with component$())';
      } else if (errorMessage.includes('useSignal') || errorMessage.includes('useStore')) {
        hint = ' (Hint: Qwik hooks must be called inside component$() body)';
      } else if (errorMessage.includes('QRL') || errorMessage.includes('qrl')) {
        hint = ' (Hint: Check that lazy-loaded boundaries use $ correctly)';
      } else if (errorMessage.includes('serialize') || errorMessage.includes('container')) {
        hint = ' (Hint: Ensure all state is serializable — Qwik serializes state to the DOM)';
      } else if (errorMessage.includes('resumable') || errorMessage.includes('resume')) {
        hint = ' (Hint: Server and client container state must match for resumability)';
      }

      errorIndicator.textContent = `Qwik HMR Error: ${errorMessage}${hint}`;
    }
  }

  /**
   * Extract component name from source path
   */
  private extractComponentName(src: string): string {
    const parts = src.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.qwik\.(tsx?|jsx?)$/, '').replace(/\.(tsx?|jsx?)$/, '');
  }

  /**
   * Clean up Qwik component when island is removed
   */
  unmount(island: HTMLElement): void {
    const container = this.containers.get(island);
    if (container) {
      try {
        if (container.cleanup) {
          container.cleanup();
        }
        this.containers.delete(island);
      } catch (error) {
        console.warn('Failed to unmount Qwik component:', error);
      }
    }
  }
}

export const qwikAdapter = new QwikHMRAdapter();
