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
		const condition = element.getAttribute('data-island') || element.getAttribute('data-condition') || 'on:load';

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
	if (globalThis.requestIdleCallback) {
		globalThis.requestIdleCallback(() => hydrateElement(element));
	} else {
		setTimeout(() => hydrateElement(element), 100);
	}
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

	if (!src) {
		console.warn('Element missing data-hydrate attribute');
		return;
	}

	try {
		// Parse props
		const props = propsAttr ? JSON.parse(propsAttr) : {};

		// Universal hydration approach - all components should have self-contained hydrate functions
		const componentModule = await import(src);

		if (componentModule.hydrate && typeof componentModule.hydrate === 'function') {
			console.log(`🔄 Hydrating ${framework || 'component'}: ${src}`);
			componentModule.hydrate(element, props);
			console.log(`✅ Successfully hydrated: ${src}`);
		} else {
			// For legacy components without self-contained hydrate functions
			console.warn(`⚠️ Component ${src} missing hydrate function. Consider adding self-contained hydration.`);

			// Special handling for Solid components that still use the old system
			if (framework === 'solid' || element.hasAttribute('data-solid-hydrate')) {
				const solidHydration = await import('./solid-hydration.js');
				// Solid hydration handles its own component import
			} else {
				console.error(`❌ Cannot hydrate ${src} - no hydrate function found`);
			}
		}
	} catch (error) {
		console.error(`Failed to hydrate island ${src}:`, error);
	}
}

// HMR support for development
if (import.meta.hot) {
	import.meta.hot.accept();
}
