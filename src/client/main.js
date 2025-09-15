// Main client entry point for Vite
// Custom element-based island hydration system

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

  async hydrate() {
    if (this._hydrated) return;
    this._hydrated = true;

    // Always use the fallback hydration system since we're keeping compatibility
    const src = this.getAttribute('data-hydrate');
    const propsAttr = this.getAttribute('data-props');
    const framework = this.getAttribute('data-framework');

    if (!src) {
      console.warn('Island missing data-hydrate attribute:', this.id || 'unknown');
      return;
    }

    try {
      // Parse props
      const props = propsAttr ? JSON.parse(propsAttr) : {};

      // Dynamic import the island module
      const module = await import(src);

      // Call the hydrate function if it exists
      if (module.hydrate) {
        console.log(\`🏝️ Hydrating \${framework || 'unknown'} island \${src}\`);
        module.hydrate(this, props);
      } else {
        console.warn(\`Island \${src} does not export a hydrate function\`);
      }
    } catch (error) {
      console.error(\`Failed to hydrate island \${src}:\`, error);
    }
  }
}

customElements.define('is-land', Island);
`;

// Initialize the custom element if it hasn't been defined yet
if (!customElements.get('is-land')) {
	// Execute the CLIENT_SCRIPT to define the custom element
	const script = new Function(CLIENT_SCRIPT);
	script();
}

export const injectClientScript = () => `
  if (!customElements.get('is-land')) {
    ${CLIENT_SCRIPT}
  }
`;

// HMR support for development
if (import.meta.hot) {
	import.meta.hot.accept();
}
