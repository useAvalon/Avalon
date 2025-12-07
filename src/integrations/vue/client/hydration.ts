/**
 * Vue Client Hydration
 * 
 * Provides client-side hydration for Vue components.
 * Attaches interactivity to server-rendered Vue components.
 */

import { createApp } from "vue";

/**
 * Hydrate a Vue component on the client
 * 
 * Creates a Vue app instance and mounts it to the container element,
 * hydrating the server-rendered HTML.
 * 
 * @param container - DOM element containing server-rendered HTML
 * @param component - Vue component to hydrate
 * @param props - Component props
 */
export function hydrate(
  container: Element,
  component: unknown,
  props: Record<string, unknown> = {},
): void {
  try {
    // Create Vue app with the component and props
    const app = createApp(component as any, props);
    
    // Mount and hydrate
    app.mount(container, true);
  } catch (error) {
    console.error("Vue hydration failed:", error);
    throw error;
  }
}

/**
 * Get the hydration script for Vue islands
 * 
 * Returns a script that will be injected into the page to handle
 * automatic hydration of Vue islands based on their conditions.
 * 
 * @returns Hydration script as a string
 */
export function getHydrationScript(): string {
  return `
    import { createApp } from 'vue';
    
    // Auto-hydrate all Vue islands
    document.querySelectorAll('[data-framework="vue"]').forEach(async (el) => {
      const src = el.getAttribute('data-src');
      const propsJson = el.getAttribute('data-props') || '{}';
      const condition = el.getAttribute('data-condition') || 'on:client';
      
      // Check hydration condition
      if (!shouldHydrate(el, condition)) {
        return;
      }
      
      try {
        // Dynamic import the component
        const module = await import(src);
        const Component = module.default || module;
        
        // Parse props
        const props = JSON.parse(propsJson);
        
        // Create and mount Vue app
        const app = createApp(Component, props);
        app.mount(el, true);
      } catch (error) {
        console.error('Failed to hydrate Vue island:', error);
      }
    });
    
    function shouldHydrate(element, condition) {
      if (!condition || condition === 'on:client') {
        return true;
      }
      
      if (condition === 'on:visible') {
        return new Promise((resolve) => {
          const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
              observer.disconnect();
              resolve(true);
            }
          });
          observer.observe(element);
        });
      }
      
      if (condition === 'on:interaction') {
        return new Promise((resolve) => {
          const events = ['click', 'mouseenter', 'focusin', 'touchstart'];
          const handler = () => {
            events.forEach(e => element.removeEventListener(e, handler));
            resolve(true);
          };
          events.forEach(e => element.addEventListener(e, handler, { once: true }));
        });
      }
      
      if (condition === 'on:idle') {
        return new Promise((resolve) => {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => resolve(true));
          } else {
            setTimeout(() => resolve(true), 200);
          }
        });
      }
      
      if (condition.startsWith('media:')) {
        const query = condition.slice(6);
        return window.matchMedia(query).matches;
      }
      
      return true;
    }
  `;
}
