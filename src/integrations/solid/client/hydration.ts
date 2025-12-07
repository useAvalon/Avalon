/**
 * Solid client-side hydration
 * Handles hydration of server-rendered Solid components
 * 
 *  uses hydrate() for SSR content, render() for client-only
 */

import type { SolidComponent, SolidHydrationOptions } from "../types.ts";

/**
 * Hydrate a server-rendered Solid component
 * 
 *  checks for SSR content and uses hydrate() or render() accordingly.
 * 
 * @param container - DOM element containing the server-rendered HTML
 * @param Component - Solid component to hydrate
 * @param props - Component props
 * @param _options - Hydration options (unused)
 */
export function hydrate(
  container: Element,
  Component: SolidComponent,
  props: Record<string, unknown> = {},
  _options: SolidHydrationOptions = {}
): void {
  try {
    // Validate inputs
    if (!container) {
      throw new Error("Container element is required for hydration");
    }
    
    if (!Component || typeof Component !== "function") {
      throw new Error(`Invalid Solid component: expected function, got ${typeof Component}`);
    }
    
    //  check element.hasAttribute('ssr') and use element.dataset.solidRenderId
    const element = container as HTMLElement;
    const hasSSRContent = element.children.length > 0;
    const isHydrate = hasSSRContent; //  const isHydrate = client !== 'only'
    
    // Get renderId from dataset ( element.dataset.solidRenderId)
    const renderId = element.dataset.solidRenderId || element.dataset.renderId;
    
    // Import Solid's functions ( imports createComponent, hydrate, render, Suspense)
    Promise.all([
      import("solid-js/web"),
      import("solid-js")
    ]).then(([solidWeb, _solidJs]) => {
      const { hydrate: solidHydrate, render: solidRender, createComponent } = solidWeb;
      
      try {
        //  const bootstrap = isHydrate ? hydrate : render
        const bootstrap = isHydrate ? solidHydrate : solidRender;
        
        // Don't wrap in Suspense - it changes the structure and causes hydration mismatch
        // Just hydrate the component directly
        bootstrap(
          () => createComponent(Component, props),
          element,
          {
            renderId,
          }
        );
      } catch (error) {
        // Graceful degradation - component remains as static HTML
        container.setAttribute('data-hydration-status', 'failed');
        const errorMsg = error instanceof Error ? error.message : String(error);
        container.setAttribute('data-hydration-error', errorMsg);
        // Only log in dev
        if (typeof Deno !== 'undefined' && Deno.env.get("DENO_ENV") !== "production") {
          console.error(`Solid hydration failed:`, error);
        }
      }
    }).catch((importError) => {
      container.setAttribute('data-hydration-status', 'failed');
      container.setAttribute('data-hydration-error', 'Failed to load Solid hydration module');
      // Only log in dev
      if (typeof Deno !== 'undefined' && Deno.env.get("DENO_ENV") !== "production") {
        console.error(`Failed to import solid-js/web:`, importError);
      }
    });
  } catch (error) {
    // Don't throw - graceful degradation per Requirement 11
    container.setAttribute('data-hydration-status', 'failed');
    const errorMsg = error instanceof Error ? error.message : String(error);
    container.setAttribute('data-hydration-error', errorMsg);
    // Only log in dev
    if (typeof Deno !== 'undefined' && Deno.env.get("DENO_ENV") !== "production") {
      console.error(`Solid hydration setup failed:`, error);
    }
  }
}

/**
 * Get the hydration script for Solid components
 * This script is injected into the page to enable client-side hydration
 * 
 * @returns Hydration script as string
 */
export function getHydrationScript(): string {
  return `
    // Solid hydration script
    (async function() {
      // Find all Solid islands
      const islands = document.querySelectorAll('[data-framework="solid"]');
      
      console.log(\`Found \${islands.length} Solid island(s) to hydrate\`);
      
      for (const island of islands) {
        try {
          const src = island.getAttribute('data-src');
          const propsJson = island.getAttribute('data-props');
          const condition = island.getAttribute('data-condition') || 'on:client';
          
          if (!src) {
            console.warn('Solid island missing data-src attribute:', island);
            continue;
          }
          
          // Parse props
          let props = {};
          if (propsJson) {
            try {
              props = JSON.parse(propsJson);
            } catch (e) {
              console.error('Failed to parse Solid island props:', e);
            }
          }
          
          // Check hydration condition
          if (!shouldHydrate(island, condition)) {
            console.log(\`Skipping hydration for \${src} (condition: \${condition})\`);
            continue;
          }
          
          // Dynamic import of integration client code
          const { hydrate } = await import('@avalon/integration-solid/client');
          
          // Dynamic import of component
          const module = await import(src);
          const Component = module.default || module;
          
          // Hydrate the component
          hydrate(island, Component, props);
          
          console.log(\`✅ Hydrated Solid island: \${src}\`);
        } catch (error) {
          console.error('Failed to hydrate Solid island:', error);
        }
      }
    })();
    
    function shouldHydrate(element, condition) {
      if (!condition || condition === 'on:client') {
        return true;
      }
      
      if (condition === 'on:visible') {
        // Use Intersection Observer for lazy hydration
        return new Promise(resolve => {
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
        // Hydrate on first user interaction
        return new Promise(resolve => {
          const events = ['click', 'mouseenter', 'touchstart', 'focus'];
          const handler = () => {
            events.forEach(e => element.removeEventListener(e, handler));
            resolve(true);
          };
          events.forEach(e => element.addEventListener(e, handler, { once: true }));
        });
      }
      
      if (condition === 'on:idle') {
        // Hydrate when browser is idle
        return new Promise(resolve => {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => resolve(true));
          } else {
            setTimeout(() => resolve(true), 200);
          }
        });
      }
      
      if (condition.startsWith('media:')) {
        // Hydrate based on media query
        const query = condition.slice(6);
        return window.matchMedia(query).matches;
      }
      
      return true;
    }
  `;
}
