// Main client entry point for Vite
// Integration-based island hydration system

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeHydration);
} else {
	initializeHydration();
}

/**
 * Initialize hydration for all islands on the page
 * Discovers islands by data-framework attribute and routes to appropriate integration
 */
function initializeHydration() {
	// Find all islands with framework attribute (new integration system)
	const islands = document.querySelectorAll('[data-framework]');
	
	// Also support legacy data-hydrate attribute for backward compatibility
	const legacyElements = document.querySelectorAll('[data-hydrate]:not([data-framework])');
	
	if (islands.length === 0 && legacyElements.length === 0) {
		return;
	}

	// Process new integration-based islands
	islands.forEach(island => {
		try {
			const framework = island.getAttribute('data-framework');
			const condition = island.getAttribute('data-condition') || 'on:client';
			const renderStrategy = island.getAttribute('data-render-strategy');

			// Skip SSR-only components
			if (renderStrategy === 'ssr-only') {
				return;
			}

			// Route to appropriate hydration strategy based on condition
			if (!shouldHydrate(island, condition)) {
				return;
			}

			// Setup hydration based on condition
			if (condition === 'on:client') {
				hydrateIsland(island, framework);
			} else if (condition === 'on:visible') {
				setupIntersectionObserver(island, framework);
			} else if (condition === 'on:interaction') {
				setupInteractionObserver(island, framework);
			} else if (condition === 'on:idle') {
				setupIdleCallback(island, framework);
			} else if (condition.startsWith('media:')) {
				const mediaQuery = condition.slice(6);
				setupMediaQuery(island, framework, mediaQuery);
			} else {
				// Unknown condition, default to immediate hydration
				hydrateIsland(island, framework);
			}
		} catch (error) {
			console.error('Error processing island:', error);
			const framework = island.getAttribute('data-framework') || 'unknown';
			const src = island.getAttribute('data-src') || 'unknown';
			handleHydrationError(island, framework, src, error);
		}
	});

	// Process legacy elements for backward compatibility
	legacyElements.forEach(element => {
		try {
			processLegacyElement(element);
		} catch (error) {
			console.error('Error processing legacy island:', error);
		}
	});
}

/**
 * Determine if an island should hydrate based on its condition
 * This is a synchronous check for immediate conditions
 * 
 * @param {HTMLElement} island - The island element
 * @param {string} condition - The hydration condition
 * @returns {boolean} Whether the island should hydrate
 */
function shouldHydrate(island, condition) {
	// Always hydrate for on:client (default)
	if (!condition || condition === 'on:client') {
		return true;
	}

	// For media queries, check immediately
	if (condition.startsWith('media:')) {
		const mediaQuery = condition.slice(6);
		try {
			return globalThis.matchMedia(mediaQuery).matches;
		} catch (error) {
			console.error('Invalid media query:', mediaQuery, error);
			return true; // Fallback to hydration on error
		}
	}

	// For other conditions (on:visible, on:interaction, on:idle), 
	// return true to allow setup, actual hydration happens later
	if (condition === 'on:visible' || condition === 'on:interaction' || condition === 'on:idle') {
		return true;
	}

	// Unknown condition, default to hydration
	console.warn('Unknown hydration condition:', condition);
	return true;
}

/**
 * Setup Intersection Observer for "on:visible" hydration
 * Hydrates the island when it enters the viewport
 * 
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 */
function setupIntersectionObserver(island, framework) {
	try {
		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry.isIntersecting) {
					hydrateIsland(island, framework);
					observer.disconnect();
				}
			},
			{
				rootMargin: '50px', // Start loading 50px before entering viewport
				threshold: 0, // Trigger as soon as any part is visible
			}
		);

		observer.observe(island);
	} catch (error) {
		console.error('Failed to setup intersection observer:', error);
		// Fallback to immediate hydration on error
		hydrateIsland(island, framework);
	}
}

/**
 * Setup interaction observer for "on:interaction" hydration
 * Hydrates the island on first user interaction
 * 
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 */
function setupInteractionObserver(island, framework) {
	const events = ['click', 'touchstart', 'mouseenter', 'focusin'];
	let hydrated = false;

	const handleInteraction = () => {
		if (hydrated) return;
		hydrated = true;

		// Remove all event listeners
		events.forEach(eventType => {
			island.removeEventListener(eventType, handleInteraction);
		});

		// Hydrate the island
		hydrateIsland(island, framework);
	};

	try {
		// Add event listeners for all interaction types
		events.forEach(eventType => {
			island.addEventListener(eventType, handleInteraction, { once: true, passive: true });
		});
	} catch (error) {
		console.error('Failed to setup interaction observer:', error);
		// Fallback to immediate hydration on error
		hydrateIsland(island, framework);
	}
}

/**
 * Setup idle callback for "on:idle" hydration
 * Hydrates the island when the browser is idle
 * 
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 */
function setupIdleCallback(island, framework) {
	try {
		if ('requestIdleCallback' in globalThis) {
			// Use requestIdleCallback if available
			globalThis.requestIdleCallback(
				() => {
					hydrateIsland(island, framework);
				},
				{ timeout: 5000 } // Fallback timeout of 5 seconds
			);
		} else {
			// Fallback for browsers without requestIdleCallback
			// Wait for page load, then use setTimeout
			if (document.readyState === 'complete') {
				setTimeout(() => {
					hydrateIsland(island, framework);
				}, 200);
			} else {
				globalThis.addEventListener('load', () => {
					setTimeout(() => {
						hydrateIsland(island, framework);
					}, 200);
				}, { once: true });
			}
		}
	} catch (error) {
		console.error('Failed to setup idle callback:', error);
		// Fallback to immediate hydration on error
		hydrateIsland(island, framework);
	}
}

/**
 * Setup media query listener for "media:" hydration
 * Hydrates the island when the media query matches
 * 
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 * @param {string} mediaQuery - The media query string
 */
function setupMediaQuery(island, framework, mediaQuery) {
	try {
		const mql = globalThis.matchMedia(mediaQuery);

		// If already matches, hydrate immediately
		if (mql.matches) {
			hydrateIsland(island, framework);
			return;
		}

		// Otherwise, listen for changes
		const handleChange = (event) => {
			if (event.matches) {
				hydrateIsland(island, framework);
				mql.removeEventListener('change', handleChange);
			}
		};

		mql.addEventListener('change', handleChange);
	} catch (error) {
		console.error('Failed to setup media query:', mediaQuery, error);
		// Fallback to immediate hydration on error
		hydrateIsland(island, framework);
	}
}

/**
 * Hydrate an island using component-level hydrate or integration system
 * First checks if component exports its own hydrate function (Svelte, Solid)
 * Falls back to integration system for Preact and Vue
 * 
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 */
async function hydrateIsland(island, framework) {
	// Check if already hydrated
	if (island.hasAttribute('data-hydrated')) {
		return;
	}
	
	const src = island.getAttribute('data-src');
	const propsAttr = island.getAttribute('data-props');

	if (!src) {
		console.warn('Island missing data-src attribute');
		return;
	}

	try {
		// Parse props
		const props = propsAttr ? JSON.parse(propsAttr) : {};

		// CRITICAL: For Lit components, load hydration support BEFORE importing the component
		// This ensures our patch is applied before @customElement decorator runs
		if (framework === 'lit') {
			await import('/@avalon/lit/client');
		}

		// Dynamically import the component
		const componentModule = await import(src);
		let Component = componentModule.default;
		
		// If no default export, try to find the component class in named exports
		if (!Component) {
			const exports = Object.keys(componentModule).filter(key => key !== 'default');
			if (exports.length > 0) {
				for (const exportName of exports) {
					const exportValue = componentModule[exportName];
					if (typeof exportValue === 'function' && exportValue.prototype) {
						Component = exportValue;
						break;
					}
				}
			}
			
			// Final fallback: use the whole module (for backwards compatibility)
			if (!Component) {
				Component = componentModule;
			}
		}

		if (!Component) {
			throw new Error(`Component ${src} has no default export`);
		}

		// Use integration system - import from bundled integrations
		// These are bundled at build time via Vite
		try {
			let integrationModule;
			
			// Import the appropriate integration based on framework
			switch (framework) {
				case 'preact':
					integrationModule = await import('/@avalon/preact/client');
					break;
				case 'react':
					integrationModule = await import('/@avalon/react/client');
					break;
				case 'vue':
					integrationModule = await import('/@avalon/vue/client');
					break;
				case 'svelte':
					integrationModule = await import('/@avalon/svelte/client');
					break;
				case 'solid':
					integrationModule = await import('/@avalon/solid/client');
					break;
				case 'lit':
					integrationModule = await import('/@avalon/lit/client');
					break;
				default:
					throw new Error(`Unknown framework: ${framework}`);
			}
			
			if (!integrationModule.hydrate || typeof integrationModule.hydrate !== 'function') {
				throw new Error(`Integration ${framework} does not export a hydrate function`);
			}

			// Hydrate using the integration
			integrationModule.hydrate(island, Component, props);

			// Mark as hydrated
			island.setAttribute('data-hydrated', 'true');
		} catch (integrationError) {
			// Integration hydration failed - only log in dev
			if (import.meta.env?.DEV) {
				console.error(`Integration hydration failed for ${framework}: ${src}`, integrationError);
			}
			
			// Mark as failed but don't throw - component remains as static HTML
			island.setAttribute('data-hydration-status', 'failed');
			island.setAttribute('data-hydration-error', integrationError.message);
			
			// Dispatch error event for monitoring
			island.dispatchEvent(new CustomEvent('hydration-error', {
				detail: {
					framework,
					src,
					error: integrationError.message,
					timestamp: Date.now(),
					hydrationType: 'integration-level',
				},
				bubbles: true,
			}));
			
			// Don't throw - graceful degradation
		}
	} catch (error) {
		// Component loading or other critical error
		console.error(`❌ Critical error hydrating ${framework} island ${src}:`, error);
		handleHydrationError(island, framework, src, error);
	}
}

/**
 * Handle hydration errors with graceful degradation
 * Preserves SSR content and marks the island as failed
 * 
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 * @param {string} src - The component source path
 * @param {Error} error - The error that occurred
 */
function handleHydrationError(island, framework, src, error) {
	console.error(`Hydration error for ${framework} island:`, {
		src,
		error: error.message,
		stack: error.stack,
	});

	// Mark as failed
	island.setAttribute('data-hydration-status', 'failed');
	island.setAttribute('data-render-strategy', 'ssr-only');
	island.classList.add('hydration-failed');

	// Dispatch error event for monitoring
	island.dispatchEvent(new CustomEvent('hydration-error', {
		detail: {
			framework,
			src,
			error: error.message,
			timestamp: Date.now(),
		},
		bubbles: true,
	}));

	// In development, add visual indicator
	if (isDevelopment()) {
		addErrorIndicator(island, framework, src, error);
	}
}

/**
 * Add visual error indicator in development mode
 * 
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 * @param {string} src - The component source path
 * @param {Error} error - The error that occurred
 */
function addErrorIndicator(island, framework, src, error) {
	const indicator = document.createElement('div');
	indicator.className = 'hydration-error-indicator';
	indicator.style.cssText = `
		position: absolute;
		top: 0;
		right: 0;
		background: #ff4444;
		color: white;
		padding: 4px 8px;
		font-size: 11px;
		font-family: monospace;
		border-radius: 0 0 0 4px;
		z-index: 9999;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0,0,0,0.2);
	`;
	indicator.textContent = `❌ ${framework}`;
	indicator.title = `Hydration failed: ${src}\n${error.message}\nClick for details`;

	indicator.addEventListener('click', () => {
		alert(`Hydration Error\n\nFramework: ${framework}\nComponent: ${src}\n\nError: ${error.message}\n\nStack:\n${error.stack}`);
	});

	// Ensure island is positioned
	const computedStyle = globalThis.getComputedStyle(island);
	if (computedStyle.position === 'static') {
		island.style.position = 'relative';
	}

	island.appendChild(indicator);
}

/**
 * Check if running in development mode
 * 
 * @returns {boolean} True if in development
 */
function isDevelopment() {
	return import.meta.env?.DEV ||
		import.meta.env?.MODE === 'development' ||
		globalThis.location?.hostname === 'localhost' ||
		globalThis.location?.hostname === '127.0.0.1';
}

/**
 * Process legacy elements with data-hydrate attribute
 * Provides backward compatibility with old hydration system
 * 
 * @param {HTMLElement} element - The legacy element
 */
async function processLegacyElement(element) {
	const src = element.getAttribute('data-hydrate');
	const framework = element.getAttribute('data-framework') || detectFrameworkFromPath(src);
	const renderStrategy = element.getAttribute('data-render-strategy');

	// Skip SSR-only components
	if (renderStrategy === 'ssr-only') {
		return;
	}

	// Convert to new system by setting data-src
	element.setAttribute('data-src', src);
	element.setAttribute('data-framework', framework);

	// Get condition from data-island or data-condition
	const condition = element.getAttribute('data-island') || element.getAttribute('data-condition') || 'on:client';
	element.setAttribute('data-condition', condition);

	// Process using new system
	if (condition === 'on:client') {
		await hydrateIsland(element, framework);
	} else if (condition === 'on:visible') {
		setupIntersectionObserver(element, framework);
	} else if (condition === 'on:interaction') {
		setupInteractionObserver(element, framework);
	} else if (condition === 'on:idle') {
		setupIdleCallback(element, framework);
	} else if (condition.startsWith('media:')) {
		const mediaQuery = condition.slice(6);
		setupMediaQuery(element, framework, mediaQuery);
	} else {
		await hydrateIsland(element, framework);
	}
}

/**
 * Detect framework from file path
 * 
 * @param {string} path - The file path
 * @returns {string} The detected framework name
 */
function detectFrameworkFromPath(path) {
	if (path.endsWith('.vue')) return 'vue';
	if (path.endsWith('.svelte')) return 'svelte';
	if (path.includes('.solid.')) return 'solid';
	return 'preact'; // default
}



// HMR support for development
if (import.meta.hot) {
	import.meta.hot.accept();
}
