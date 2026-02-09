/**
 * Vue HMR Adapter
 * 
 * Provides Hot Module Replacement support for Vue 3 components.
 * Integrates with @vitejs/plugin-vue to preserve reactive state during updates.
 * Uses Vue's __VUE_HMR_RUNTIME__ API for hot updates.
 * 
 * Requirements: 2.3
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '../framework-adapter.ts';

/**
 * Vue component type
 * Can be a component options object or a setup function
 */
type VueComponent<P = Record<string, unknown>> = 
  | VueComponentOptions<P>
  | ((props: P) => unknown);

/**
 * Vue component options interface
 */
interface VueComponentOptions<P = Record<string, unknown>> {
  name?: string;
  props?: string[] | Record<string, unknown>;
  data?: () => Record<string, unknown>;
  setup?: (props: P, context: unknown) => unknown;
  render?: () => unknown;
  template?: string;
  components?: Record<string, VueComponent>;
  computed?: Record<string, () => unknown>;
  methods?: Record<string, (...args: unknown[]) => unknown>;
  watch?: Record<string, unknown>;
  // Vue 3 specific
  emits?: string[] | Record<string, unknown>;
  expose?: string[];
  // Lifecycle hooks
  beforeCreate?: () => void;
  created?: () => void;
  beforeMount?: () => void;
  mounted?: () => void;
  beforeUpdate?: () => void;
  updated?: () => void;
  beforeUnmount?: () => void;
  unmounted?: () => void;
}

/**
 * Vue App instance interface
 */
interface VueApp {
  mount(rootContainer: HTMLElement | string, isHydrate?: boolean): unknown;
  unmount(): void;
  use(plugin: unknown, ...options: unknown[]): this;
  component(name: string, component: VueComponent): this;
  directive(name: string, directive: unknown): this;
  provide(key: string | symbol, value: unknown): this;
  config: {
    errorHandler?: (err: Error, instance: unknown, info: string) => void;
    warnHandler?: (msg: string, instance: unknown, trace: string) => void;
  };
}

/**
 * Vue module interface
 */
interface VueModule {
  createApp(rootComponent: VueComponent, rootProps?: Record<string, unknown>): VueApp;
  version: string;
}

/**
 * Vue HMR Runtime interface
 * Provided by @vitejs/plugin-vue for hot module replacement
 */
interface VueHMRRuntime {
  /**
   * Create a record for a component
   */
  createRecord(id: string, component: VueComponent): boolean;
  
  /**
   * Reload a component (full reload)
   */
  reload(id: string, component: VueComponent): void;
  
  /**
   * Rerender a component (template only)
   */
  rerender(id: string, render: () => unknown): void;
}

/**
 * Global Vue HMR runtime
 * Injected by @vitejs/plugin-vue
 */
declare global {
  var __VUE_HMR_RUNTIME__: VueHMRRuntime | undefined;
}

/**
 * Vue-specific state snapshot
 * Extends base snapshot with Vue-specific reactive state
 */
interface VueStateSnapshot extends StateSnapshot {
  framework: 'vue';
  data: {
    /**
     * Vue reactive data
     * Captured from component instance
     */
    reactiveData?: Record<string, unknown>;
    
    /**
     * Component display name for debugging
     */
    componentName?: string;
    
    /**
     * Props at time of state capture
     */
    capturedProps?: Record<string, unknown>;
    
    /**
     * Computed properties values
     */
    computedValues?: Record<string, unknown>;
  };
}

/**
 * Vue HMR Adapter
 * 
 * Leverages Vue's HMR capabilities (provided by @vitejs/plugin-vue) to:
 * - Preserve reactive state across updates
 * - Maintain computed properties
 * - Handle component updates without full remount
 * 
 * Vue HMR works through the __VUE_HMR_RUNTIME__ API:
 * 1. When a component module is updated, Vite sends an HMR event
 * 2. We use __VUE_HMR_RUNTIME__.reload() to hot-reload the component
 * 3. Vue preserves reactive state automatically through its reactivity system
 * 4. The component re-renders with preserved state
 */
export class VueHMRAdapter extends BaseFrameworkAdapter {
  readonly name = 'vue';
  
  /**
   * Store Vue app instances for each island to enable proper updates
   */
  private apps: WeakMap<HTMLElement, VueApp> = new WeakMap();
  
  /**
   * Store component IDs for HMR runtime
   */
  private componentIds: WeakMap<HTMLElement, string> = new WeakMap();

  /**
   * Check if a component is a Vue component
   * 
   * Vue components can be:
   * - Component options objects (with setup, data, render, template, etc.)
   * - Setup functions (Composition API)
   * - SFC compiled components
   */
  canHandle(component: unknown): boolean {
    if (!component) return false;
    
    // Check if it's a function (setup function or render function)
    if (typeof component === 'function') {
      // Vue setup functions or render functions
      return true;
    }
    
    // Check if it's a component options object
    if (component == null || typeof component !== 'object') {
      return false;
    }

    const obj = component as Record<string, unknown>;
    
    // Check for Vue-specific properties
    const hasVueProperties = 
      'setup' in obj ||
      'data' in obj ||
      'render' in obj ||
      'template' in obj ||
      'props' in obj ||
      'computed' in obj ||
      'methods' in obj ||
      'components' in obj ||
      'emits' in obj ||
      // Lifecycle hooks
      'mounted' in obj ||
      'created' in obj ||
      'beforeMount' in obj ||
      'beforeCreate' in obj;
    
    if (hasVueProperties) {
      return true;
    }
    
    // Check for __vccOpts (Vue SFC compiled component marker)
    if ('__vccOpts' in obj) {
      return true;
    }
    
    return false;
  }

  /**
   * Preserve Vue component state before HMR update
   * 
   * Vue's reactivity system handles most state preservation automatically.
   * We capture additional DOM state and props for fallback.
   */
  override preserveState(island: HTMLElement): VueStateSnapshot | null {
    try {
      // Get base DOM state
      const baseSnapshot = super.preserveState(island);
      if (!baseSnapshot) return null;

      // Get Vue-specific data
      const propsAttr = island.getAttribute('data-props');
      const capturedProps = propsAttr ? JSON.parse(propsAttr) : {};
      
      // Try to get component name from the island
      const src = island.getAttribute('data-src') || '';
      const componentName = this.extractComponentName(src);

      // Try to capture reactive data from the Vue instance
      // Note: This is best-effort, as Vue's internal state is not easily accessible
      // Vue's HMR runtime will handle most state preservation automatically
      const reactiveData = this.captureReactiveData(island);

      const vueSnapshot: VueStateSnapshot = {
        ...baseSnapshot,
        framework: 'vue',
        data: {
          componentName,
          capturedProps,
          reactiveData,
        },
      };

      return vueSnapshot;
    } catch (error) {
      console.warn('Failed to preserve Vue state:', error);
      return null;
    }
  }

  /**
   * Update Vue component with HMR
   * 
   * This method integrates with Vue's HMR API:
   * 1. Vue HMR is automatically enabled by @vitejs/plugin-vue
   * 2. When a module updates, Vite sends an HMR event
   * 3. We use __VUE_HMR_RUNTIME__ to reload the component
   * 4. Vue preserves reactive state automatically
   * 5. The component re-renders with preserved state
   */
  async update(
    island: HTMLElement,
    newComponent: unknown,
    props: Record<string, unknown>
  ): Promise<void> {
    if (!this.canHandle(newComponent)) {
      throw new Error('Component is not a valid Vue component');
    }

    const Component = newComponent as VueComponent;

    try {
      // Dynamically import Vue at runtime
      // This is resolved by Vite in the browser
      const vueModule = await import('vue') as VueModule;
      const { createApp } = vueModule;

      // Check if we have an existing app
      const existingApp = this.apps.get(island);
      const componentId = this.componentIds.get(island);

      // Try to use Vue HMR runtime if available
      const hmrRuntime = globalThis.__VUE_HMR_RUNTIME__;
      
      if (hmrRuntime && componentId) {
        // Use Vue's HMR runtime for hot reload
        // This preserves reactive state automatically
        try {
          hmrRuntime.reload(componentId, Component);
          
          // If we have an existing app, we're done
          // Vue HMR runtime handles the update
          if (existingApp) {
            return;
          }
        } catch (error) {
          console.warn('Vue HMR runtime reload failed, falling back to full remount:', error);
        }
      }

      if (existingApp) {
        // Unmount existing app
        try {
          existingApp.unmount();
        } catch (error) {
          console.warn('Failed to unmount existing Vue app:', error);
        }
      }

      // Create new app and mount
      const app = createApp(Component, props);
      
      // Configure error handling
      app.config.errorHandler = (err: Error, _instance: unknown, info: string) => {
        console.error('Vue component error during HMR:', err, info);
      };
      
      // Mount with hydration
      app.mount(island, true);
      
      // Store app and component ID for future updates
      this.apps.set(island, app);
      
      // Generate component ID for HMR runtime
      const src = island.getAttribute('data-src') || '';
      const newComponentId = this.generateComponentId(src);
      this.componentIds.set(island, newComponentId);
      
      // Register with HMR runtime if available
      if (hmrRuntime) {
        hmrRuntime.createRecord(newComponentId, Component);
      }

      // Mark as hydrated
      island.setAttribute('data-hydrated', 'true');
      island.setAttribute('data-hydration-status', 'success');
      
    } catch (error) {
      console.error('Vue HMR update failed:', error);
      island.setAttribute('data-hydration-status', 'error');
      throw error;
    }
  }

  /**
   * Restore Vue component state after HMR update
   * 
   * Vue's reactivity system handles most state restoration automatically.
   * We restore DOM state (scroll, focus, form values) as a supplement.
   */
  override restoreState(island: HTMLElement, state: StateSnapshot): void {
    try {
      // Restore DOM state (scroll, focus, form values)
      super.restoreState(island, state);
      
      // Vue's reactivity system handles reactive state restoration automatically
      // through the HMR runtime, so we don't need to do anything special here
      
    } catch (error) {
      console.warn('Failed to restore Vue state:', error);
    }
  }

  /**
   * Handle errors during Vue HMR update
   * 
   * Provides Vue-specific error handling with helpful messages
   */
  override handleError(island: HTMLElement, error: Error): void {
    console.error('Vue HMR error:', error);
    
    // Use base error handling
    super.handleError(island, error);
    
    // Add Vue-specific error information
    const errorIndicator = island.querySelector('.hmr-error-indicator');
    if (errorIndicator) {
      const errorMessage = error.message;
      
      // Provide helpful hints for common Vue errors
      let hint = '';
      if (errorMessage.includes('reactive') || errorMessage.includes('ref')) {
        hint = ' (Hint: Check reactive state usage - refs must be accessed with .value)';
      } else if (errorMessage.includes('render')) {
        hint = ' (Hint: Check component render function or template for errors)';
      } else if (errorMessage.includes('hydration') || errorMessage.includes('mismatch')) {
        hint = ' (Hint: Server and client render must match)';
      } else if (errorMessage.includes('setup')) {
        hint = ' (Hint: Check setup function - it should return render function or object)';
      }
      
      errorIndicator.textContent = `Vue HMR Error: ${errorMessage}${hint}`;
    }
  }

  /**
   * Extract component name from source path
   * Used for debugging and error messages
   */
  private extractComponentName(src: string): string {
    const parts = src.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.(vue|tsx?|jsx?)$/, '');
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
   * Attempt to capture reactive data from Vue instance
   * This is best-effort and may not work in all cases
   */
  private captureReactiveData(island: HTMLElement): Record<string, unknown> | undefined {
    try {
      // Vue 3 stores instance data on the element's __vueParentComponent
      // This is internal API and may change, so we wrap in try-catch
      const vueInstance = (island as unknown as { __vueParentComponent?: unknown }).__vueParentComponent;
      
      if (vueInstance && typeof vueInstance === 'object') {
        // Try to extract data from the instance
        // This is very fragile and depends on Vue internals
        const data = (vueInstance as { data?: Record<string, unknown> }).data;
        if (data && typeof data === 'object') {
          return { ...data };
        }
      }
    } catch (error) {
      // Silently fail - this is best-effort
      console.debug('Could not capture Vue reactive data:', error);
    }
    
    return undefined;
  }

  /**
   * Clean up Vue app when island is removed
   * This should be called when an island is unmounted
   */
  unmount(island: HTMLElement): void {
    const app = this.apps.get(island);
    if (app) {
      try {
        app.unmount();
        this.apps.delete(island);
        this.componentIds.delete(island);
      } catch (error) {
        console.warn('Failed to unmount Vue app:', error);
      }
    }
  }
}

/**
 * Create and export a singleton instance of the Vue HMR adapter
 */
export const vueAdapter = new VueHMRAdapter();
