/**
 * React HMR Adapter
 * 
 * Provides Hot Module Replacement support for React components using React Fast Refresh.
 * Integrates with @vitejs/plugin-react to preserve hooks state and component tree during updates.
 * 
 * Requirements: 2.1
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '../framework-adapter.ts';

/**
 * React component type
 * Can be a function component or class component
 */
type ReactComponent<P = Record<string, unknown>> = 
  | ((props: P) => ReactElement | null)
  | (new (props: P) => ReactClassComponent);

/**
 * React class component interface
 */
interface ReactClassComponent {
  render(): ReactElement | null;
  isReactComponent?: boolean;
}

/**
 * React element type
 */
interface ReactElement {
  type: string | ReactComponent;
  props: Record<string, unknown>;
  key: string | number | null;
}

/**
 * React Root type from react-dom/client
 */
interface ReactRoot {
  render(element: ReactElement | null): void;
  unmount(): void;
}

/**
 * React module interface
 */
interface ReactModule {
  createElement<P = Record<string, unknown>>(
    component: ReactComponent<P>,
    props: P | null,
    ...children: unknown[]
  ): ReactElement;
}

/**
 * ReactDOM client module interface
 */
interface ReactDOMClientModule {
  hydrateRoot(
    container: HTMLElement,
    element: ReactElement,
    options?: {
      onRecoverableError?: (error: Error) => void;
    }
  ): ReactRoot;
}

/**
 * React-specific state snapshot
 * Extends base snapshot with React-specific state like hooks
 */
interface ReactStateSnapshot extends StateSnapshot {
  framework: 'react';
  data: {
    /**
     * React Fiber tree data (if accessible)
     * Used by React Fast Refresh to preserve hooks state
     */
    fiberData?: unknown;
    
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
 * React HMR Adapter
 * 
 * Leverages React Fast Refresh (provided by @vitejs/plugin-react) to:
 * - Preserve hooks state across updates
 * - Maintain component tree structure
 * - Handle component updates without full remount
 * 
 * React Fast Refresh works by:
 * 1. Detecting when a component module is updated
 * 2. Preserving the React Fiber tree (internal state representation)
 * 3. Re-rendering with the new component definition
 * 4. Restoring hooks state from the preserved Fiber tree
 */
export class ReactHMRAdapter extends BaseFrameworkAdapter {
  readonly name = 'react';
  
  /**
   * Store React roots for each island to enable proper updates
   */
  private roots: WeakMap<HTMLElement, ReactRoot> = new WeakMap();

  /**
   * Check if a component is a React component
   * 
   * React components can be:
   * - Function components (including hooks)
   * - Class components (extending React.Component)
   * - Forward refs
   * - Memoized components
   */
  canHandle(component: unknown): boolean {
    if (!component) return false;
    
    // Check if it's a function (function component or class)
    if (typeof component === 'function') {
      // Check for React-specific properties on the function
      // Use unknown first to avoid type errors
      const comp = component as unknown as Record<string, unknown>;
      
      // Class components have isReactComponent on prototype
      const proto = (component as { prototype?: Record<string, unknown> }).prototype;
      if (proto && proto.isReactComponent) {
        return true;
      }
      
      // Check for React element symbol (for wrapped components)
      if (comp.$$typeof) {
        return true;
      }
      
      // Assume any function could be a React component
      // React Fast Refresh will handle validation
      return true;
    }
    
    // Check for React element types
    if (typeof component === 'object' && component !== null) {
      const obj = component as Record<string, unknown>;
      
      // Check for React element symbol
      if (obj.$$typeof) {
        return true;
      }
      
      // Check for wrapped components (HOCs, memo, forwardRef)
      if (obj.type && typeof obj.type === 'function') {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Preserve React component state before HMR update
   * 
   * React Fast Refresh handles most state preservation automatically through
   * the React Fiber tree. We capture additional DOM state and props for fallback.
   */
  override preserveState(island: HTMLElement): ReactStateSnapshot | null {
    try {
      // Get base DOM state
      const baseSnapshot = super.preserveState(island);
      if (!baseSnapshot) return null;

      // Get React-specific data
      const propsAttr = island.getAttribute('data-props');
      const capturedProps = propsAttr ? JSON.parse(propsAttr) : {};
      
      // Try to get component name from the island
      const src = island.getAttribute('data-src') || '';
      const componentName = this.extractComponentName(src);

      const reactSnapshot: ReactStateSnapshot = {
        ...baseSnapshot,
        framework: 'react',
        data: {
          componentName,
          capturedProps,
        },
      };

      return reactSnapshot;
    } catch (error) {
      console.warn('Failed to preserve React state:', error);
      return null;
    }
  }

  /**
   * Update React component with HMR
   * 
   * This method integrates with React Fast Refresh:
   * 1. React Fast Refresh is automatically enabled by @vitejs/plugin-react
   * 2. When a module updates, Vite sends an HMR event
   * 3. We re-hydrate the component with the new definition
   * 4. React Fast Refresh preserves hooks state automatically
   * 5. The component re-renders with preserved state
   */
  async update(
    island: HTMLElement,
    newComponent: unknown,
    props: Record<string, unknown>
  ): Promise<void> {
    if (!this.canHandle(newComponent)) {
      throw new Error('Component is not a valid React component');
    }

    const Component = newComponent as ReactComponent;

    try {
      // Dynamically import React and ReactDOM at runtime
      // These are resolved by Vite in the browser
      const [reactModule, reactDOMModule] = await Promise.all([
        import('react') as Promise<ReactModule>,
        import('react-dom/client') as Promise<ReactDOMClientModule>,
      ]);

      const { createElement } = reactModule;
      const { hydrateRoot } = reactDOMModule;

      // Check if we have an existing root
      const existingRoot = this.roots.get(island);

      if (existingRoot) {
        // Update existing root with new component
        // React Fast Refresh will preserve hooks state automatically
        const element = createElement(Component, props);
        existingRoot.render(element);
      } else {
        // Create new root and hydrate
        // This happens on first HMR update or if root was lost
        const element = createElement(Component, props);
        const newRoot = hydrateRoot(island, element, {
          onRecoverableError: (error: Error) => {
            console.warn('React hydration recoverable error during HMR:', error);
          },
        });
        
        // Store root for future updates
        this.roots.set(island, newRoot);
      }

      // Mark as hydrated
      island.setAttribute('data-hydrated', 'true');
      island.setAttribute('data-hydration-status', 'success');
      
    } catch (error) {
      console.error('React HMR update failed:', error);
      island.setAttribute('data-hydration-status', 'error');
      throw error;
    }
  }

  /**
   * Restore React component state after HMR update
   * 
   * React Fast Refresh handles most state restoration automatically.
   * We restore DOM state (scroll, focus, form values) as a supplement.
   */
  override restoreState(island: HTMLElement, state: StateSnapshot): void {
    try {
      // Restore DOM state (scroll, focus, form values)
      super.restoreState(island, state);
      
      // React Fast Refresh handles hooks state restoration automatically
      // through the React Fiber tree, so we don't need to do anything special here
      
    } catch (error) {
      console.warn('Failed to restore React state:', error);
    }
  }

  /**
   * Handle errors during React HMR update
   * 
   * Provides React-specific error handling with helpful messages
   */
  override handleError(island: HTMLElement, error: Error): void {
    console.error('React HMR error:', error);
    
    // Use base error handling
    super.handleError(island, error);
    
    // Add React-specific error information
    const errorIndicator = island.querySelector('.hmr-error-indicator');
    if (errorIndicator) {
      const errorMessage = error.message;
      
      // Provide helpful hints for common React errors
      let hint = '';
      if (errorMessage.includes('hooks')) {
        hint = ' (Hint: Check hooks usage - hooks must be called in the same order)';
      } else if (errorMessage.includes('render')) {
        hint = ' (Hint: Check component render method for errors)';
      } else if (errorMessage.includes('hydration')) {
        hint = ' (Hint: Server and client render must match)';
      }
      
      errorIndicator.textContent = `React HMR Error: ${errorMessage}${hint}`;
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
   * Clean up React root when island is removed
   * This should be called when an island is unmounted
   */
  unmount(island: HTMLElement): void {
    const root = this.roots.get(island);
    if (root) {
      try {
        root.unmount();
        this.roots.delete(island);
      } catch (error) {
        console.warn('Failed to unmount React root:', error);
      }
    }
  }
}

/**
 * Create and export a singleton instance of the React HMR adapter
 */
export const reactAdapter = new ReactHMRAdapter();

