// Main client entry point for Vite
// Streamlined island hydration system

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeHydration);
} else {
	initializeHydration();
}

function initializeHydration() {
	const hydrateElements = document.querySelectorAll('[data-hydrate]');
	const solidElements = document.querySelectorAll('[data-solid-hydrate]');

	// Initialize Solid hydration system if there are Solid islands
	if (solidElements.length > 0) {
		import('./solid-hydration.js').catch(error => {
			console.error('Failed to load Solid hydration system:', error);
		});
	}

	if (hydrateElements.length === 0) {
		return;
	}

	hydrateElements.forEach(element => {
		try {
			const renderStrategy = element.getAttribute('data-render-strategy');

			if (renderStrategy === 'ssr-only') {
				return; // Skip hydration for SSR-only components
			}

			const condition = element.getAttribute('data-island') || element.getAttribute('data-condition') || 'on:client';
			const parsedConfig = parseHydrationDirective(condition);

			if (parsedConfig.directive === 'on:load') {
				return; // Skip hydration for on:load
			}

			// Route to appropriate hydration strategy
			if (parsedConfig.directive === 'on:visible') {
				setupVisibilityTrigger(element, parsedConfig.options);
			} else if (parsedConfig.directive === 'on:interaction' || parsedConfig.directive === 'on:interactive') {
				setupInteractionTrigger(element, parsedConfig.options);
			} else if (parsedConfig.directive === 'on:idle') {
				setupIdleTrigger(element, parsedConfig.options);
			} else if (parsedConfig.directive.startsWith('media:')) {
				const mediaQuery = parsedConfig.directive.slice(6);
				setupMediaTrigger(element, mediaQuery);
			} else {
				// Default to immediate hydration
				hydrateElement(element);
			}
		} catch (error) {
			console.error('Error processing island:', error);
		}
	});
}

function parseHydrationDirective(condition) {
	if (!condition || typeof condition !== 'string') {
		return { directive: 'on:client', options: {} };
	}

	// Extract directive name (everything before the first '=' or the whole string)
	const directiveMatch = condition.match(/^([^=\s]+)/);
	if (!directiveMatch) {
		return { directive: 'on:client', options: {} };
	}

	const directive = directiveMatch[1];
	let options = {};

	try {
		// Check for options syntax like directive={{key: value, key2: value2}}
		const optionsMatch = condition.match(/=\s*\{\{(.+?)\}\}/);
		if (optionsMatch) {
			const optionsString = optionsMatch[1];
			options = parseDirectiveOptions(optionsString, directive);
		}
	} catch (_error) {
		options = {};
	}

	// Apply defaults and validation based on directive type
	options = applyDirectiveDefaults(directive, options);

	return { directive, options };
}

function parseDirectiveOptions(optionsString, _directive) {
	if (!optionsString || !optionsString.trim()) {
		return {};
	}

	try {
		// Handle both quoted and unquoted property names
		const normalizedOptions = optionsString
			.replace(/(\w+):/g, '"$1":') // Add quotes around property names
			.replace(/'/g, '"'); // Convert single quotes to double quotes

		return JSON.parse(`{${normalizedOptions}}`);
	} catch (_error) {
		return {};
	}
}

function applyDirectiveDefaults(directive, options) {
	switch (directive) {
		case 'on:visible':
			return applyVisibilityDefaults(options);
		case 'on:idle':
			return applyIdleDefaults(options);
		case 'on:interaction':
		case 'on:interactive':
			return applyInteractionDefaults(options);
		default:
			return options;
	}
}

function applyVisibilityDefaults(options) {
	const defaults = {
		rootMargin: '50px',
		threshold: 0,
	};

	const result = { ...defaults };

	if (options.rootMargin !== undefined && validateRootMargin(options.rootMargin)) {
		result.rootMargin = options.rootMargin;
	}

	if (options.threshold !== undefined && validateThreshold(options.threshold)) {
		result.threshold = options.threshold;
	}

	return result;
}

function applyIdleDefaults(options) {
	const defaults = {
		timeout: 5000, // 5 seconds
	};

	const result = { ...defaults };

	if (options.timeout !== undefined && validateTimeout(options.timeout)) {
		result.timeout = options.timeout;
	}

	return result;
}

function applyInteractionDefaults(options) {
	const defaults = {
		events: ['click', 'touchstart', 'mouseover', 'focus'],
	};

	const result = { ...defaults };

	if (options.events !== undefined && validateInteractionEvents(options.events)) {
		result.events = Array.isArray(options.events) ? options.events : [options.events];
	}

	return result;
}

function validateThreshold(threshold) {
	return typeof threshold === 'number' && threshold >= 0 && threshold <= 1;
}

function validateTimeout(timeout) {
	return typeof timeout === 'number' && timeout > 0 && timeout <= 60000; // Max 60 seconds
}

function validateInteractionEvents(events) {
	if (typeof events === 'string') {
		return true; // Single event name
	}

	if (Array.isArray(events)) {
		return events.every(event => typeof event === 'string' && event.length > 0);
	}

	return false;
}

function validateRootMargin(rootMargin) {
	if (typeof rootMargin !== 'string') {
		return false;
	}

	const rootMarginRegex = /^(-?\d+(?:\.\d+)?(?:px|%)?(?:\s+-?\d+(?:\.\d+)?(?:px|%)?){0,3})$/;
	return rootMarginRegex.test(rootMargin.trim());
}

function setupVisibilityTrigger(element, options = {}) {
	const visibilityOptions = {
		rootMargin: '50px',
		threshold: 0,
		...options,
	};

	try {
		const observer = new IntersectionObserver(
			entries => {
				const entry = entries[0];
				if (entry.isIntersecting) {
					hydrateElement(element);
					observer.disconnect();
				}
			},
			{
				threshold: visibilityOptions.threshold,
				rootMargin: visibilityOptions.rootMargin,
			}
		);

		observer.observe(element);
	} catch (error) {
		console.error('Failed to setup visibility trigger:', error);
		hydrateElement(element);
	}
}

function setupInteractionTrigger(element, options = {}) {
	const interactionOptions = {
		events: ['click', 'touchstart', 'mouseover', 'focus'],
		...options,
	};

	let interactionDetected = false;
	const handleInteraction = _event => {
		if (interactionDetected) return; // Prevent multiple triggers
		interactionDetected = true;

		hydrateElement(element);

		// Clean up event listeners
		interactionOptions.events.forEach(eventType => {
			element.removeEventListener(eventType, handleInteraction);
		});
	};

	try {
		interactionOptions.events.forEach(eventType => {
			element.addEventListener(eventType, handleInteraction, { once: true });
		});
	} catch (error) {
		console.error('Failed to setup interaction trigger:', error);
		hydrateElement(element);
	}
}

const idleQueue = [];
let isProcessingIdleQueue = false;
let idleTimeoutId = null;
const DEFAULT_IDLE_TIMEOUT = 5000;

function setupIdleTrigger(element, options = {}) {
	const idleOptions = {
		timeout: DEFAULT_IDLE_TIMEOUT,
		...options,
	};

	idleQueue.push({ element, options: idleOptions });

	if (!isProcessingIdleQueue) {
		processIdleQueue();
	}
}

function processIdleQueue() {
	if (isProcessingIdleQueue || idleQueue.length === 0) {
		return;
	}

	isProcessingIdleQueue = true;
	const maxTimeout = Math.max(...idleQueue.map(item => item.options.timeout), DEFAULT_IDLE_TIMEOUT);

	if (idleTimeoutId) {
		clearTimeout(idleTimeoutId);
		idleTimeoutId = null;
	}

	if (globalThis.requestIdleCallback) {
		globalThis.requestIdleCallback(
			deadline => {
				hydrateIdleComponents(deadline);
			},
			{ timeout: maxTimeout }
		);
	} else {
		if (document.readyState === 'complete') {
			hydrateIdleComponents();
		} else {
			const handleLoad = () => {
				hydrateIdleComponents();
				globalThis.removeEventListener('load', handleLoad);
			};
			globalThis.addEventListener('load', handleLoad);
		}
	}

	idleTimeoutId = setTimeout(() => {
		hydrateIdleComponents();
	}, maxTimeout);
}

function hydrateIdleComponents(deadline) {
	if (idleTimeoutId) {
		clearTimeout(idleTimeoutId);
		idleTimeoutId = null;
	}

	while (idleQueue.length > 0) {
		if (deadline && deadline.timeRemaining() <= 1) {
			const remainingTimeouts = idleQueue.map(item => item.options.timeout);
			const nextTimeout = Math.max(...remainingTimeouts, DEFAULT_IDLE_TIMEOUT);

			globalThis.requestIdleCallback(
				nextDeadline => {
					hydrateIdleComponents(nextDeadline);
				},
				{ timeout: nextTimeout }
			);
			return;
		}

		const queueItem = idleQueue.shift();
		try {
			hydrateElement(queueItem.element);
		} catch (error) {
			console.error('Error hydrating idle component:', error);
		}
	}

	isProcessingIdleQueue = false;
}

function setupMediaTrigger(element, mediaQuery) {
	try {
		const mediaQueryList = globalThis.matchMedia(mediaQuery);

		if (mediaQueryList.matches) {
			hydrateElement(element);
			return;
		}

		const handleMediaChange = event => {
			if (event.matches) {
				hydrateElement(element);
				mediaQueryList.removeEventListener('change', handleMediaChange);
			}
		};

		mediaQueryList.addEventListener('change', handleMediaChange);
	} catch (error) {
		console.error('Failed to setup media trigger:', error);
		hydrateElement(element);
	}
}

async function hydrateElement(element) {
	const src = element.getAttribute('data-hydrate');
	const propsAttr = element.getAttribute('data-props');
	const framework = element.getAttribute('data-framework');
	const renderStrategy = element.getAttribute('data-render-strategy');

	if (!src) {
		console.warn('Element missing data-hydrate attribute');
		return;
	}

	try {
		const props = propsAttr ? JSON.parse(propsAttr) : {};

		if (renderStrategy === 'ssr-only') {
			return;
		}

		const shouldHydrate = await determineHydrationStrategy(src, framework, element);

		if (!shouldHydrate.shouldHydrate) {
			if (shouldHydrate.warnings) {
				shouldHydrate.warnings.forEach(warning => console.warn(warning));
			}
			return;
		}

		const componentModule = await import(src);

		if (componentModule.hydrate && typeof componentModule.hydrate === 'function') {
			try {
				componentModule.hydrate(element, props);
			} catch (hydrateError) {
				console.error('Hydration function failed:', hydrateError);
				throw hydrateError;
			}
		} else {
			await handleComponentWithoutHydrate(src, framework, element, componentModule, shouldHydrate);
		}
	} catch (error) {
		console.error(`Failed to hydrate island ${src}:`, error);
	}
}

async function determineHydrationStrategy(src, framework, element) {
	// Check for explicit SSR-only markers
	if (element.hasAttribute('data-ssr-only') || element.classList.contains('ssr-only')) {
		return {
			shouldHydrate: false,
			reason: 'Component explicitly marked for SSR-only rendering',
		};
	}

	try {
		const componentModule = await import(src);

		if (componentModule.hydrate && typeof componentModule.hydrate === 'function') {
			return {
				shouldHydrate: true,
				reason: 'Component has hydrate function',
			};
		}

		const hasInteractivePatterns = checkForInteractivePatterns(src, framework);

		if (!hasInteractivePatterns) {
			return {
				shouldHydrate: false,
				reason: 'Component appears to be static content without interactive features',
				warnings: ['Component has no hydrate function and no interactive patterns detected'],
			};
		}

		return {
			shouldHydrate: true,
			reason: 'Component has interactive patterns but no hydrate function, proceeding with caution',
			warnings: ['Component appears interactive but lacks proper hydrate function'],
		};
	} catch (error) {
		return {
			shouldHydrate: true,
			reason: 'Unable to analyze component, defaulting to hydration attempt',
			warnings: [`Component analysis failed: ${error.message}`],
		};
	}
}

function checkForInteractivePatterns(src, framework) {
	try {
		switch (framework) {
			case 'svelte':
				return src.includes('on:') || src.includes('$:');
			case 'vue':
				return src.includes('@') || src.includes('v-on') || src.includes('reactive');
			case 'solid':
				return src.includes('createSignal') || src.includes('onClick');
			default:
				return true;
		}
	} catch (_error) {
		return true;
	}
}

async function handleComponentWithoutHydrate(src, framework, element, _componentModule, hydrationDecision) {
	if (hydrationDecision.warnings) {
		hydrationDecision.warnings.forEach(warning => {
			console.warn(warning);
		});
	}

	// Special handling for Solid components that still use the old system
	if (framework === 'solid' || element.hasAttribute('data-solid-hydrate')) {
		try {
			await import('./solid-hydration.js');
		} catch (error) {
			console.warn(`Solid.js legacy hydration failed for ${src}:`, error);
		}
	} else {
		console.warn(`Component ${src} has no hydrate function and will remain as static SSR content.`);
	}
}

// HMR support for development
if (import.meta.hot) {
	import.meta.hot.accept();
}
