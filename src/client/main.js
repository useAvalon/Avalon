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

		const componentModule = await importWithFallback(src, framework);

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
		handleHydrationError(element, src, framework, error);
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
		const componentModule = await importWithFallback(src, framework);

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
				warnings: [`Component ${src} (${framework}) has no hydrate function and no interactive patterns detected`],
			};
		}

		return {
			shouldHydrate: true,
			reason: 'Component has interactive patterns but no hydrate function, proceeding with caution',
			warnings: [`Component ${src} (${framework}) appears interactive but lacks proper hydrate function`],
		};
	} catch (error) {
		return {
			shouldHydrate: true,
			reason: 'Unable to analyze component, defaulting to hydration attempt',
			warnings: [`Component analysis failed for ${src} (${framework}): ${error.message}`],
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

/**
 * Import module with fallback mechanism for failed dependency loads
 * Handles port-specific imports and provides retry logic
 */
async function importWithFallback(src, framework, retryCount = 0) {
	const maxRetries = 3;
	const baseDelay = 100; // Base delay in ms
	
	try {
		// Ensure the import path uses the correct base URL
		const resolvedSrc = resolveImportPath(src);
		console.log(`🔄 Importing module: ${resolvedSrc} (${framework}) (attempt ${retryCount + 1})`);
		
		return await import(resolvedSrc);
	} catch (error) {
		const errorDetails = getImportErrorDetails(error, src, framework, resolvedSrc);
		console.warn(`⚠️ Import failed for ${src} (${framework}) (attempt ${retryCount + 1}):`, errorDetails);
		
		if (retryCount < maxRetries) {
			// Exponential backoff with jitter
			const delay = baseDelay * Math.pow(2, retryCount) + Math.random() * 100;
			console.log(`🔄 Retrying import in ${delay}ms...`);
			
			await new Promise(resolve => setTimeout(resolve, delay));
			return importWithFallback(src, framework, retryCount + 1);
		}
		
		// Try alternative import strategies
		if (retryCount === maxRetries) {
			console.log(`🔄 Trying alternative import strategies for ${src} (${framework})...`);
			return tryAlternativeImport(src, framework);
		}
		
		throw new Error(`Failed to import ${src} (${framework}) after ${maxRetries + 1} attempts: ${errorDetails.message}`);
	}
}

/**
 * Resolve import path to use correct base URL for the current environment
 */
function resolveImportPath(src) {
	// If it's already an absolute URL, return as-is
	if (src.startsWith('http://') || src.startsWith('https://')) {
		return src;
	}
	
	// For relative paths, ensure they work with the proxy setup
	if (src.startsWith('./') || src.startsWith('../')) {
		return src;
	}
	
	// For absolute paths starting with /, ensure they go through the main server
	// which will proxy to Vite if needed
	if (src.startsWith('/')) {
		return src;
	}
	
	// For bare module names or other paths, prefix with /
	return `/${src}`;
}

/**
 * Get detailed error information for import failures
 */
function getImportErrorDetails(error, originalSrc, framework, resolvedSrc) {
	const details = {
		message: error.message,
		originalPath: originalSrc,
		resolvedPath: resolvedSrc,
		framework: framework,
		errorType: 'unknown',
		suggestions: []
	};
	
	// Analyze error type and provide specific suggestions
	if (error.message.includes('404') || error.message.includes('Not Found')) {
		details.errorType = 'not_found';
		details.suggestions = [
			`Check if the file exists at: ${resolvedSrc}`,
			`Verify the Vite dev server is running on the correct port`,
			`Ensure the file has the correct extension (.tsx, .jsx, .js)`
		];
	} else if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
		details.errorType = 'cors';
		details.suggestions = [
			`CORS issue detected - check server configuration`,
			`Verify Vite server CORS settings allow requests from main server`,
			`Check if ports are configured correctly (main server vs Vite server)`
		];
	} else if (error.message.includes('timeout') || error.message.includes('network')) {
		details.errorType = 'network';
		details.suggestions = [
			`Network timeout - check if Vite dev server is responsive`,
			`Verify server connectivity between main server and Vite server`,
			`Check for firewall or network issues`
		];
	} else if (error.message.includes('SyntaxError') || error.message.includes('parse')) {
		details.errorType = 'syntax';
		details.suggestions = [
			`Syntax error in ${framework} component`,
			`Check for compilation errors in the source file`,
			`Verify ${framework} component syntax is correct`
		];
	} else if (error.message.includes('dependency') || error.message.includes('module')) {
		details.errorType = 'dependency';
		details.suggestions = [
			`Missing dependency for ${framework} framework`,
			`Check if ${framework} is properly installed`,
			`Verify Vite dependency optimization includes ${framework} modules`
		];
	}
	
	return details;
}

/**
 * Try alternative import strategies when standard import fails
 */
async function tryAlternativeImport(src, framework) {
	const alternatives = [
		// Try with explicit .js extension
		src.endsWith('.js') ? src : `${src}.js`,
		// Try with .tsx extension for TypeScript components
		src.endsWith('.tsx') ? src : `${src}.tsx`,
		// Try with framework-specific extensions
		framework === 'svelte' && !src.endsWith('.svelte') ? `${src}.svelte` : null,
		framework === 'vue' && !src.endsWith('.vue') ? `${src}.vue` : null,
	].filter(Boolean);
	
	const errors = [];
	
	for (const altSrc of alternatives) {
		try {
			console.log(`🔄 Trying alternative import: ${altSrc} (${framework})`);
			return await import(resolveImportPath(altSrc));
		} catch (error) {
			const errorDetails = getImportErrorDetails(error, altSrc, framework, resolveImportPath(altSrc));
			console.warn(`⚠️ Alternative import failed: ${altSrc} (${framework})`, errorDetails);
			errors.push({ src: altSrc, error: errorDetails });
		}
	}
	
	// Create comprehensive error message with all attempts
	const errorMessage = `All import strategies failed for ${src} (${framework}):\n` +
		errors.map(e => `  - ${e.src}: ${e.error.message}`).join('\n') +
		`\n\nSuggestions:\n` +
		[...new Set(errors.flatMap(e => e.error.suggestions))].map(s => `  - ${s}`).join('\n');
	
	throw new Error(errorMessage);
}

/**
 * Handle hydration errors with graceful degradation
 */
function handleHydrationError(element, src, framework, error) {
	const errorId = `hydration-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	
	// Log comprehensive error information
	console.group(`❌ Hydration Error [${errorId}]`);
	console.error(`Component: ${src} (${framework})`);
	console.error(`Element:`, element);
	console.error(`Error:`, error);
	
	// Log element context for debugging
	const elementInfo = {
		tagName: element.tagName,
		className: element.className,
		id: element.id,
		attributes: Array.from(element.attributes).reduce((acc, attr) => {
			acc[attr.name] = attr.value;
			return acc;
		}, {}),
		innerHTML: element.innerHTML.substring(0, 200) + (element.innerHTML.length > 200 ? '...' : '')
	};
	console.error(`Element Info:`, elementInfo);
	
	// Log current environment info
	const envInfo = {
		isDev: isDevelopment(),
		location: window.location.href,
		userAgent: navigator.userAgent,
		timestamp: new Date().toISOString()
	};
	console.error(`Environment:`, envInfo);
	console.groupEnd();
	
	// Add error class for styling
	element.classList.add('hydration-failed', `hydration-failed-${framework}`);
	element.setAttribute('data-hydration-error-id', errorId);
	
	// Add error indicator for debugging in development
	if (isDevelopment()) {
		const errorIndicator = document.createElement('div');
		errorIndicator.className = 'hydration-error-indicator';
		errorIndicator.style.cssText = `
			position: absolute;
			top: 0;
			right: 0;
			background: #ff4444;
			color: white;
			padding: 2px 6px;
			font-size: 10px;
			border-radius: 0 0 0 4px;
			z-index: 9999;
			pointer-events: auto;
			cursor: pointer;
			font-family: monospace;
		`;
		errorIndicator.textContent = `❌ ${framework}`;
		errorIndicator.title = `Hydration failed for ${src}\nClick for details\nError ID: ${errorId}`;
		
		// Add click handler to show detailed error info
		errorIndicator.addEventListener('click', () => {
			showHydrationErrorDetails(errorId, src, framework, error, elementInfo, envInfo);
		});
		
		// Position relative if not already positioned
		const computedStyle = window.getComputedStyle(element);
		if (computedStyle.position === 'static') {
			element.style.position = 'relative';
		}
		
		element.appendChild(errorIndicator);
	}
	
	// Dispatch custom event for error tracking
	element.dispatchEvent(new CustomEvent('hydration-error', {
		detail: { 
			errorId,
			src, 
			framework, 
			error: error.message,
			stack: error.stack,
			elementInfo,
			envInfo
		},
		bubbles: true
	}));
	
	// Try graceful degradation - keep the SSR content but mark it as static
	element.setAttribute('data-hydration-status', 'failed');
	element.setAttribute('data-render-strategy', 'ssr-only');
}

/**
 * Show detailed hydration error information in development
 */
function showHydrationErrorDetails(errorId, src, framework, error, elementInfo, envInfo) {
	const modal = document.createElement('div');
	modal.style.cssText = `
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.8);
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: monospace;
		font-size: 12px;
	`;
	
	const content = document.createElement('div');
	content.style.cssText = `
		background: #1a1a1a;
		color: #fff;
		padding: 20px;
		border-radius: 8px;
		max-width: 80%;
		max-height: 80%;
		overflow: auto;
		border: 2px solid #ff4444;
	`;
	
	content.innerHTML = `
		<h3 style="color: #ff4444; margin-top: 0;">🚨 Hydration Error Details</h3>
		<p><strong>Error ID:</strong> ${errorId}</p>
		<p><strong>Component:</strong> ${src}</p>
		<p><strong>Framework:</strong> ${framework}</p>
		<p><strong>Error Message:</strong> ${error.message}</p>
		
		<h4 style="color: #ffa500;">Stack Trace:</h4>
		<pre style="background: #2a2a2a; padding: 10px; border-radius: 4px; overflow-x: auto;">${error.stack || 'No stack trace available'}</pre>
		
		<h4 style="color: #ffa500;">Element Information:</h4>
		<pre style="background: #2a2a2a; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(elementInfo, null, 2)}</pre>
		
		<h4 style="color: #ffa500;">Environment:</h4>
		<pre style="background: #2a2a2a; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(envInfo, null, 2)}</pre>
		
		<div style="margin-top: 20px; text-align: center;">
			<button id="close-error-modal" style="
				background: #ff4444;
				color: white;
				border: none;
				padding: 10px 20px;
				border-radius: 4px;
				cursor: pointer;
				font-family: monospace;
			">Close</button>
		</div>
	`;
	
	modal.appendChild(content);
	document.body.appendChild(modal);
	
	// Close modal handlers
	const closeModal = () => document.body.removeChild(modal);
	modal.addEventListener('click', (e) => {
		if (e.target === modal) closeModal();
	});
	content.querySelector('#close-error-modal').addEventListener('click', closeModal);
	
	// Close on Escape key
	const handleKeydown = (e) => {
		if (e.key === 'Escape') {
			closeModal();
			document.removeEventListener('keydown', handleKeydown);
		}
	};
	document.addEventListener('keydown', handleKeydown);
}

/**
 * Check if we're in development mode
 */
function isDevelopment() {
	return import.meta.env?.DEV || 
		   import.meta.env?.MODE === 'development' || 
		   location.hostname === 'localhost' ||
		   location.hostname === '127.0.0.1';
}

// HMR support for development
if (import.meta.hot) {
	import.meta.hot.accept();
}
