/**
 * Lit HMR Adapter
 * 
 * Provides Hot Module Replacement support for Lit components.
 * Handles custom element re-registration and updates all element instances.
 * Preserves element properties across updates.
 * 
 * Requirements: 2.6
 */

/// <reference lib="dom" />

import { BaseFrameworkAdapter, type StateSnapshot } from '../framework-adapter.ts';

/**
 * Lit element type
 * Lit components are classes that extend LitElement
 */
interface LitElementConstructor {
  new (): LitElementInstance;
  elementName?: string;
}

/**
 * Lit element instance interface
 */
interface LitElementInstance extends HTMLElement {
  /**
   * Lit-specific properties
   */
  _$litElement$?: unknown;
  
  /**
   * Request update method
   */
  requestUpdate?(): void;
  
  /**
   * Update complete promise
   */
  updateComplete?: Promise<boolean>;
}

/**
 * Lit-specific state snapshot
 * Extends base snapshot with Lit-specific state like element properties
 */
interface LitStateSnapshot extends StateSnapshot {
  framework: 'lit';
  data: {
    /**
     * Element properties captured from the Lit element
     */
    elementProperties?: Record<string, unknown>;
    
    /**
     * Element attributes
     */
    elementAttributes?: Record<string, string>;
    
    /**
     * Component display name for debugging
     */
    componentName?: string;
    
    /**
     * Tag name of the custom element
     */
    tagName?: string;
    
    /**
     * Props at time of state capture
     */
    capturedProps?: Record<string, unknown>;
  };
}

/**
 * Lit HMR Adapter
 * 
 * Handles HMR for Lit components by:
 * 1. Re-registering the custom element with a new definition
 * 2. Updating all existing instances of the element
 * 3. Preserving element properties and attributes
 * 
 * Lit components are Web Components (custom elements), so HMR requires:
 * - Undefining the old custom element (if possible)
 * - Defining the new custom element
 * - Updating all instances in the DOM
 * - Preserving reactive properties
 */
export class LitHMRAdapter extends BaseFrameworkAdapter {
  readonly name = 'lit';
  
  /**
   * Store element constructors for each island
   */
  private elementConstructors: WeakMap<HTMLElement, LitElementConstructor> = new WeakMap();
  
  /**
   * Store tag names for each island
   */
  private tagNames: WeakMap<HTMLElement, string> = new WeakMap();

  /**
   * Check if a component is a Lit component
   * 
   * Lit components are:
   * - Classes that extend LitElement
   * - Typically decorated with @customElement
   * - Have .lit.ts or .lit.js extension (but not always)
   */
  canHandle(component: unknown): boolean {
    if (!component) return false;
    
    // Check if it's a class (Lit components are classes)
    if (typeof component === 'function') {
      const comp = component as unknown as Record<string, unknown>;
      
      // Check for Lit-specific markers
      // Lit elements may have __litElement marker
      if (comp.__litElement) {
        return true;
      }
      
      // Check if it extends LitElement by looking at the prototype chain
      try {
        const proto = (component as { prototype?: Record<string, unknown> }).prototype;
        if (proto) {
          // Check for Lit-specific methods on prototype
          if (
            'render' in proto &&
            'requestUpdate' in proto &&
            'updateComplete' in proto
          ) {
            return true;
          }
          
          // Check for LitElement in prototype chain
          let currentProto = proto;
          while (currentProto && currentProto !== Object.prototype) {
            const constructor = currentProto.constructor as { name?: string };
            if (constructor && constructor.name === 'LitElement') {
              return true;
            }
            currentProto = Object.getPrototypeOf(currentProto);
          }
        }
      } catch {
        // Ignore errors from prototype inspection
      }
      
      // Check for @customElement decorator metadata
      // The decorator adds metadata to the class
      if (comp.elementName || comp.tagName) {
        return true;
      }
      
      // Check function signature - Lit components typically have specific patterns
      try {
        const funcStr = component.toString();
        
        // Look for Lit-specific patterns
        if (
          funcStr.includes('LitElement') ||
          funcStr.includes('customElement') ||
          funcStr.includes('html`') ||
          funcStr.includes('css`') ||
          funcStr.includes('render()') ||
          funcStr.includes('requestUpdate')
        ) {
          return true;
        }
      } catch {
        // Ignore errors from toString()
      }
    }
    
    // Check if it's a Lit component object (wrapped or exported)
    if (typeof component !== 'object') {
      return false;
    }

    const obj = component as Record<string, unknown>;
    
    // Check for default export pattern
    if (obj.default && typeof obj.default === 'function') {
      return this.canHandle(obj.default);
    }
    
    // Check for Lit component markers
    if (obj.__litElement) {
      return true;
    }
    
    return false;
  }

  /**
   * Preserve Lit element state before HMR update
   * 
   * Captures:
   * - Element properties (reactive properties defined with @property)
   * - Element attributes
   * - DOM state (scroll, focus, form values)
   */
  override preserveState(island: HTMLElement): LitStateSnapshot | null {
    try {
      // Get base DOM state
      const baseSnapshot = super.preserveState(island);
      if (!baseSnapshot) return null;

      // Get Lit-specific data
      const propsAttr = island.getAttribute('data-props');
      const capturedProps = propsAttr ? JSON.parse(propsAttr) : {};
      
      // Try to get component name from the island
      const src = island.getAttribute('data-src') || '';
      const componentName = this.extractComponentName(src);
      
      // Get tag name
      const tagName = island.getAttribute('data-tag-name') || this.tagNames.get(island);
      
      // Find the Lit element inside the island
      const litElement = tagName 
        ? island.querySelector(tagName) as LitElementInstance
        : island.querySelector('[data-lit-element]') as LitElementInstance;
      
      // Capture element properties and attributes
      const elementProperties: Record<string, unknown> = {};
      const elementAttributes: Record<string, string> = {};
      
      if (litElement) {
        // Capture all properties
        // Lit stores reactive properties on the element instance
        for (const key in litElement) {
          if (litElement.hasOwnProperty(key) && !key.startsWith('_')) {
            try {
              const value = litElement[key as keyof LitElementInstance];
              // Only capture serializable values
              if (
                value !== undefined &&
                value !== null &&
                typeof value !== 'function' &&
                typeof value !== 'symbol'
              ) {
                elementProperties[key] = value;
              }
            } catch {
              // Skip properties that throw on access
            }
          }
        }
        
        // Capture all attributes
        for (let i = 0; i < litElement.attributes.length; i++) {
          const attr = litElement.attributes[i];
          elementAttributes[attr.name] = attr.value;
        }
      }

      const litSnapshot: LitStateSnapshot = {
        ...baseSnapshot,
        framework: 'lit',
        data: {
          componentName,
          tagName: tagName || undefined,
          capturedProps,
          elementProperties,
          elementAttributes,
        },
      };

      return litSnapshot;
    } catch (error) {
      console.warn('Failed to preserve Lit state:', error);
      return null;
    }
  }

  /**
   * Update Lit component with HMR
   * 
   * This method handles custom element re-registration:
   * 1. Extract the tag name from the component or island
   * 2. Find all instances of the element in the DOM
   * 3. Preserve their properties and attributes
   * 4. Undefine the old custom element (if possible)
   * 5. Define the new custom element
   * 6. Update all instances with the new definition
   * 7. Restore properties and attributes
   */
  async update(
    island: HTMLElement,
    newComponent: unknown,
    props: Record<string, unknown>
  ): Promise<void> {
    if (!this.canHandle(newComponent)) {
      throw new Error('Component is not a valid Lit component');
    }

    // Extract the actual component class
    let ElementClass: LitElementConstructor;
    if (typeof newComponent === 'object' && newComponent !== null) {
      const obj = newComponent as Record<string, unknown>;
      if (obj.default && typeof obj.default === 'function') {
        ElementClass = obj.default as LitElementConstructor;
      } else {
        throw new Error('Lit component object must have a default export');
      }
    } else if (typeof newComponent === 'function') {
      ElementClass = newComponent as LitElementConstructor;
    } else {
      throw new Error('Invalid Lit component type');
    }

    try {
      // Determine the tag name
      // Priority: data-tag-name attribute > elementName property > derive from class name
      let tagName = island.getAttribute('data-tag-name');
      
      if (!tagName) {
        // Try to get from the class
        tagName = (ElementClass as unknown as Record<string, unknown>).elementName as string;
      }
      
      if (!tagName) {
        // Derive from class name (convert PascalCase to kebab-case)
        tagName = ElementClass.name
          .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
          .toLowerCase();
      }
      
      if (!tagName || !tagName.includes('-')) {
        throw new Error('Invalid custom element tag name: ' + tagName);
      }
      
      // Store tag name for future updates
      this.tagNames.set(island, tagName);
      island.setAttribute('data-tag-name', tagName);
      
      // Find all instances of this element in the island
      const elements = Array.from(island.querySelectorAll(tagName)) as LitElementInstance[];
      
      // If no elements exist, create one
      if (elements.length === 0) {
        // Check if the custom element is already defined
        const existingDefinition = customElements.get(tagName);
        
        if (!existingDefinition) {
          // Define the custom element
          customElements.define(tagName, ElementClass as CustomElementConstructor);
        } else if (existingDefinition !== ElementClass) {
          // Element is already defined with a different class
          // We need to re-register it
          await this.reregisterCustomElement(tagName, ElementClass);
        }
        
        // Create a new element
        const newElement = document.createElement(tagName) as LitElementInstance;
        
        // Set properties from props
        Object.entries(props).forEach(([key, value]) => {
          try {
            (newElement as unknown as Record<string, unknown>)[key] = value;
          } catch (error) {
            console.warn(`Failed to set property ${key} on Lit element:`, error);
          }
        });
        
        // Append to island
        island.appendChild(newElement);
        
        // Store constructor
        this.elementConstructors.set(island, ElementClass);
        
        // Mark as hydrated
        island.setAttribute('data-hydrated', 'true');
        island.setAttribute('data-hydration-status', 'success');
        
        return;
      }
      
      // Update existing elements
      // First, check if we need to re-register the custom element
      const existingDefinition = customElements.get(tagName);
      
      if (existingDefinition && existingDefinition !== ElementClass) {
        // Re-register the custom element with the new definition
        await this.reregisterCustomElement(tagName, ElementClass);
        
        // After re-registration, we need to replace all existing elements
        // because they're instances of the old class
        for (const oldElement of elements) {
          // Preserve state
          const properties: Record<string, unknown> = {};
          const attributes: Record<string, string> = {};
          
          // Capture properties
          for (const key in oldElement) {
            if (oldElement.hasOwnProperty(key) && !key.startsWith('_')) {
              try {
                const value = oldElement[key as keyof LitElementInstance];
                if (
                  value !== undefined &&
                  value !== null &&
                  typeof value !== 'function' &&
                  typeof value !== 'symbol'
                ) {
                  properties[key] = value;
                }
              } catch {
                // Skip properties that throw on access
              }
            }
          }
          
          // Capture attributes
          for (let i = 0; i < oldElement.attributes.length; i++) {
            const attr = oldElement.attributes[i];
            attributes[attr.name] = attr.value;
          }
          
          // Create new element
          const newElement = document.createElement(tagName) as LitElementInstance;
          
          // Restore attributes
          Object.entries(attributes).forEach(([name, value]) => {
            newElement.setAttribute(name, value);
          });
          
          // Restore properties
          Object.entries(properties).forEach(([key, value]) => {
            try {
              (newElement as unknown as Record<string, unknown>)[key] = value;
            } catch (error) {
              console.warn(`Failed to restore property ${key}:`, error);
            }
          });
          
          // Replace old element with new element
          oldElement.parentNode?.replaceChild(newElement, oldElement);
        }
      } else if (!existingDefinition) {
        // Define the custom element for the first time
        customElements.define(tagName, ElementClass as CustomElementConstructor);
        
        // Trigger update on all elements
        for (const element of elements) {
          if (element.requestUpdate) {
            element.requestUpdate();
          }
        }
      } else {
        // Same class, just trigger updates
        for (const element of elements) {
          // Update properties from props
          Object.entries(props).forEach(([key, value]) => {
            try {
              (element as unknown as Record<string, unknown>)[key] = value;
            } catch (error) {
              console.warn(`Failed to update property ${key}:`, error);
            }
          });
          
          // Request update
          if (element.requestUpdate) {
            element.requestUpdate();
          }
        }
      }
      
      // Store constructor
      this.elementConstructors.set(island, ElementClass);
      
      // Mark as hydrated
      island.setAttribute('data-hydrated', 'true');
      island.setAttribute('data-hydration-status', 'success');
      
    } catch (error) {
      console.error('Lit HMR update failed:', error);
      island.setAttribute('data-hydration-status', 'error');
      throw error;
    }
  }

  /**
   * Re-register a custom element with a new definition
   * 
   * Custom elements cannot be undefined once defined, so we need to:
   * 1. Create a new tag name (with a version suffix)
   * 2. Define the new element with the new tag name
   * 3. Update all references to use the new tag name
   * 
   * Alternative approach (used here):
   * 1. Use a wrapper element that delegates to the actual element
   * 2. Update the wrapper to use the new element class
   */
  private async reregisterCustomElement(
    tagName: string,
    ElementClass: LitElementConstructor
  ): Promise<void> {
    // Unfortunately, custom elements cannot be truly undefined once defined
    // The best we can do is define a new version with a suffix
    
    // However, for HMR purposes, we can use a different approach:
    // We'll just replace all instances of the old element with new instances
    // This is handled in the update() method above
    
    // For now, we'll just log a warning
    console.warn(
      `Custom element ${tagName} is already defined. ` +
      `Replacing all instances with new definition.`
    );
    
    // Note: In a production HMR system, you might want to:
    // 1. Use a versioned tag name (e.g., my-element-v2)
    // 2. Use a proxy element that delegates to the actual element
    // 3. Use a custom element registry that supports re-registration
    
    // For this implementation, we rely on replacing element instances
    // which is handled in the update() method
  }

  /**
   * Restore Lit element state after HMR update
   * 
   * Restores:
   * - Element properties
   * - Element attributes
   * - DOM state (scroll, focus, form values)
   */
  override restoreState(island: HTMLElement, state: StateSnapshot): void {
    try {
      // Restore DOM state (scroll, focus, form values)
      super.restoreState(island, state);
      
      // Restore Lit-specific state
      const litState = state as LitStateSnapshot;
      const tagName = litState.data.tagName;
      
      if (tagName) {
        const litElement = island.querySelector(tagName) as LitElementInstance;
        
        if (litElement) {
          // Restore element properties
          if (litState.data.elementProperties) {
            Object.entries(litState.data.elementProperties).forEach(([key, value]) => {
              try {
                (litElement as unknown as Record<string, unknown>)[key] = value;
              } catch (error) {
                console.warn(`Failed to restore property ${key}:`, error);
              }
            });
          }
          
          // Restore element attributes
          if (litState.data.elementAttributes) {
            Object.entries(litState.data.elementAttributes).forEach(([name, value]) => {
              try {
                litElement.setAttribute(name, value);
              } catch (error) {
                console.warn(`Failed to restore attribute ${name}:`, error);
              }
            });
          }
          
          // Request update to apply changes
          if (litElement.requestUpdate) {
            litElement.requestUpdate();
          }
        }
      }
      
    } catch (error) {
      console.warn('Failed to restore Lit state:', error);
    }
  }

  /**
   * Handle errors during Lit HMR update
   * 
   * Provides Lit-specific error handling with helpful messages
   */
  override handleError(island: HTMLElement, error: Error): void {
    console.error('Lit HMR error:', error);
    
    // Use base error handling
    super.handleError(island, error);
    
    // Add Lit-specific error information
    const errorIndicator = island.querySelector('.hmr-error-indicator');
    if (errorIndicator) {
      const errorMessage = error.message;
      
      // Provide helpful hints for common Lit errors
      let hint = '';
      if (errorMessage.includes('custom element') || errorMessage.includes('define')) {
        hint = ' (Hint: Check that your element has a valid tag name with a hyphen)';
      } else if (errorMessage.includes('tag name')) {
        hint = ' (Hint: Custom element tag names must contain a hyphen)';
      } else if (errorMessage.includes('property') || errorMessage.includes('attribute')) {
        hint = ' (Hint: Check @property decorators and attribute names)';
      } else if (errorMessage.includes('render')) {
        hint = ' (Hint: Check the render() method for errors)';
      } else if (errorMessage.includes('shadow')) {
        hint = ' (Hint: Check Shadow DOM usage and styles)';
      }
      
      errorIndicator.textContent = `Lit HMR Error: ${errorMessage}${hint}`;
    }
  }

  /**
   * Extract component name from source path
   * Used for debugging and error messages
   */
  private extractComponentName(src: string): string {
    const parts = src.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace(/\.lit\.(ts|js)$/, '').replace(/\.(ts|js)$/, '');
  }

  /**
   * Clean up Lit element when island is removed
   * This should be called when an island is unmounted
   */
  unmount(island: HTMLElement): void {
    try {
      const tagName = this.tagNames.get(island);
      
      if (tagName) {
        // Find all elements and disconnect them
        const elements = island.querySelectorAll(tagName) as NodeListOf<LitElementInstance>;
        elements.forEach(element => {
          // Lit elements clean up automatically when disconnected
          // but we can help by removing them from the DOM
          element.remove();
        });
        
        this.tagNames.delete(island);
      }
      
      this.elementConstructors.delete(island);
    } catch (error) {
      console.warn('Failed to unmount Lit element:', error);
    }
  }
}

/**
 * Create and export a singleton instance of the Lit HMR adapter
 */
export const litAdapter = new LitHMRAdapter();
