// Main client entry point for Vite
// Integration-based island hydration system
//
// NOTE: This file contains imports to Vite virtual modules (/@useavalon/*/client)
// that will show as errors in the IDE. These are resolved by Vite at runtime
// and work correctly in the browser. The errors can be safely ignored.

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
	const islands = document.querySelectorAll('[data-framework]');

	if (islands.length === 0) {
		return;
	}

	islands.forEach(island => {
		try {
			const framework = island.dataset.framework;
			const condition = island.dataset.condition || 'on:client';
			const renderStrategy = island.dataset.renderStrategy;

			if (renderStrategy === 'ssr-only') {
				return;
			}

			if (!shouldHydrate(island, condition)) {
				return;
			}

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
				hydrateIsland(island, framework);
			}
		} catch (error) {
			console.error('Error processing island:', error);
			handleHydrationError(island, island.dataset.framework || 'unknown', island.dataset.src || 'unknown', error);
		}
	});
}

/**
 * Determine if an island should hydrate based on its condition
 *
 * @param {HTMLElement} island - The island element
 * @param {string} condition - The hydration condition
 * @returns {boolean} Whether the island should hydrate
 */
function shouldHydrate(island, condition) {
	if (!condition || condition === 'on:client') {
		return true;
	}

	if (condition.startsWith('media:')) {
		const mediaQuery = condition.slice(6);
		try {
			return globalThis.matchMedia(mediaQuery).matches;
		} catch (error) {
			console.error('Invalid media query:', mediaQuery, error);
			return true;
		}
	}

	if (condition === 'on:visible' || condition === 'on:interaction' || condition === 'on:idle') {
		return true;
	}

	console.warn('Unknown hydration condition:', condition);
	return true;
}

/**
 * Setup Intersection Observer for "on:visible" hydration
 *
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 */
function setupIntersectionObserver(island, framework) {
	try {
		const observer = new IntersectionObserver(
			entries => {
				const entry = entries[0];
				if (entry.isIntersecting) {
					hydrateIsland(island, framework);
					observer.disconnect();
				}
			},
			{
				rootMargin: '50px',
				threshold: 0,
			},
		);

		observer.observe(island);
	} catch (error) {
		console.error('Failed to setup intersection observer:', error);
		hydrateIsland(island, framework);
	}
}

/**
 * Setup interaction observer for "on:interaction" hydration
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

		events.forEach(eventType => {
			island.removeEventListener(eventType, handleInteraction);
		});

		hydrateIsland(island, framework);
	};

	try {
		events.forEach(eventType => {
			island.addEventListener(eventType, handleInteraction, { once: true, passive: true });
		});
	} catch (error) {
		console.error('Failed to setup interaction observer:', error);
		hydrateIsland(island, framework);
	}
}

/**
 * Setup idle callback for "on:idle" hydration
 *
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 */
function setupIdleCallback(island, framework) {
	try {
		if ('requestIdleCallback' in globalThis) {
			globalThis.requestIdleCallback(
				() => {
					hydrateIsland(island, framework);
				},
				{ timeout: 5000 },
			);
		} else if (document.readyState === 'complete') {
			setTimeout(() => {
				hydrateIsland(island, framework);
			}, 200);
		} else {
			globalThis.addEventListener(
				'load',
				() => {
					setTimeout(() => {
						hydrateIsland(island, framework);
					}, 200);
				},
				{ once: true },
			);
		}
	} catch (error) {
		console.error('Failed to setup idle callback:', error);
		hydrateIsland(island, framework);
	}
}

/**
 * Setup media query listener for "media:" hydration
 *
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 * @param {string} mediaQuery - The media query string
 */
function setupMediaQuery(island, framework, mediaQuery) {
	try {
		const mql = globalThis.matchMedia(mediaQuery);

		if (mql.matches) {
			hydrateIsland(island, framework);
			return;
		}

		const handleChange = event => {
			if (event.matches) {
				hydrateIsland(island, framework);
				mql.removeEventListener('change', handleChange);
			}
		};

		mql.addEventListener('change', handleChange);
	} catch (error) {
		console.error('Failed to setup media query:', mediaQuery, error);
		hydrateIsland(island, framework);
	}
}

/**
 * Load the integration module for a given framework
 *
 * @param {string} framework - The framework name
 * @returns {Promise<object>} The integration module
 */
async function loadIntegrationModule(framework) {
	switch (framework) {
		case 'preact':
			// @ts-ignore - Vite resolves this at runtime
			return import('/@useavalon/preact/client');
		case 'react':
			// @ts-ignore - Vite resolves this at runtime
			return import('/@useavalon/react/client');
		case 'vue':
			// @ts-ignore - Vite resolves this at runtime
			return import('/@useavalon/vue/client');
		case 'svelte':
			// @ts-ignore - Vite resolves this at runtime
			return import('/@useavalon/svelte/client');
		case 'solid':
			// @ts-ignore - Vite resolves this at runtime
			return import('/@useavalon/solid/client');
		case 'lit':
			// @ts-ignore - Vite resolves this at runtime
			return import('/@useavalon/lit/client');
		case 'qwik':
			// @ts-ignore - Vite resolves this at runtime
			return import('/@useavalon/qwik/client');
		default:
			throw new Error(`Unknown framework: ${framework}`);
	}
}

/**
 * Resolve the component from a module, trying default export then named exports
 *
 * @param {object} componentModule - The imported module
 * @param {string} src - The component source path (for error messages)
 * @returns {object} The resolved component
 */
function resolveComponent(componentModule, src) {
	let Component = componentModule.default;

	if (!Component) {
		const exports = Object.keys(componentModule).filter(key => key !== 'default');
		for (const exportName of exports) {
			const exportValue = componentModule[exportName];
			if (typeof exportValue === 'function' && exportValue.prototype) {
				Component = exportValue;
				break;
			}
		}

		if (!Component) {
			Component = componentModule;
		}
	}

	if (!Component) {
		throw new Error(`Component ${src} has no default export`);
	}

	return Component;
}

/**
 * Hydrate an island using the integration system
 *
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 */
async function hydrateIsland(island, framework) {
	if (island.dataset.hydrated) {
		return;
	}

	const src = island.dataset.src;
	const propsAttr = island.dataset.props;

	if (!src) {
		console.warn('Island missing data-src attribute');
		return;
	}

	try {
		const props = propsAttr ? JSON.parse(propsAttr) : {};

		// CRITICAL: For Lit components, load hydration support BEFORE importing the component
		// This ensures our patch is applied before @customElement decorator runs
		if (framework === 'lit') {
			// @ts-ignore - Vite resolves this virtual module at runtime
			await import('/@useavalon/lit/client');
		}

		const componentModule = await import(/* @vite-ignore */ src);
		const Component = resolveComponent(componentModule, src);

		try {
			const integrationModule = await loadIntegrationModule(framework);

			if (!integrationModule.hydrate || typeof integrationModule.hydrate !== 'function') {
				throw new Error(`Integration ${framework} does not export a hydrate function`);
			}

			integrationModule.hydrate(island, Component, props);
			island.dataset.hydrated = 'true';
		} catch (integrationError) {
			if (import.meta.env?.DEV) {
				console.error(`Integration hydration failed for ${framework}: ${src}`, integrationError);
			}

			island.dataset.hydrationStatus = 'failed';
			island.dataset.hydrationError = integrationError.message;

			island.dispatchEvent(
				new CustomEvent('hydration-error', {
					detail: {
						framework,
						src,
						error: integrationError.message,
						timestamp: Date.now(),
						hydrationType: 'integration-level',
					},
					bubbles: true,
				}),
			);
		}
	} catch (error) {
		console.error(`❌ Critical error hydrating ${framework} island ${src}:`, error);
		handleHydrationError(island, framework, src, error);
	}
}

/**
 * Handle hydration errors with graceful degradation
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

	island.dataset.hydrationStatus = 'failed';
	island.dataset.renderStrategy = 'ssr-only';
	island.classList.add('hydration-failed');

	island.dispatchEvent(
		new CustomEvent('hydration-error', {
			detail: {
				framework,
				src,
				error: error.message,
				timestamp: Date.now(),
			},
			bubbles: true,
		}),
	);

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
		alert(
			`Hydration Error\n\nFramework: ${framework}\nComponent: ${src}\n\nError: ${error.message}\n\nStack:\n${error.stack}`,
		);
	});

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
	return (
		import.meta.env?.DEV ||
		import.meta.env?.MODE === 'development' ||
		globalThis.location?.hostname === 'localhost' ||
		globalThis.location?.hostname === '127.0.0.1'
	);
}

/**
 * Store island state before HMR update
 * @param {HTMLElement} island - The island element
 * @returns {object|null} The preserved state
 */
function preserveIslandState(island) {
	const framework = island.dataset.framework;
	const src = island.dataset.src;

	if (!src) return null;

	const state = {
		framework,
		src,
		props: island.dataset.props,
		scrollPosition: {
			x: globalThis.scrollX,
			y: globalThis.scrollY,
		},
		focusedElement: document.activeElement?.id || null,
	};

	try {
		if (framework === 'vue' && island.__vue__) {
			state.vueData = structuredClone(island.__vue__.$data || {});
		} else if (framework === 'svelte' && island.__svelte__) {
			state.svelteState = island.__svelte__;
		} else if (framework === 'lit' && island.tagName?.includes('-')) {
			const litElement = island.querySelector('[data-lit-element]') || island;
			if (litElement._$litElement$) {
				state.litProperties = {};
			}
		}
	} catch (error) {
		console.warn('Failed to preserve island state:', error);
	}

	return state;
}

/**
 * Restore island state after HMR update
 * @param {HTMLElement} island - The island element
 * @param {object} state - The preserved state
 */
function restoreIslandState(island, state) {
	if (!state) return;

	try {
		if (state.scrollPosition) {
			globalThis.scrollTo(state.scrollPosition.x, state.scrollPosition.y);
		}

		if (state.focusedElement) {
			const element = document.getElementById(state.focusedElement);
			if (element) {
				element.focus();
			}
		}

		if (island.dataset.framework === 'vue' && state.vueData && island.__vue__) {
			Object.assign(island.__vue__.$data, state.vueData);
		}
	} catch (error) {
		console.warn('Failed to restore island state:', error);
	}
}

/**
 * Hydrate an island with a fresh module (cache-busted)
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 * @param {string} freshSrc - The cache-busted source path
 * @param {string} originalSrc - The original source path
 */
async function hydrateIslandWithFreshModule(island, framework, freshSrc, originalSrc) {
	const propsAttr = island.dataset.props;
	const props = propsAttr ? JSON.parse(propsAttr) : {};

	if (framework === 'lit') {
		// @ts-ignore - Vite resolves this at runtime
		await import('/@useavalon/lit/client');
	}

	const componentModule = await import(/* @vite-ignore */ freshSrc);
	const Component = resolveComponent(componentModule, originalSrc);

	const integrationModule = await loadIntegrationModule(framework);

	if (!integrationModule.hydrate || typeof integrationModule.hydrate !== 'function') {
		throw new Error(`Integration ${framework} does not export a hydrate function`);
	}

	integrationModule.hydrate(island, Component, props);
	island.dataset.hydrated = 'true';
}

/**
 * Show inline HMR error indicator
 * @param {HTMLElement} island - The island element
 * @param {string} framework - The framework name
 * @param {string} src - The component source path
 * @param {Error} error - The error that occurred
 */
function showInlineHMRError(island, framework, src, error) {
	const existing = island.querySelector('.hmr-error-indicator');
	if (existing) {
		existing.remove();
	}

	const indicator = document.createElement('div');
	indicator.className = 'hmr-error-indicator';
	indicator.style.cssText = `
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
		color: white;
		padding: 8px 12px;
		font-size: 12px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
		z-index: 10000;
		box-shadow: 0 2px 8px rgba(0,0,0,0.3);
		display: flex;
		align-items: center;
		gap: 8px;
	`;

	const icon = document.createElement('span');
	icon.textContent = '⚠️';
	icon.style.fontSize = '14px';

	const message = document.createElement('span');
	message.style.flex = '1';
	message.innerHTML = `<strong>HMR Failed:</strong> ${error.message.slice(0, 100)}${error.message.length > 100 ? '...' : ''}`;

	const dismissBtn = document.createElement('button');
	dismissBtn.textContent = '×';
	dismissBtn.style.cssText = `
		background: rgba(255,255,255,0.2);
		border: none;
		color: white;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
	`;
	dismissBtn.onclick = () => indicator.remove();

	indicator.appendChild(icon);
	indicator.appendChild(message);
	indicator.appendChild(dismissBtn);

	const computedStyle = globalThis.getComputedStyle(island);
	if (computedStyle.position === 'static') {
		island.style.position = 'relative';
	}

	island.insertBefore(indicator, island.firstChild);
}

// HMR support for development
if (import.meta.hot) {
	import.meta.hot.accept();

	// Lazy HMR adapter registration - only load adapters for frameworks used on the page
	import('./hmr-coordinator.js')
		.then(async ({ initializeHMR, getHMRCoordinator }) => {
			initializeHMR();

			const coordinator = getHMRCoordinator();
			
			// Discover which frameworks are actually used on this page
			const usedFrameworks = new Set();
			document.querySelectorAll('[data-framework]').forEach(island => {
				const framework = island.dataset.framework;
				if (framework) usedFrameworks.add(framework);
			});

			// Only register adapters for frameworks that are used
			const adapterLoaders = {
				react: () => import('./adapters/react-adapter.js').then(m => m.reactAdapter),
				preact: () => import('./adapters/preact-adapter.js').then(m => m.preactAdapter),
				vue: () => import('./adapters/vue-adapter.js').then(m => m.vueAdapter),
				svelte: () => import('./adapters/svelte-adapter.js').then(m => m.svelteAdapter),
				solid: () => import('./adapters/solid-adapter.js').then(m => m.solidAdapter),
				lit: () => import('./adapters/lit-adapter.js').then(m => m.litAdapter),
				qwik: () => import('./adapters/qwik-adapter.js').then(m => m.qwikAdapter),
			};

			for (const framework of usedFrameworks) {
				const loader = adapterLoaders[framework];
				if (loader) {
					try {
						const adapter = await loader();
						coordinator.registerAdapter(framework, adapter);
					} catch (error) {
						console.warn(`[HMR] Failed to load adapter for ${framework}:`, error);
					}
				}
			}
		})
		.catch(error => {
			console.error('[HMR] Failed to initialize:', error);
		});

	// Enhanced HMR support for nested islands
	setupNestedIslandHMR();
}

/**
 * Show HMR error feedback on the island
 * @param {HTMLElement} island - The island element
 * @param {string} hmrFramework - The framework name
 * @param {string} hmrSrc - The component source path
 * @param {Error} error - The error that occurred
 */
async function showHMRError(island, hmrFramework, hmrSrc, error) {
	try {
		const { showHMRErrorOverlay } = await import('./hmr-error-overlay.js');
		showHMRErrorOverlay({
			framework: hmrFramework,
			src: hmrSrc,
			error,
			filePath: hmrSrc,
		});
	} catch {
		showInlineHMRError(island, hmrFramework, hmrSrc, error);
	}
}

/**
 * Setup HMR support for nested island directories.
 * Handles hot module replacement for islands in any discovered directory,
 * including nested paths like /src/modules/[module]/islands/.
 */
function setupNestedIslandHMR() {
	if (!import.meta.hot) return;

	const hydratedIslands = new Map();

	async function handleIslandHMR(modulePath) {
		const normalizedPath = modulePath.replaceAll('\\', '/');

		const islands = document.querySelectorAll(`[data-src*="${normalizedPath}"], [data-src$="${normalizedPath}"]`);

		if (islands.length === 0) {
			const allIslands = document.querySelectorAll('[data-src]');
			for (const island of allIslands) {
				const src = island.dataset.src;
				if (src && (src.includes(normalizedPath) || normalizedPath.includes(src.replace(/^\//, '')))) {
					await rehydrateIsland(island);
				}
			}
			return;
		}

		for (const island of islands) {
			await rehydrateIsland(island);
		}
	}

	async function rehydrateIsland(island) {
		const framework = island.dataset.framework;
		const src = island.dataset.src;

		if (!src || !framework) return;

		try {
			const state = preserveIslandState(island);
			hydratedIslands.set(src, state);

			delete island.dataset.hydrated;
			delete island.dataset.hydrationStatus;

			const errorIndicator = island.querySelector('.hydration-error-indicator');
			if (errorIndicator) {
				errorIndicator.remove();
			}

			const timestamp = Date.now();
			const freshSrc = src.includes('?') ? `${src}&t=${timestamp}` : `${src}?t=${timestamp}`;

			await hydrateIslandWithFreshModule(island, framework, freshSrc, src);

			const preservedState = hydratedIslands.get(src);
			if (preservedState) {
				restoreIslandState(island, preservedState);
				hydratedIslands.delete(src);
			}

			island.dispatchEvent(
				new CustomEvent('hmr-update', {
					detail: {
						framework,
						src,
						timestamp: Date.now(),
						success: true,
					},
					bubbles: true,
				}),
			);
		} catch (error) {
			console.error(`[HMR] Failed for ${framework} island ${src}:`, error);

			island.dispatchEvent(
				new CustomEvent('hmr-error', {
					detail: {
						framework,
						src,
						error: error.message,
						timestamp: Date.now(),
					},
					bubbles: true,
				}),
			);

			if (isDevelopment()) {
				showHMRError(island, framework, src, error);
			}
		}
	}

	// Listen for Vite HMR events
	import.meta.hot.on('vite:beforeUpdate', payload => {
		for (const update of payload.updates || []) {
			const path = update.path || update.acceptedPath;
			if (path && (path.includes('/islands/') || path.includes('\\islands\\'))) {
				handleIslandHMR(path);
			}
		}
	});

	// Handle full page reloads for islands
	import.meta.hot.on('vite:beforeFullReload', () => {
		const islands = document.querySelectorAll('[data-hydrated="true"]');
		const states = {};

		for (const island of islands) {
			const src = island.dataset.src;
			if (src) {
				states[src] = preserveIslandState(island);
			}
		}

		try {
			sessionStorage.setItem('__avalon_hmr_states__', JSON.stringify(states));
		} catch {
			// sessionStorage might not be available
		}
	});

	// Restore states after page load (for full reloads)
	try {
		const savedStates = sessionStorage.getItem('__avalon_hmr_states__');
		if (savedStates) {
			const states = JSON.parse(savedStates);
			sessionStorage.removeItem('__avalon_hmr_states__');

			setTimeout(() => {
				for (const [src, state] of Object.entries(states)) {
					const island = document.querySelector(`[data-src="${src}"]`);
					if (island && state) {
						restoreIslandState(island, state);
					}
				}
			}, 100);
		}
	} catch {
		// Ignore errors - state restoration is best-effort
	}
}
