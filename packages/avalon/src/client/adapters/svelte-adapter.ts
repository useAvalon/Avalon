/**
 * Svelte HMR Adapter
 * 
 * Provides Hot Module Replacement support for Svelte 5 components.
 * Integrates with @sveltejs/vite-plugin-svelte for HMR updates.
 * 
 * IMPORTANT: Svelte 5 HMR Behavior
 * - HMR is controlled via compilerOptions.hmr in the Vite plugin config
 * - Local state is NOT preserved during HMR (by design in Svelte 5)
 * - CSS-only changes DO preserve state (100% preserved)
 * - Store subscriptions are maintained across updates
 * - The component is remounted with fresh state on JS changes
 * 
 * Requirements: 2.4
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '../framework-adapter.ts';

/**
 * Svelte component class type
 * Svelte components are compiled to classes with specific methods
 */
interface SvelteComponent {
  /**
   * Create a new component instance
   */
  new (options: SvelteComponentOptions): SvelteComponentInstance;
  
  /**
   * Svelte component marker
   */
  $$render?: unknown;
}

/**
 * Svelte component constructor options
 */
interface SvelteComponentOptions {
  /**
   * Target DOM element
   */
  target: HTMLElement;
  
  /**
   * Component props
   */
  props?: Record<string, unknown>;
  
  /**
   * Hydration mode
   */
  hydrate?: boolean;
  
  /**
   * Intro animations
   */
  intro?: boolean;
  
  /**
   * Anchor element for insertion
   */
  anchor?: Element | null;
  
  /**
   * Context for component
   */
  context?: Map<unknown, unknown>;
}

/**
 * Svelte component instance interface
 */
interface SvelteComponentInstance {
  /**
   * Update component props
   */
  $set(props: Record<string, unknown>): void;
  
  /**
   * Destroy component instance
   */
  $destroy(): void;
  
  /**
   * Subscribe to component events
   */
  $on?(event: string, handler: (...args: unknown[]) => void): () => void;
  
  /**
   * Access to component state (internal)
   */
  $$?: {
    ctx?: unknown[];
    props?: Record<string, unknown>;
    bound?: Record<string, unknown>;
  };
}

/**
 * Svelte store interface
 * Svelte stores follow the store contract
 */
interface SvelteStore<T = unknown> {
  subscribe(subscriber: (value: T) => void): () => void;
  set?(value: T): void;
  update?(updater: (value: T) => T): void;
}

/**
 * Svelte HMR API provided by @sveltejs/vite-plugin-svelte (Svelte 4)
 * Note: In Svelte 5, HMR is integrated into compilerOptions and doesn't use this API
 * @deprecated This API is for Svelte 4 compatibility only
 */
interface SvelteHMRAPI {
  /**
   * Create HMR record for a component
   */
  createRecord(id: string, component: SvelteComponent): void;
  
  /**
   * Reload a component
   */
  reload(id: string, component: SvelteComponent): void;
  
  /**
   * Update component options
   */
  update(id: string, component: SvelteComponent): void;
}

/**
 * Global Svelte HMR runtime
 * Note: In Svelte 5, this is typically not used as HMR is handled via compilerOptions
 * @deprecated This global is for Svelte 4 compatibility only
 */
declare global {
  var __SVELTE_HMR__: SvelteHMRAPI | undefined;
}

/**
 * Svelte-specific state snapshot
 * Extends base snapshot with Svelte-specific state like local state and stores
 */
interface SvelteStateSnapshot extends StateSnapshot {
  framework: 'svelte';
  data: {
    /**
     * Svelte component local state
     * Captured from component instance
     */
    localState?: Record<string, unknown>;
    
    /**
     * Store subscriptions and values
     * Captured from active stores
     */
    storeValues?: Record<string, unknown>;
    
    /**
     * Component display name for debugging
     */
    componentName?: string;
    
    /**
     * Props at time of state capture
     */
    capturedProps?: Record<string, unknown>;
    
    /**
     * Reactive statement dependencies
     */
    reactiveDependencies?: string[];
  };
}

/**
 * Svelte HMR Adapter
 * 
 * Handles HMR for Svelte 5 components in the Avalon islands architecture.
 * 
 * Svelte 5 HMR Behavior:
 * - HMR is controlled via compilerOptions.hmr in the Vite plugin config
 * - Local state is NOT preserved during HMR (by design in Svelte 5)
 * - CSS-only changes DO preserve state (100% preserved)
 * - Store subscriptions are maintained across updates
 * - The component is remounted with fresh state on JS changes
 * 
 * How it works:
 * 1. When a component module is updated, Vite sends an HMR event
 * 2. Svelte's compiler-integrated HMR handles the update
 * 3. We clean up the old instance and mount the new component
 * 4. DOM state (scroll, focus, form values) is preserved where possible
 * 5. The component re-renders with fresh state
 */
export class SvelteHMRAdapter extends BaseFrameworkAdapter {
  readonly name = 'svelte';
  
  /**
   * Store Svelte component instances for each island to enable proper cleanup
   */
  private instances: WeakMap<HTMLElement, SvelteComponentInstance> = new WeakMap();
  
  /**
   * Store component IDs for tracking
   */
  private componentIds: WeakMap<HTMLElement, string> = new WeakMap();
  
  /**
   * Store active store subscriptions for cleanup
   */
  private storeSubscriptions: WeakMap<HTMLElement, Array<() => void>> = new WeakMap();

  /**
   * Check if a component is a Svelte component
   * 
   * Svelte components are compiled to classes with specific markers:
   * - Constructor function
   * - $$render method (SSR marker)
   * - Prototype with $set, $destroy methods
   */
  canHandle(component: unknown): boolean {
    if (!component) return false;
    
    // Check if it's a function/class (Svelte components are classes)
    if (typeof component === 'function') {
      const comp = component as unknown as Record<string, unknown>;
      
      // Check for Svelte-specific markers
      // Svelte components have $$render for SSR
      if (comp.$$render) {
        return true;
      }
      
      // Check prototype for Svelte component methods
      const proto = (component as { prototype?: Record<string, unknown> }).prototype;
      if (proto) {
        // Svelte components have $set and $destroy methods
        if (proto.$set && proto.$destroy) {
          return true;
        }
        
        // Check for $$ internal property
        if (proto.$$) {
          return true;
        }
      }
      
      // Check for Svelte component constructor signature
      // Svelte components accept { target, props, hydrate } options
      try {
        // Try to detect Svelte component by checking if it looks like a Svelte constructor
        const funcStr = component.toString();
        if (funcStr.includes('$set') || funcStr.includes('$destroy') || funcStr.includes('$$')) {
          return true;
        }
      } catch {
        // Ignore errors from toString()
      }
    }
    
    // Check if it's a Svelte component object (wrapped or exported)
    if (typeof component === 'object' && component !== null) {
      const obj = component as Record<string, unknown>;
      
      // Check for default export pattern
      if (obj.default && typeof obj.default === 'function') {
        return this.canHandle(obj.default);
      }
      
      // Check for Svelte component markers
      if (obj.$$render) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Preserve Svelte component state before HMR update
   * 
   * Note: In Svelte 5, local state is NOT preserved during HMR (by design).
   * We capture DOM state (scroll, focus, form values) which CAN be restored.
   */
  override preserveState(island: HTMLElement): SvelteStateSnapshot | null {
    try {
      // Get base DOM state
      const baseSnapshot = super.preserveState(island);
      if (!baseSnapshot) return null;

      // Get Svelte-specific data
      const propsAttr = island.getAttribute('data-props');
      const capturedProps = propsAttr ? JSON.parse(propsAttr) : {};
      
      // Try to get component name from the island
      const src = island.getAttribute('data-src') || '';
      const componentName = this.extractComponentName(src);

      // Note: In Svelte 5, local state is not preserved during HMR
      // We still capture it for debugging purposes, but it won't be restored
      const localState = this.captureLocalState(island);
      
      // Store values are maintained by Svelte's reactivity system
      const storeValues = this.captureStoreValues(island);

      const svelteSnapshot: SvelteStateSnapshot = {
        ...baseSnapshot,
        framework: 'svelte',
        data: {
          componentName,
          capturedProps,
          localState,
          storeValues,
        },
      };

      return svelteSnapshot;
    } catch (error) {
      console.warn('Failed to preserve Svelte state:', error);
      return null;
    }
  }

  /**
   * Update Svelte component with HMR
   * 
   * Svelte 5 HMR Behavior:
   * - HMR is handled by the Svelte compiler via compilerOptions.hmr
   * - Local state is NOT preserved (by design)
   * - CSS-only changes preserve state 100%
   * - We clean up the old instance and mount the new component
   * 
   * For Svelte 5, we use the hydrate() and mount() functions.
   */
  async update(
    island: HTMLElement,
    newComponent: unknown,
    props: Record<string, unknown>
  ): Promise<void> {
    if (!this.canHandle(newComponent)) {
      throw new Error('Component is not a valid Svelte component');
    }

    // Extract the actual component class
    let Component: SvelteComponent;
    if (typeof newComponent === 'object' && newComponent !== null) {
      const obj = newComponent as Record<string, unknown>;
      if (obj.default && typeof obj.default === 'function') {
        Component = obj.default as SvelteComponent;
      } else {
        throw new Error('Svelte component object must have a default export');
      }
    } else if (typeof newComponent === 'function') {
      Component = newComponent as SvelteComponent;
    } else {
      throw new Error('Invalid Svelte component type');
    }

    try {
      // Clean up existing instance if present
      const existingInstance = this.instances.get(island);
      if (existingInstance) {
        try {
          // Unsubscribe from stores
          const subscriptions = this.storeSubscriptions.get(island);
          if (subscriptions) {
            subscriptions.forEach(unsubscribe => unsubscribe());
            this.storeSubscriptions.delete(island);
          }
          
          // Try to use Svelte 5's unmount function for proper cleanup
          try {
            const svelteModule = await import('svelte') as Record<string, unknown>;
            const svelteUnmount = svelteModule.unmount as ((component: unknown) => void) | undefined;
            if (svelteUnmount) {
              svelteUnmount(existingInstance);
            } else if (existingInstance.$destroy) {
              existingInstance.$destroy();
            }
          } catch {
            // Fallback to $destroy for Svelte 4 compatibility
            if (existingInstance.$destroy) {
              existingInstance.$destroy();
            }
          }
        } catch (error) {
          console.warn('Failed to destroy existing Svelte instance:', error);
        }
      }

      // Clear the island content for fresh mount
      // This is necessary because Svelte 5 HMR doesn't preserve state
      island.innerHTML = '';

      // Mount the new component using Svelte 5 API
      let instance: SvelteComponentInstance;
      
      try {
        // Use Svelte 5's mount function
        const svelteModule = await import('svelte') as Record<string, unknown>;
        const svelteMount = svelteModule.mount as ((component: unknown, options: { target: HTMLElement; props: Record<string, unknown> }) => unknown) | undefined;
        
        if (svelteMount) {
          // deno-lint-ignore no-explicit-any
          instance = svelteMount(Component as any, {
            target: island,
            props,
          }) as SvelteComponentInstance;
        } else {
          // Fallback to Svelte 3/4 constructor API
          instance = new Component({
            target: island,
            props,
            hydrate: false, // Fresh mount, not hydration
            intro: false, // Disable intro animations during HMR
          });
        }
      } catch (svelte5Error) {
        // Fallback to Svelte 3/4 constructor API
        console.debug('Svelte 5 API not available, using constructor API:', svelte5Error);
        
        instance = new Component({
          target: island,
          props,
          hydrate: false, // Fresh mount, not hydration
          intro: false, // Disable intro animations during HMR
        });
      }
      
      // Store instance for future updates
      this.instances.set(island, instance);
      
      // Generate component ID for tracking
      const src = island.getAttribute('data-src') || '';
      const newComponentId = this.generateComponentId(src);
      this.componentIds.set(island, newComponentId);

      // Mark as hydrated
      island.setAttribute('data-hydrated', 'true');
      island.setAttribute('data-hydration-status', 'success');
      
    } catch (error) {
      console.error('Svelte HMR update failed:', error);
      island.setAttribute('data-hydration-status', 'error');
      throw error;
    }
  }

  /**
   * Restore Svelte component state after HMR update
   * 
   * Note: In Svelte 5, local state is NOT preserved during HMR (by design).
   * We only restore DOM state (scroll, focus, form values).
   */
  override restoreState(island: HTMLElement, state: StateSnapshot): void {
    try {
      // Restore DOM state (scroll, focus, form values)
      super.restoreState(island, state);
      
      // Note: Svelte 5 does NOT preserve local state during HMR
      // This is by design - see https://github.com/sveltejs/vite-plugin-svelte/blob/main/docs/faq.md
      // CSS-only changes DO preserve state 100%
      
    } catch (error) {
      console.warn('Failed to restore Svelte state:', error);
    }
  }

  /**
   * Handle errors during Svelte HMR update
   * 
   * Provides Svelte-specific error handling with helpful messages
   */
  override handleError(island: HTMLElement, error: Error): void {
    console.error('Svelte HMR error:', error);
    
    // Use base error handling
    super.handleError(island, error);
    
    // Add Svelte-specific error information
    const errorIndicator = island.querySelector('.hmr-error-indicator');
    if (errorIndicator) {
      const errorMessage = error.message;
      
      // Provide helpful hints for common Svelte errors
      let hint = '';
      if (errorMessage.includes('$:') || errorMessage.includes('reactive')) {
        hint = ' (Hint: Check reactive statements ($:) - they must be at component top level)';
      } else if (errorMessage.includes('store')) {
        hint = ' (Hint: Check store usage - stores must be imported and subscribed correctly)';
      } else if (errorMessage.includes('hydration') || errorMessage.includes('hydrate')) {
        hint = ' (Hint: Server and client render must match)';
      } else if (errorMessage.includes('target')) {
        hint = ' (Hint: Check component target - it must be a valid DOM element)';
      } else if (errorMessage.includes('props')) {
        hint = ' (Hint: Check component props - they must match the component definition)';
      }
      
      errorIndicator.textContent = `Svelte HMR Error: ${errorMessage}${hint}`;
    }
  }

  /**
   * Extract component name from source path
   * Used for debugging and error messages
   */
  private extractComponentName(src: string): string {
    const parts = src.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.svelte$/, '');
  }

  /**
   * Detect if an island has existing SSR content vs being an empty container
   * 
   * @param island - Island element to check
   * @returns True if island has SSR content
   */
  private detectSSRContent(island: HTMLElement): boolean {
    // Check if element has any meaningful content
    const hasTextContent = island.textContent && island.textContent.trim().length > 0;
    const hasChildElements = island.children && island.children.length > 0;
    const hasAttributes = island.hasAttribute('data-ssr-content') || island.hasAttribute('data-svelte-rendered');

    // Consider it SSR content if it has text, child elements, or explicit markers
    return hasTextContent || hasChildElements || hasAttributes;
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
   * Attempt to capture local state from Svelte instance
   * This is best-effort and may not work in all cases
   */
  private captureLocalState(island: HTMLElement): Record<string, unknown> | undefined {
    try {
      const instance = this.instances.get(island);
      if (!instance) return undefined;
      
      // Try to access Svelte's internal state
      // This is internal API and may change, so we wrap in try-catch
      const internalState = instance.$$;
      
      if (internalState && internalState.ctx) {
        // ctx is an array of component state values
        // We can't easily map these back to variable names,
        // so we just store the raw values
        return {
          ctx: internalState.ctx,
          props: internalState.props,
          bound: internalState.bound,
        };
      }
      
      return undefined;
    } catch (error) {
      // Silently fail - this is best-effort
      console.debug('Could not capture Svelte local state:', error);
      return undefined;
    }
  }

  /**
   * Attempt to capture store values
   * This is best-effort and may not work in all cases
   */
  private captureStoreValues(_island: HTMLElement): Record<string, unknown> | undefined {
    // Svelte stores are typically imported at module level,
    // so we can't easily access them from the component instance
    // The HMR system should handle store subscriptions automatically
    
    // We could potentially track stores if we intercept store.subscribe calls,
    // but that would require modifying the Svelte runtime, which is not feasible
    
    // For now, we rely on Svelte's HMR to preserve store subscriptions
    return undefined;
  }

  /**
   * Clean up Svelte component when island is removed
   * This should be called when an island is unmounted
   */
  async unmount(_island: HTMLElement): Promise<void> {
    const instance = this.instances.get(_island);
    if (instance) {
      try {
        // Unsubscribe from stores
        const subscriptions = this.storeSubscriptions.get(_island);
        if (subscriptions) {
          subscriptions.forEach(unsubscribe => unsubscribe());
          this.storeSubscriptions.delete(_island);
        }
        
        // Try to use Svelte 5's unmount function for proper cleanup
        try {
          const svelteModule = await import('svelte') as Record<string, unknown>;
          const svelteUnmount = svelteModule.unmount as ((component: unknown) => void) | undefined;
          if (svelteUnmount) {
            svelteUnmount(instance);
          } else if (instance.$destroy) {
            instance.$destroy();
          }
        } catch {
          // Fallback to $destroy for Svelte 4 compatibility
          if (instance.$destroy) {
            instance.$destroy();
          }
        }
        
        // Clean up references
        this.instances.delete(_island);
        this.componentIds.delete(_island);
      } catch (error) {
        console.warn('Failed to unmount Svelte component:', error);
      }
    }
  }
}

/**
 * Create and export a singleton instance of the Svelte HMR adapter
 */
export const svelteAdapter = new SvelteHMRAdapter();
