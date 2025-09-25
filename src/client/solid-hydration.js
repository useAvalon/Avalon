// Dedicated SolidJS client hydration system
// Based on SolidJS SSR documentation and best practices

class SolidIslandHydrator {
	constructor() {
		this.hydratedIslands = new Set();
		this.pendingHydrations = new Map();
	}

	async init() {
		// Wait for DOM to be ready
		if (document.readyState === 'loading') {
			await document.addEventListener('DOMContentLoaded', () => this.findAndHydrateIslands());
		} else {
			await this.findAndHydrateIslands();
		}
	}

	findAndHydrateIslands() {
		const solidContainers = document.querySelectorAll('[data-solid-hydrate]');

		for (const container of solidContainers) {
			const src = container.getAttribute('data-solid-hydrate');
			const condition = container.getAttribute('data-solid-condition') || 'on:client';

			if (!src || this.hydratedIslands.has(container)) {
				continue;
			}

			// Schedule hydration based on condition
			this.scheduleHydration(container, src, condition);
		}
	}

	scheduleHydration(container, src, condition) {
		const hydrateNow = () => {
			if (this.hydratedIslands.has(container)) return;
			this.hydrateContainer(container, src);
		};

		if (condition === 'on:load') {
			console.warn(
				`⚠️ on:load directive is not implemented and has been ignored. Use on:client for immediate hydration instead.`
			);
			return; // Skip hydration for on:load
		}

		switch (condition) {
			case 'on:client':
				hydrateNow();
				break;

			case 'on:visible':
				this.setupVisibilityTrigger(container, hydrateNow);
				break;

			case 'on:interaction':
				this.setupInteractionTrigger(container, hydrateNow);
				break;

			case 'on:idle':
				this.setupIdleTrigger(hydrateNow);
				break;

			default:
				if (condition.startsWith('media:')) {
					this.setupMediaTrigger(condition.slice(6), hydrateNow);
				} else {
					hydrateNow();
				}
		}
	}

	async hydrateContainer(container, src) {
		if (this.hydratedIslands.has(container)) return;

		try {
			console.log(`🏝️ Hydrating Solid island: ${src}`);

			// Mark as hydrated immediately to prevent double hydration
			this.hydratedIslands.add(container);

			// Parse props
			const propsAttr = container.getAttribute('data-solid-props');
			const props = propsAttr ? JSON.parse(propsAttr) : {};

			// Import the island component
			console.log(`🔄 Importing Solid module: ${src}`);
			const module = await import(src);
			const SolidComponent = module.default || module;

			if (!SolidComponent || typeof SolidComponent !== 'function') {
				throw new Error(`Invalid Solid component in ${src}`);
			}

			// Import SolidJS hydrate function - resolved during build
			const { hydrate } = await import('solid-js/web');

			// Hydrate the component directly into the container
			hydrate(() => SolidComponent(props), container);

			console.log(`✅ Solid island hydrated successfully: ${src}`);
		} catch (error) {
			console.error(`❌ Failed to hydrate Solid island ${src}:`, error);
			this.hydratedIslands.delete(container); // Allow retry
		}
	}

	setupVisibilityTrigger(container, callback) {
		const observer = new IntersectionObserver(
			entries => {
				const entry = entries[0];
				if (entry.isIntersecting) {
					callback();
					observer.disconnect();
				}
			},
			{ threshold: 0, rootMargin: '100px' }
		);
		observer.observe(container);
	}

	setupInteractionTrigger(container, callback) {
		const events = ['click', 'touchstart', 'mouseover'];

		const handleInteraction = () => {
			callback();
			events.forEach(event => container.removeEventListener(event, handleInteraction));
		};

		events.forEach(event => container.addEventListener(event, handleInteraction, { once: true }));
	}

	setupIdleTrigger(callback) {
		if (globalThis.requestIdleCallback) {
			globalThis.requestIdleCallback(callback);
		} else {
			setTimeout(callback, 200);
		}
	}

	setupMediaTrigger(mediaQuery, callback) {
		const mediaList = globalThis.matchMedia(mediaQuery);

		if (mediaList.matches) {
			callback();
			return;
		}

		const handleMediaChange = event => {
			if (event.matches) {
				callback();
				mediaList.removeEventListener('change', handleMediaChange);
			}
		};

		mediaList.addEventListener('change', handleMediaChange);
	}
}

// Initialize SolidJS hydration system
const solidHydrator = new SolidIslandHydrator();
solidHydrator.init();

// HMR support
if (import.meta.hot) {
	import.meta.hot.accept();

	// Re-initialize on HMR
	import.meta.hot.on('vite:afterUpdate', () => {
		solidHydrator.findAndHydrateIslands();
	});
}

export default solidHydrator;
