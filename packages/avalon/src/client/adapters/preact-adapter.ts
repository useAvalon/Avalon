/**
 * Preact HMR Adapter
 * 
 * Provides Hot Module Replacement support for Preact components.
 * Integrates with @preact/preset-vite to preserve hooks state and component tree during updates.
 * 
 * Requirements: 2.2
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '../framework-adapter.ts';

/**
 * Preact component type
 * Can be a function component or class component
 */
type PreactComponent<P = Record<string, unknown>> = 
  | ((props: P) => PreactVNode | null)
  | (new (props: P) => PreactClassComponent);

/**
 * Preact class component interface
 */
interface PreactClassComponent {
  render(): PreactVNode | null;
  isReactComponent?: boolean; // Preact uses same marker as React
}

/**
 * Preact VNode (Virtual Node) type
 */
interface PreactVNode {
  type: string | PreactComponent;
  props: Record<string, unknown>;
  key: string | number | null;
}

/**
 * Preact module interface
 */
interface PreactModule {
  h<P = Record<string, unknown>>(
    component: PreactComponent<P> | string,
    props: P | null,
    ...children: unknown[]
  ): PreactVNode;
  render(vnode: PreactVNode, container: HTMLElement): void;
  hydrate(vnode: PreactVNode, container: HTMLElement): void;
}

/**
 * Preact-specific state snapshot
 * Extends base snapshot with Preact-specific state like hooks
 */
interface PreactStateSnapshot extends StateSnapshot {
  framework: 'preact';
  data: {
    /**
     * Preact component tree data (if accessible)
     * Used by Preact HMR to preserve hooks state
     */
    componentData?: unknown;
    
    /**
     * Component display name for debugging
     */
    componentName?: string;
    
    /**
     * Props at time of state capture
     */
    capturedProps?: Record<string, unknown>;
  };
}

/**
 * Preact HMR Adapter
 * 
 * Leverages Preact's HMR capabilities (provided by @preact/preset-vite) to:
 * - Preserve hooks state across updates
 * - Maintain component tree structure
 * - Handle component updates without full remount
 * 
 * Preact HMR works similarly to React Fast Refresh:
 * 1. Detecting when a component module is updated
 * 2. Preserving the component tree (internal state representation)
 * 3. Re-rendering with the new component definition
 * 4. Restoring hooks state from the preserved tree
 */
export class PreactHMRAdapter extends BaseFrameworkAdapter {
  readonly name = 'preact';
  
  /**
   * Store Preact component instances for each island to enable proper updates
   */
  private instances: WeakMap<HTMLElement, unknown> = new WeakMap();

  /**
   * Check if a component is a Preact component
   * 
   * Preact components can be:
   * - Function components (including hooks)
   * - Class components (extending Preact Component)
   * - Forward refs
   * - Memoized components
   * 
   * Preact is API-compatible with React, so detection is similar
   */
  canHandle(component: unknown): boolean {
    if (!component) return false;
    
    // Check if it's a function (function component or class)
    if (typeof component === 'function') {
      // Check for Preact/React-specific properties on the function
      const comp = component as unknown as Record<string, unknown>;
      
      // Class components have isReactComponent on prototype
      // (Preact uses the same marker for compatibility)
      const proto = (component as { prototype?: Record<string, unknown> }).prototype;
      if (proto && proto.isReactComponent) {
        return true;
      }
      
      // Check for Preact element symbol (for wrapped components)
      if (comp.$typeof) {
        return true;
      }
      
      // Assume any function could be a Preact component
      // Preact HMR will handle validation
      return true;
    }
    
    // Check for Preact VNode types
    if (component == null || typeof component !== 'object') {
      return false;
    }

    const obj = component as Record<string, unknown>;
    
    // Check for Preact VNode symbol
    if (obj.$typeof) {
      return true;
    }
    
    // Check for wrapped components (HOCs, memo, forwardRef)
    if (obj.type && typeof obj.type === 'function') {
      return true;
    }
    
    return false;
  }

  /**
   * Preserve Preact component state before HMR update
   * 
   * Preact HMR handles most state preservation automatically through
   * the component tree. We capture additional DOM state and props for fallback.
   */
  override preserveState(island: HTMLElement): PreactStateSnapshot | null {
    try {
      // Get base DOM state
      const baseSnapshot = super.preserveState(island);
      if (!baseSnapshot) return null;

      // Get Preact-specific data
      const propsAttr = island.getAttribute('data-props');
      const capturedProps = propsAttr ? JSON.parse(propsAttr) : {};
      
      // Try to get component name from the island
      const src = island.getAttribute('data-src') || '';
      const componentName = this.extractComponentName(src);

      const preactSnapshot: PreactStateSnapshot = {
        ...baseSnapshot,
        framework: 'preact',
        data: {
          componentName,
          capturedProps,
        },
      };

      return preactSnapshot;
    } catch (error) {
      console.warn('Failed to preserve Preact state:', error);
      return null;
    }
  }

  /**
   * Update Preact component with HMR
   * 
   * This method integrates with Preact HMR:
   * 1. Preact HMR is automatically enabled by @preact/preset-vite
   * 2. When a module updates, Vite sends an HMR event
   * 3. We re-hydrate the component with the new definition
   * 4. Preact HMR preserves hooks state automatically
   * 5. The component re-renders with preserved state
   */
  async update(
    island: HTMLElement,
    newComponent: unknown,
    props: Record<string, unknown>
  ): Promise<void> {
    if (!this.canHandle(newComponent)) {
      throw new Error('Component is not a valid Preact component');
    }

    const Component = newComponent as PreactComponent;

    try {
      // Dynamically import Preact at runtime
      // This is resolved by Vite in the browser
      const preactModule = await import('preact') as PreactModule;
      const { h, hydrate } = preactModule;

      // Check if we have an existing instance
      const existingInstance = this.instances.get(island);

      if (existingInstance) {
        // Update existing component
        // Preact HMR will preserve hooks state automatically
        const vnode = h(Component, props);
        hydrate(vnode, island);
      } else {
        // Create new instance and hydrate
        // This happens on first HMR update or if instance was lost
        const vnode = h(Component, props);
        hydrate(vnode, island);
        
        // Store instance for future updates
        this.instances.set(island, Component);
      }

      // Mark as hydrated
      island.setAttribute('data-hydrated', 'true');
      island.setAttribute('data-hydration-status', 'success');
      
    } catch (error) {
      console.error('Preact HMR update failed:', error);
      island.setAttribute('data-hydration-status', 'error');
      throw error;
    }
  }

  /**
   * Restore Preact component state after HMR update
   * 
   * Preact HMR handles most state restoration automatically.
   * We restore DOM state (scroll, focus, form values) as a supplement.
   */
  override restoreState(island: HTMLElement, state: StateSnapshot): void {
    try {
      // Restore DOM state (scroll, focus, form values)
      super.restoreState(island, state);
      
      // Preact HMR handles hooks state restoration automatically
      // through the component tree, so we don't need to do anything special here
      
    } catch (error) {
      console.warn('Failed to restore Preact state:', error);
    }
  }

  /**
   * Handle errors during Preact HMR update
   * 
   * Provides Preact-specific error handling with helpful messages
   */
  override handleError(island: HTMLElement, error: Error): void {
    console.error('Preact HMR error:', error);
    
    // Use base error handling
    super.handleError(island, error);
    
    // Add Preact-specific error information
    const errorIndicator = island.querySelector('.hmr-error-indicator');
    if (errorIndicator) {
      const errorMessage = error.message;
      
      // Provide helpful hints for common Preact errors
      let hint = '';
      if (errorMessage.includes('hooks')) {
        hint = ' (Hint: Check hooks usage - hooks must be called in the same order)';
      } else if (errorMessage.includes('render')) {
        hint = ' (Hint: Check component render method for errors)';
      } else if (errorMessage.includes('hydration') || errorMessage.includes('hydrate')) {
        hint = ' (Hint: Server and client render must match)';
      }
      
      errorIndicator.textContent = `Preact HMR Error: ${errorMessage}${hint}`;
    }
  }

  /**
   * Extract component name from source path
   * Used for debugging and error messages
   */
  private extractComponentName(src: string): string {
    const parts = src.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.(tsx?|jsx?)$/, '');
  }

  /**
   * Clean up Preact component when island is removed
   * This should be called when an island is unmounted
   */
  unmount(island: HTMLElement): void {
    const instance = this.instances.get(island);
    if (instance) {
      try {
        // Preact doesn't have an explicit unmount API like React
        // We just clear the instance reference
        this.instances.delete(island);
        
        // Clear the island content to trigger cleanup
        // Preact will handle component lifecycle cleanup
        island.innerHTML = '';
      } catch (error) {
        console.warn('Failed to unmount Preact component:', error);
      }
    }
  }
}

/**
 * Create and export a singleton instance of the Preact HMR adapter
 */
export const preactAdapter = new PreactHMRAdapter();
