/**
 * Declarative Shadow DOM Polyfill for Lit
 * 
 * Processes <template shadowrootmode> elements for older browsers.
 * Modern browsers support this natively.
 */

/// <reference lib="dom" />

function processDeclarativeShadowDOM(): void {
  if (typeof window === 'undefined' || typeof HTMLTemplateElement === 'undefined') {
    return;
  }
  
  // Skip if browser supports declarative shadow DOM natively
  if (HTMLTemplateElement.prototype.hasOwnProperty('shadowRootMode')) {
    return;
  }
  
  const templates = document.querySelectorAll('template[shadowrootmode]');
  
  templates.forEach((template) => {
    const parent = template.parentElement;
    if (!parent || parent.shadowRoot) return;
    
    const mode = template.getAttribute('shadowrootmode') as 'open' | 'closed';
    try {
      const shadowRoot = parent.attachShadow({ mode: mode || 'open' });
      shadowRoot.appendChild(template.content.cloneNode(true));
      template.remove();
    } catch {
      // Silently fail - element may not support shadow DOM
    }
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processDeclarativeShadowDOM, { once: true });
  } else {
    processDeclarativeShadowDOM();
  }
}

export const DECLARATIVE_SHADOW_DOM_POLYFILL_LOADED = true;
