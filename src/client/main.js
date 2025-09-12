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
		const condition = element.getAttribute('data-condition') || 'on:load';

		if (condition === 'on:visible') {
			setupVisibilityTrigger(element);
		} else if (condition === 'on:interaction') {
			setupInteractionTrigger(element);
		} else if (condition === 'on:idle') {
			setupIdleTrigger(element);
		} else if (condition === 'on:client') {
			hydrateElement(element);
		} else if (condition.startsWith('media:')) {
			setupMediaTrigger(element, condition.slice(6));
		} else {
			// Default: hydrate immediately
			hydrateElement(element);
		}
	});
}

function setupVisibilityTrigger(element) {
	const observer = new IntersectionObserver(
		entries => {
			const entry = entries[0];
			if (entry.isIntersecting) {
				hydrateElement(element);
				observer.disconnect();
			}
		},
		{
			threshold: 0,
			rootMargin: '50px',
		}
	);
	observer.observe(element);
}

function setupInteractionTrigger(element) {
	const events = ['click', 'touchstart', 'mouseover', 'focus'];

	const handleInteraction = () => {
		hydrateElement(element);
		events.forEach(eventType => {
			element.removeEventListener(eventType, handleInteraction);
		});
	};

	events.forEach(eventType => {
		element.addEventListener(eventType, handleInteraction, { once: true });
	});
}

function setupIdleTrigger(element) {
	if (window.requestIdleCallback) {
		window.requestIdleCallback(() => hydrateElement(element));
	} else {
		setTimeout(() => hydrateElement(element), 100);
	}
}

function setupMediaTrigger(element, mediaQuery) {
	const mediaQueryList = window.matchMedia(mediaQuery);

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

	if (!src) {
		console.warn('Element missing data-hydrate attribute');
		return;
	}

	try {
		// Parse props
		const props = propsAttr ? JSON.parse(propsAttr) : {};

		// Dynamic import the island module
		const module = await import(src);

		// Call the hydrate function if it exists
		if (module.hydrate) {
			module.hydrate(element, props);
		} else {
			console.warn(`Island ${src} does not export a hydrate function`);
		}
	} catch (error) {
		console.error(`Failed to hydrate island ${src}:`, error);
	}
}

// HMR support for development
if (import.meta.hot) {
	import.meta.hot.accept();
}
