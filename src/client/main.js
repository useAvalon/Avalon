// Main client entry point for Vite
// Simplified hydration system - just like traditional SSR + hydration

// Initialize hydration on DOM ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeHydration);
} else {
	initializeHydration();
}

function initializeHydration() {
	// Find all elements with data-hydrate attribute
	const hydrateElements = document.querySelectorAll('[data-hydrate]');

	hydrateElements.forEach(element => {
		// Check render strategy first
		const renderStrategy = element.getAttribute('data-render-strategy');

		if (renderStrategy === 'ssr-only') {
			const reason = element.getAttribute('data-ssr-reason') || 'SSR-only component';
			console.log(`⚡ Skipping hydration for SSR-only component: ${reason}`);
			return; // Skip hydration for SSR-only components
		}

		const condition = element.getAttribute('data-island') || element.getAttribute('data-condition') || 'on:client';

		// Parse hydration options from the condition
		const parsedConfig = parseHydrationDirective(condition);

		// Log parsed configuration for debugging
		if (parsedConfig.options && Object.keys(parsedConfig.options).length > 0) {
			console.log(`🔧 Parsed hydration config for ${parsedConfig.directive}:`, parsedConfig.options);
		}

		if (parsedConfig.directive === 'on:load') {
			console.warn(
				`⚠️ on:load directive is not implemented and has been ignored. Use on:client for immediate hydration instead.`
			);
			return; // Skip hydration for on:load
		}

		if (parsedConfig.directive === 'on:visible') {
			setupVisibilityTrigger(element, parsedConfig.options);
		} else if (parsedConfig.directive === 'on:interaction') {
			setupInteractionTrigger(element, parsedConfig.options);
		} else if (parsedConfig.directive === 'on:idle') {
			setupIdleTrigger(element, parsedConfig.options);
		} else if (parsedConfig.directive === 'on:client') {
			hydrateElement(element);
		} else if (parsedConfig.directive.startsWith('media:')) {
			setupMediaTrigger(element, parsedConfig.directive.slice(6));
		} else {
			// Default: hydrate immediately with on:client behavior
			hydrateElement(element);
		}
	});
}

/**
 * Parses hydration directive and options from condition string
 *
 * Supported syntax:
 * - on:client
 * - on:visible (uses defaults: rootMargin: '50px', threshold: 0)
 * - on:visible={{rootMargin: "100px"}}
 * - on:visible={{rootMargin: "50px", threshold: 0.5}}
 * - on:idle (uses defaults: timeout: 5000)
 * - on:idle={{timeout: 10000}}
 * - on:interaction
 * - media:query
 *
 * @param {string} condition - The directive condition string
 * @returns {Object} Parsed configuration with directive and options
 */
function parseHydrationDirective(condition) {
	if (!condition || typeof condition !== 'string') {
		console.warn(`⚠️ Invalid hydration condition: "${condition}", defaulting to on:client`);
		return { directive: 'on:client', options: {} };
	}

	// Extract directive name (everything before the first '=' or the whole string)
	const directiveMatch = condition.match(/^([^=\s]+)/);
	if (!directiveMatch) {
		console.warn(`⚠️ Could not parse directive from: "${condition}", defaulting to on:client`);
		return { directive: 'on:client', options: {} };
	}

	const directive = directiveMatch[1];

	// Parse options if present
	let options = {};

	try {
		// Check for options syntax like directive={{key: value, key2: value2}}
		const optionsMatch = condition.match(/=\s*\{\{(.+?)\}\}/);
		if (optionsMatch) {
			const optionsString = optionsMatch[1];
			options = parseDirectiveOptions(optionsString, directive);
		}
	} catch (error) {
		console.warn(`⚠️ Failed to parse options from "${condition}":`, error);
		options = {};
	}

	// Apply defaults and validation based on directive type
	options = applyDirectiveDefaults(directive, options);

	console.log(`🔍 Parsed directive: "${directive}" with options:`, options);

	return { directive, options };
}

/**
 * Parses options string into an object
 * @param {string} optionsString - The options string to parse
 * @param {string} directive - The directive name for context in error messages
 * @returns {Object} Parsed options object
 */
function parseDirectiveOptions(optionsString, directive) {
	if (!optionsString || !optionsString.trim()) {
		return {};
	}

	try {
		// Handle both quoted and unquoted property names
		const normalizedOptions = optionsString
			.replace(/(\w+):/g, '"$1":') // Add quotes around property names
			.replace(/'/g, '"'); // Convert single quotes to double quotes

		const parsedOptions = JSON.parse(`{${normalizedOptions}}`);
		console.log(`🔧 Successfully parsed options for ${directive}:`, parsedOptions);
		return parsedOptions;
	} catch (error) {
		console.warn(`⚠️ Failed to parse options string "${optionsString}" for ${directive}:`, error);
		return {};
	}
}

/**
 * Applies default values and validates options based on directive type
 * @param {string} directive - The directive name
 * @param {Object} options - The parsed options
 * @returns {Object} Options with defaults applied and validation performed
 */
function applyDirectiveDefaults(directive, options) {
	switch (directive) {
		case 'on:visible':
			return applyVisibilityDefaults(options);
		case 'on:idle':
			return applyIdleDefaults(options);
		case 'on:interaction':
			return applyInteractionDefaults(options);
		default:
			return options;
	}
}

/**
 * Applies defaults and validation for on:visible directive
 * @param {Object} options - The parsed options
 * @returns {Object} Validated options with defaults
 */
function applyVisibilityDefaults(options) {
	const defaults = {
		rootMargin: '50px',
		threshold: 0,
	};

	const result = { ...defaults };

	if (options.rootMargin !== undefined) {
		if (validateRootMargin(options.rootMargin)) {
			result.rootMargin = options.rootMargin;
		} else {
			console.warn(`⚠️ Invalid rootMargin value "${options.rootMargin}", using default "${defaults.rootMargin}"`);
		}
	}

	if (options.threshold !== undefined) {
		if (validateThreshold(options.threshold)) {
			result.threshold = options.threshold;
		} else {
			console.warn(`⚠️ Invalid threshold value "${options.threshold}", using default ${defaults.threshold}`);
		}
	}

	return result;
}

/**
 * Applies defaults and validation for on:idle directive
 * @param {Object} options - The parsed options
 * @returns {Object} Validated options with defaults
 */
function applyIdleDefaults(options) {
	const defaults = {
		timeout: 5000, // 5 seconds
	};

	const result = { ...defaults };

	if (options.timeout !== undefined) {
		if (validateTimeout(options.timeout)) {
			result.timeout = options.timeout;
		} else {
			console.warn(`⚠️ Invalid timeout value "${options.timeout}", using default ${defaults.timeout}ms`);
		}
	}

	return result;
}

/**
 * Applies defaults and validation for on:interaction directive
 * @param {Object} options - The parsed options
 * @returns {Object} Validated options with defaults
 */
function applyInteractionDefaults(options) {
	const defaults = {
		events: ['click', 'touchstart', 'mouseover', 'focus'],
	};

	const result = { ...defaults };

	if (options.events !== undefined) {
		if (validateInteractionEvents(options.events)) {
			result.events = Array.isArray(options.events) ? options.events : [options.events];
		} else {
			console.warn(`⚠️ Invalid events value "${options.events}", using default events`);
		}
	}

	return result;
}

/**
 * Validates threshold value for Intersection Observer
 * @param {*} threshold - The threshold value to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateThreshold(threshold) {
	return typeof threshold === 'number' && threshold >= 0 && threshold <= 1;
}

/**
 * Validates timeout value for idle hydration
 * @param {*} timeout - The timeout value to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateTimeout(timeout) {
	return typeof timeout === 'number' && timeout > 0 && timeout <= 60000; // Max 60 seconds
}

/**
 * Validates interaction events array
 * @param {*} events - The events to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateInteractionEvents(events) {
	if (typeof events === 'string') {
		return true; // Single event name
	}

	if (Array.isArray(events)) {
		return events.every(event => typeof event === 'string' && event.length > 0);
	}

	return false;
}

/**
 * Validates rootMargin value according to CSS margin syntax
 *
 * Valid formats:
 * - "10px" (single value)
 * - "10px 20px" (vertical horizontal)
 * - "10px 20px 30px" (top horizontal bottom)
 * - "10px 20px 30px 40px" (top right bottom left)
 * - Can use px, %, or just numbers (treated as px)
 * - Supports negative values
 *
 * @param {string} rootMargin - The rootMargin value to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateRootMargin(rootMargin) {
	if (typeof rootMargin !== 'string') {
		return false;
	}

	// Valid rootMargin formats:
	// - "10px" (single value)
	// - "10px 20px" (vertical horizontal)
	// - "10px 20px 30px" (top horizontal bottom)
	// - "10px 20px 30px 40px" (top right bottom left)
	// - Can use px, %, or just numbers (treated as px)
	const rootMarginRegex = /^(-?\d+(?:\.\d+)?(?:px|%)?(?:\s+-?\d+(?:\.\d+)?(?:px|%)?){0,3})$/;
	return rootMarginRegex.test(rootMargin.trim());
}

function setupVisibilityTrigger(element, options = {}) {
	// Use provided options or defaults
	const visibilityOptions = {
		rootMargin: '50px',
		threshold: 0,
		...options,
	};

	console.log(`👁️ Setting up visibility trigger with options:`, visibilityOptions);

	const observer = new IntersectionObserver(
		entries => {
			const entry = entries[0];
			if (entry.isIntersecting) {
				console.log(`👁️ Element became visible, hydrating...`);
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
}

function setupInteractionTrigger(element, options = {}) {
	// Use provided options or defaults
	const interactionOptions = {
		events: ['click', 'touchstart', 'mouseover', 'focus'],
		...options,
	};

	console.log(`🖱️ Setting up interaction trigger with events:`, interactionOptions.events);

	const handleInteraction = () => {
		console.log(`🖱️ Interaction detected, hydrating...`);
		hydrateElement(element);
		interactionOptions.events.forEach(eventType => {
			element.removeEventListener(eventType, handleInteraction);
		});
	};

	interactionOptions.events.forEach(eventType => {
		element.addEventListener(eventType, handleInteraction, { once: true });
	});
}

// Queue for managing multiple components using on:idle
const idleQueue = [];
let isProcessingIdleQueue = false;
let idleTimeoutId = null;
const DEFAULT_IDLE_TIMEOUT = 5000; // 5 seconds fallback timeout

function setupIdleTrigger(element, options = {}) {
	// Use provided options or defaults
	const idleOptions = {
		timeout: DEFAULT_IDLE_TIMEOUT,
		...options,
	};

	console.log(`⏳ Setting up idle trigger with timeout: ${idleOptions.timeout}ms`);

	// Add element and its options to the idle queue
	idleQueue.push({ element, options: idleOptions });
	console.log(`📋 Added component to idle queue. Queue length: ${idleQueue.length}`);

	// Start processing the queue if not already started
	if (!isProcessingIdleQueue) {
		processIdleQueue();
	}
}

function processIdleQueue() {
	if (isProcessingIdleQueue || idleQueue.length === 0) {
		return;
	}

	isProcessingIdleQueue = true;
	console.log(`⏳ Starting to process idle queue with ${idleQueue.length} components`);

	// Calculate the maximum timeout from all queued components
	const maxTimeout = Math.max(...idleQueue.map(item => item.options.timeout), DEFAULT_IDLE_TIMEOUT);
	console.log(`⏳ Using maximum timeout of ${maxTimeout}ms for idle processing`);

	// Clear any existing timeout
	if (idleTimeoutId) {
		clearTimeout(idleTimeoutId);
		idleTimeoutId = null;
	}

	if (globalThis.requestIdleCallback) {
		console.log('🔄 Using requestIdleCallback for idle hydration');
		// Use requestIdleCallback with proper options
		globalThis.requestIdleCallback(
			deadline => {
				hydrateIdleComponents(deadline);
			},
			{ timeout: maxTimeout }
		);
	} else {
		console.log('⚠️ requestIdleCallback not supported, falling back to load event');
		// Fallback to document load event when requestIdleCallback is not supported
		if (document.readyState === 'complete') {
			// Document already loaded, process immediately
			console.log('📄 Document already loaded, processing immediately');
			hydrateIdleComponents();
		} else {
			// Wait for document load
			console.log('📄 Waiting for document load event');
			const handleLoad = () => {
				console.log('📄 Document loaded, processing idle components');
				hydrateIdleComponents();
				globalThis.removeEventListener('load', handleLoad);
			};
			globalThis.addEventListener('load', handleLoad);
		}
	}

	// Set timeout as final fallback in case browser never becomes idle
	idleTimeoutId = setTimeout(() => {
		console.warn(`⚠️ Idle timeout reached (${maxTimeout}ms), hydrating remaining on:idle components`);
		hydrateIdleComponents();
	}, maxTimeout);
}

function hydrateIdleComponents(deadline) {
	// Clear the timeout since we're now processing
	if (idleTimeoutId) {
		clearTimeout(idleTimeoutId);
		idleTimeoutId = null;
	}

	// Process components from the queue
	while (idleQueue.length > 0) {
		// If we have a deadline and time is running out, schedule next batch
		if (deadline && deadline.timeRemaining() <= 1) {
			// Calculate timeout for next batch
			const remainingTimeouts = idleQueue.map(item => item.options.timeout);
			const nextTimeout = Math.max(...remainingTimeouts, DEFAULT_IDLE_TIMEOUT);

			// Schedule next batch
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
			console.log(`⏳ Hydrating idle component with timeout ${queueItem.options.timeout}ms`);
			hydrateElement(queueItem.element);
		} catch (error) {
			console.error('Error hydrating idle component:', error);
		}
	}

	// Reset processing flag when queue is empty
	isProcessingIdleQueue = false;
	console.log(`✅ Finished processing idle queue`);
}

function setupMediaTrigger(element, mediaQuery) {
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
		// Parse props
		const props = propsAttr ? JSON.parse(propsAttr) : {};

		// Check if component is marked for SSR-only rendering
		if (renderStrategy === 'ssr-only') {
			console.log(`📄 Component ${src} is configured for SSR-only rendering, skipping hydration`);
			return;
		}

		// Attempt to detect if component needs hydration by analyzing its content
		const shouldHydrate = await determineHydrationStrategy(src, framework, element);

		if (!shouldHydrate.shouldHydrate) {
			console.log(`📄 ${shouldHydrate.reason}, skipping hydration for: ${src}`);
			if (shouldHydrate.warnings) {
				shouldHydrate.warnings.forEach(warning => console.warn(`⚠️ ${warning}`));
			}
			return;
		}

		// Universal hydration approach - all components should have self-contained hydrate functions
		const componentModule = await import(src);

		if (componentModule.hydrate && typeof componentModule.hydrate === 'function') {
			console.log(`🔄 Hydrating ${framework || 'component'}: ${src} (${shouldHydrate.reason})`);
			componentModule.hydrate(element, props);
			console.log(`✅ Successfully hydrated: ${src}`);
		} else {
			// Handle components without hydrate functions more gracefully
			await handleComponentWithoutHydrate(src, framework, element, componentModule, shouldHydrate);
		}
	} catch (error) {
		console.error(`Failed to hydrate island ${src}:`, error);
	}
}

/**
 * Determines if a component should be hydrated based on various factors
 */
async function determineHydrationStrategy(src, framework, element) {
	// Check for explicit SSR-only markers
	if (element.hasAttribute('data-ssr-only') || element.classList.contains('ssr-only')) {
		return {
			shouldHydrate: false,
			reason: 'Component explicitly marked for SSR-only rendering',
		};
	}

	// For client-side detection, we'll make a best-effort attempt
	// In a full implementation, this would integrate with the server-side component detection
	try {
		// Try to load the component and check if it has a hydrate function
		const componentModule = await import(src);

		if (componentModule.hydrate && typeof componentModule.hydrate === 'function') {
			return {
				shouldHydrate: true,
				reason: 'Component has hydrate function',
			};
		}

		// Check for framework-specific patterns that indicate interactivity
		const hasInteractivePatterns = await checkForInteractivePatterns(src, framework);

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
		// If we can't load the component, default to attempting hydration
		return {
			shouldHydrate: true,
			reason: 'Unable to analyze component, defaulting to hydration attempt',
			warnings: [`Component analysis failed: ${error.message}`],
		};
	}
}

/**
 * Checks for interactive patterns in component source (simplified client-side version)
 */
async function checkForInteractivePatterns(src, framework) {
	try {
		// This is a simplified check - in practice, the server would do the heavy lifting
		// and pass the result via data attributes

		// For now, we'll use some heuristics based on framework
		switch (framework) {
			case 'svelte':
				// Svelte components with event handlers or reactive statements are likely interactive
				return src.includes('on:') || src.includes('$:');

			case 'vue':
				// Vue components with event handlers or reactive data are likely interactive
				return src.includes('@') || src.includes('v-on') || src.includes('reactive');

			case 'solid':
				// Solid components with signals or event handlers are likely interactive
				return src.includes('createSignal') || src.includes('onClick');

			default:
				// For unknown frameworks, assume interactive if it's not explicitly marked as static
				return true;
		}
	} catch (error) {
		// If analysis fails, assume interactive for safety
		return true;
	}
}

/**
 * Handles components that don't have hydrate functions more gracefully
 */
async function handleComponentWithoutHydrate(src, framework, element, componentModule, hydrationDecision) {
	// Log the situation clearly for debugging
	console.log(`📋 Component analysis for ${src}:`);
	console.log(`  Framework: ${framework || 'unknown'}`);
	console.log(`  Has hydrate function: false`);
	console.log(`  Decision: ${hydrationDecision.reason}`);

	if (hydrationDecision.warnings) {
		hydrationDecision.warnings.forEach(warning => {
			console.warn(`  ⚠️ ${warning}`);
		});
	}

	// Special handling for Solid components that still use the old system
	if (framework === 'solid' || element.hasAttribute('data-solid-hydrate')) {
		console.log(`🔄 Attempting Solid.js legacy hydration for: ${src}`);
		try {
			const _solidHydration = await import('./solid-hydration.js');
			// Solid hydration handles its own component import
			console.log(`✅ Solid.js legacy hydration completed for: ${src}`);
		} catch (error) {
			console.warn(`⚠️ Solid.js legacy hydration failed for ${src}:`, error.message);
		}
	} else {
		// For other frameworks, provide informative feedback instead of errors
		console.warn(`⚠️ Component ${src} has no hydrate function.`);
		console.warn(`   This component will remain as static SSR content.`);
		console.warn(`   If interactivity is needed, add a hydrate function to the component.`);
		console.warn(`   If this is intentional (static content), consider marking it with data-ssr-only.`);
	}
}

// HMR support for development
if (import.meta.hot) {
	import.meta.hot.accept();
}
