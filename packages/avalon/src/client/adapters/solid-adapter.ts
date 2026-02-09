/**
 * Solid HMR Adapter
 * 
 * Provides Hot Module Replacement support for Solid components using Solid Refresh.
 * Integrates with vite-plugin-solid to preserve signal subscriptions and reactive computations.
 * Handles Solid's fine-grained reactivity system during hot updates.
 * 
 * Requirements: 2.5
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '../framework-adapter.ts';

/**
 * Solid component type
 * Solid components are functions that return JSX
 */
type SolidComponent<P = Record<string, unknown>> = (props: P) => unknown;

/**
 * Solid Web module interface
 */
interface SolidWebModule {
  hydrate(
    fn: () => unknown,
    node: HTMLElement,
    options?: { renderId?: string }
  ): () => void;
  render(
    fn: () => unknown,
    node: HTMLElement
  ): () => void;
  createComponent<P>(
    component: SolidComponent<P>,
    props: P
  ): unknown;
}

/**
 * Solid HMR Runtime interface
 * Provided by vite-plugin-solid for hot module replacement
 */
interface SolidHMRRuntime {
  /**
   * Create a record for a component
   */
  createRecord(id: string, component: SolidComponent): void;
  
  /**
   * Reload a component
   */
  reload(id: string, component: SolidComponent): void;
  
  /**
   * Update component
   */
  update(id: string, component: SolidComponent): void;
}

/**
 * Global Solid HMR runtime
 * Injected by vite-plugin-solid
 */
declare global {
  var __SOLID_HMR__: SolidHMRRuntime | undefined;
}

/**
 * Solid-specific state snapshot
 * Extends base snapshot with Solid-specific state like signal values
 */
interface SolidStateSnapshot extends StateSnapshot {
  framework: 'solid';
  data: {
    /**
     * Signal values captured from component
     * Note: Solid's fine-grained reactivity makes this challenging
     */
    signalValues?: Record<string, unknown>;
    
    /**
     * Component display name for debugging
     */
    componentName?: string;
    
    /**
     * Props at time of state capture
     */
    capturedProps?: Record<string, unknown>;
    
    /**
     * Render ID for hydration
     */
    renderId?: string;
  };
}

/**
 * Solid HMR Adapter
 * 
 * Leverages Solid Refresh (provided by vite-plugin-solid) to:
 * - Preserve signal subscriptions across updates
 * - Maintain reactive computations
 * - Handle component updates without full remount
 * 
 * Solid Refresh works through the __SOLID_HMR__ API:
 * 1. When a component module is updated, Vite sends an HMR event
 * 2. We use __SOLID_HMR__.reload() to hot-reload the component
 * 3. Solid Refresh preserves signal subscriptions automatically
 * 4. Reactive computations are maintained across updates
 * 5. The component re-renders with preserved reactive state
 */
export class SolidHMRAdapter extends BaseFrameworkAdapter {
  readonly name = 'solid';
  
  /**
   * Store Solid dispose functions for each island to enable proper cleanup
   */
  private disposers: WeakMap<HTMLElement, () => void> = new WeakMap();
  
  /**
   * Store component IDs for HMR runtime
   */
  private componentIds: WeakMap<HTMLElement, string> = new WeakMap();

  /**
   * Check if a component is a Solid component
   * 
   * Solid components are:
   * - Functions that return JSX
   * - May use createSignal, createEffect, etc.
   * - Typically have .solid.tsx extension (but not always)
   */
  canHandle(component: unknown): boolean {
    if (!component) return false;
    
    // Check if it's a function (Solid components are functions)
    if (typeof component === 'function') {
      const comp = component as unknown as Record<string, unknown>;
      
      // Check for Solid-specific markers
      // Solid components may have __solid marker from vite-plugin-solid
      if (comp.__solid) {
        return true;
      }
      
      // Check function signature - Solid components typically accept props
      // and return JSX (which is compiled to function calls)
      try {
        const funcStr = component.toString();
        
        // Look for Solid-specific patterns
        // - createSignal, createEffect, createMemo, etc.
        // - JSX patterns (though this is less reliable after compilation)
        if (
          funcStr.includes('createSignal') ||
          funcStr.includes('createEffect') ||
          funcStr.includes('createMemo') ||
          funcStr.includes('createResource') ||
          funcStr.includes('createStore') ||
          funcStr.includes('_$') || // Solid's compiled JSX helper prefix
          funcStr.includes('_tmpl$') // Solid's template marker
        ) {
          return true;
        }
      } catch {
        // Ignore errors from toString()
      }
      
      // If we can't determine definitively, assume it could be a Solid component
      // if it's a function (Solid components are just functions)
      // This is a fallback - we'll let Solid's hydration handle validation
      return true;
    }
    
    // Check if it's a Solid component object (wrapped or exported)
    if (typeof component !== 'object') {
      return false;
    }

    const obj = component as Record<string, unknown>;
    
    // Check for default export pattern
    if (obj.default && typeof obj.default === 'function') {
      return this.canHandle(obj.default);
    }
    
    // Check for Solid component markers
    if (obj.__solid) {
      return true;
    }
    
    return false;
  }

  /**
   * Preserve Solid component state before HMR update
   * 
   * Solid Refresh handles most state preservation automatically through
   * its fine-grained reactivity system. We capture additional DOM state
   * and props for fallback.
   * 
   * Note: Solid's signals are not easily accessible from outside the component,
   * so we rely on Solid Refresh to preserve them.
   */
  override preserveState(island: HTMLElement): SolidStateSnapshot | null {
    try {
      // Get base DOM state
      const baseSnapshot = super.preserveState(island);
      if (!baseSnapshot) return null;

      // Get Solid-specific data
      const propsAttr = island.getAttribute('data-props');
      const capturedProps = propsAttr ? JSON.parse(propsAttr) : {};
      
      // Try to get component name from the island
      const src = island.getAttribute('data-src') || '';
      const componentName = this.extractComponentName(src);
      
      // Get render ID for hydration
      const renderId = island.dataset.solidRenderId || island.dataset.renderId;

      const solidSnapshot: SolidStateSnapshot = {
        ...baseSnapshot,
        framework: 'solid',
        data: {
          componentName,
          capturedProps,
          renderId,
        },
      };

      return solidSnapshot;
    } catch (error) {
      console.warn('Failed to preserve Solid state:', error);
      return null;
    }
  }

  /**
   * Update Solid component with HMR
   * 
   * This method integrates with Solid Refresh:
   * 1. Solid Refresh is automatically enabled by vite-plugin-solid
   * 2. When a module updates, Vite sends an HMR event
   * 3. We use __SOLID_HMR__ to reload the component
   * 4. Solid Refresh preserves signal subscriptions automatically
   * 5. Reactive computations are maintained
   * 6. The component re-renders with preserved reactive state
   */
  async update(
    island: HTMLElement,
    newComponent: unknown,
    props: Record<string, unknown>
  ): Promise<void> {
    if (!this.canHandle(newComponent)) {
      throw new Error('Component is not a valid Solid component');
    }

    // Extract the actual component function
    let Component: SolidComponent;
    if (typeof newComponent === 'object' && newComponent !== null) {
      const obj = newComponent as Record<string, unknown>;
      if (obj.default && typeof obj.default === 'function') {
        Component = obj.default as SolidComponent;
      } else {
        throw new Error('Solid component object must have a default export');
      }
    } else if (typeof newComponent === 'function') {
      Component = newComponent as SolidComponent;
    } else {
      throw new Error('Invalid Solid component type');
    }

    try {
      // Check if we have an existing disposer
      const existingDisposer = this.disposers.get(island);
      const componentId = this.componentIds.get(island);

      // Try to use Solid HMR runtime if available
      const hmrRuntime = globalThis.__SOLID_HMR__;
      
      if (hmrRuntime && componentId) {
        // Use Solid's HMR runtime for hot reload
        // This preserves signal subscriptions and reactive computations automatically
        try {
          hmrRuntime.reload(componentId, Component);
          
          // If we have an existing component, Solid Refresh handles the update
          // We don't need to do anything else
          if (existingDisposer) {
            return;
          }
        } catch (error) {
          console.warn('Solid HMR runtime reload failed, falling back to full remount:', error);
        }
      }

      // Clean up existing component if present
      if (existingDisposer) {
        try {
          existingDisposer();
          this.disposers.delete(island);
        } catch (error) {
          console.warn('Failed to dispose existing Solid component:', error);
        }
      }

      // Dynamically import Solid at runtime
      // This is resolved by Vite in the browser
      const solidWebModule = await import('solid-js/web') as SolidWebModule;
      const { hydrate, createComponent } = solidWebModule;

      // Get render ID for hydration
      const renderId = island.dataset.solidRenderId || island.dataset.renderId;
      
      // Check if we have SSR content to hydrate

      // Hydrate or render the component
      const dispose = hydrate(
        () => createComponent(Component, props),
        island,
        {
          renderId,
        }
      );
      
      // Store disposer for future updates
      this.disposers.set(island, dispose);
      
      // Generate component ID for HMR runtime
      const src = island.getAttribute('data-src') || '';
      const newComponentId = this.generateComponentId(src);
      this.componentIds.set(island, newComponentId);
      
      // Register with HMR runtime if available
      if (hmrRuntime) {
        try {
          hmrRuntime.createRecord(newComponentId, Component);
        } catch (error) {
          console.warn('Failed to register with Solid HMR runtime:', error);
        }
      }

      // Mark as hydrated
      island.setAttribute('data-hydrated', 'true');
      island.setAttribute('data-hydration-status', 'success');
      
    } catch (error) {
      console.error('Solid HMR update failed:', error);
      island.setAttribute('data-hydration-status', 'error');
      throw error;
    }
  }

  /**
   * Restore Solid component state after HMR update
   * 
   * Solid Refresh handles most state restoration automatically through
   * its fine-grained reactivity system. We restore DOM state (scroll, focus,
   * form values) as a supplement.
   */
  override restoreState(island: HTMLElement, state: StateSnapshot): void {
    try {
      // Restore DOM state (scroll, focus, form values)
      super.restoreState(island, state);
      
      // Solid Refresh handles signal subscriptions and reactive computations
      // automatically, so we don't need to do anything special here
      
    } catch (error) {
      console.warn('Failed to restore Solid state:', error);
    }
  }

  /**
   * Handle errors during Solid HMR update
   * 
   * Provides Solid-specific error handling with helpful messages
   */
  override handleError(island: HTMLElement, error: Error): void {
    console.error('Solid HMR error:', error);
    
    // Use base error handling
    super.handleError(island, error);
    
    // Add Solid-specific error information
    const errorIndicator = island.querySelector('.hmr-error-indicator');
    if (errorIndicator) {
      const errorMessage = error.message;
      
      // Provide helpful hints for common Solid errors
      let hint = '';
      if (errorMessage.includes('signal') || errorMessage.includes('Signal')) {
        hint = ' (Hint: Check signal usage - signals must be called as functions)';
      } else if (errorMessage.includes('effect') || errorMessage.includes('Effect')) {
        hint = ' (Hint: Check effect usage - effects run after render)';
      } else if (errorMessage.includes('hydration') || errorMessage.includes('hydrate')) {
        hint = ' (Hint: Server and client render must match)';
      } else if (errorMessage.includes('createSignal') || errorMessage.includes('createEffect')) {
        hint = ' (Hint: Solid primitives must be called inside component functions)';
      } else if (errorMessage.includes('reactive')) {
        hint = ' (Hint: Check reactive dependencies - they must be accessed inside tracking scopes)';
      }
      
      errorIndicator.textContent = `Solid HMR Error: ${errorMessage}${hint}`;
    }
  }

  /**
   * Extract component name from source path
   * Used for debugging and error messages
   */
  private extractComponentName(src: string): string {
    const parts = src.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.solid\.(tsx?|jsx?)$/, '').replace(/\.(tsx?|jsx?)$/, '');
  }

  /**
   * Generate a unique component ID for HMR runtime
   */
  private generateComponentId(src: string): string {
    // Use the source path as the component ID
    // This ensures consistency across HMR updates
    return src.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Clean up Solid component when island is removed
   * This should be called when an island is unmounted
   */
  unmount(island: HTMLElement): void {
    const disposer = this.disposers.get(island);
    if (disposer) {
      try {
        disposer();
        this.disposers.delete(island);
        this.componentIds.delete(island);
      } catch (error) {
        console.warn('Failed to unmount Solid component:', error);
      }
    }
  }
}

/**
 * Create and export a singleton instance of the Solid HMR adapter
 */
export const solidAdapter = new SolidHMRAdapter();
