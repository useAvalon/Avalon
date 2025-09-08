const CLIENT_SCRIPT = `
class Island extends HTMLElement {
  static observedAttributes = ['data-island'];
  
  constructor() {
    super();
    this._hydrated = false;
    this._intersectionObserver = null;
    this._boundHandleInteraction = this._handleInteraction.bind(this);
  }

  connectedCallback() {
    const condition = this.getAttribute('data-island');
    
    if (condition === 'on:visible') {
      this._setupVisibilityTrigger();
    } else if (condition === 'on:interaction') {
      this._setupInteractionTrigger();
    } else if (condition === 'on:idle') {
      this._setupIdleTrigger();
    } else if (condition === 'on:client') {
      // Client-only: hydrate immediately on the client
      this.hydrate();
    } else if (condition && condition.startsWith('media:')) {
      this._setupMediaTrigger(condition.slice(6)); // Remove 'media:' prefix
    } else {
      // Default behavior: hydrate immediately
      this.hydrate();
    }
  }

  _setupVisibilityTrigger() {
    this._intersectionObserver = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (entry.isIntersecting && !this._hydrated) {
        this.hydrate();
        // Keep the observer active but mark as hydrated to prevent re-hydration
        this._hydrated = true;
      }
    }, {
      threshold: 0,
      rootMargin: '100px'
    });
    this._intersectionObserver.observe(this);
  }

  _setupInteractionTrigger() {
    // Add interaction listeners to the island itself
    ['click', 'touchstart', 'mouseover'].forEach(eventType => {
      this.addEventListener(eventType, this._boundHandleInteraction, { once: true });
    });
  }

  _setupIdleTrigger() {
    // Use requestIdleCallback if available, otherwise setTimeout
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => this.hydrate());
    } else {
      setTimeout(() => this.hydrate(), 200);
    }
  }

  _setupMediaTrigger(mediaQuery) {
    const mediaQueryList = window.matchMedia(mediaQuery);
    
    // Check if it matches immediately
    if (mediaQueryList.matches) {
      this.hydrate();
      return;
    }
    
    // Listen for changes
    const handleMediaChange = (event) => {
      if (event.matches) {
        this.hydrate();
        mediaQueryList.removeEventListener('change', handleMediaChange);
      }
    };
    
    mediaQueryList.addEventListener('change', handleMediaChange);
    
    // Store reference for cleanup
    this._mediaQueryList = mediaQueryList;
    this._mediaChangeHandler = handleMediaChange;
  }

  _handleInteraction(event) {
    // Stop propagation to prevent double triggers
    event.stopPropagation();
    
    // Remove all interaction listeners
    ['click', 'touchstart', 'mouseover'].forEach(eventType => {
      this.removeEventListener(eventType, this._boundHandleInteraction);
    });

    // Hydrate the component
    this.hydrate();
  }

  disconnectedCallback() {
    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver = null;
    }
    
    if (this._mediaQueryList && this._mediaChangeHandler) {
      this._mediaQueryList.removeEventListener('change', this._mediaChangeHandler);
      this._mediaQueryList = null;
      this._mediaChangeHandler = null;
    }
    
    // Clean up any remaining interaction listeners
    ['click', 'touchstart', 'mouseover'].forEach(eventType => {
      this.removeEventListener(eventType, this._boundHandleInteraction);
    });
  }

  hydrate() {
    if (this._hydrated) return;
    this._hydrated = true;

    const template = this.querySelector('template[data-island]');
    if (template) {
      const content = template.content.cloneNode(true);
      
      // Execute scripts after adding content
      requestAnimationFrame(() => {
        this.appendChild(content);
        const scripts = Array.from(this.querySelectorAll('script'));
        scripts.forEach(script => {
          const newScript = document.createElement('script');
          Array.from(script.attributes).forEach(attr => {
            newScript.setAttribute(attr.name, attr.value);
          });
          newScript.textContent = script.textContent;
          script.parentNode.replaceChild(newScript, script);
        });
      });
    } else {
      console.warn('No template found for island:', this.id || 'unknown');
    }
  }
}

customElements.define('is-land', Island);
`;

export const injectClientScript = () => `
  if (!customElements.get('is-land')) {
    ${CLIENT_SCRIPT}
  }
`;
