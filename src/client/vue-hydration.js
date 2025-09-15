// Dedicated Vue client hydration system
// Eliminates the need for hydration boilerplate in each Vue component

class VueIslandHydrator {
	constructor() {
		this.hydratedIslands = new Set();
		this.pendingHydrations = new Map();
	}

	async init() {
		// Wait for DOM to be ready
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', () => this.findAndHydrateIslands());
		} else {
			this.findAndHydrateIslands();
		}
	}

	findAndHydrateIslands() {
		const vueContainers = document.querySelectorAll('[data-vue-hydrate]');

		for (const container of vueContainers) {
			const src = container.getAttribute('data-vue-hydrate');
			const condition = container.getAttribute('data-vue-condition') || 'on:load';

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

		switch (condition) {
			case 'on:client':
			case 'on:load':
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
			console.log(`🏝️ Hydrating Vue island: ${src}`);

			// Mark as hydrated immediately to prevent double hydration
			this.hydratedIslands.add(container);

			// Parse props
			const propsAttr = container.getAttribute('data-vue-props');
			const props = propsAttr ? JSON.parse(propsAttr) : {};

			// Import the Vue component
			const module = await import(src);
			const VueComponent = module.default || module;

			if (!VueComponent) {
				throw new Error(`Invalid Vue component in ${src}`);
			}

			// Import Vue functions
			const { createApp } = await import('vue');

			// Create and mount Vue app
			const app = createApp(VueComponent, props);
			app.mount(container);

			console.log(`✅ Vue island hydrated successfully: ${src}`);
		} catch (error) {
			console.error(`❌ Failed to hydrate Vue island ${src}:`, error);
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

// Initialize Vue hydration system
const vueHydrator = new VueIslandHydrator();
vueHydrator.init();

// HMR support
if (import.meta.hot) {
	import.meta.hot.accept();

	// Re-initialize on HMR
	import.meta.hot.on('vite:afterUpdate', () => {
		vueHydrator.findAndHydrateIslands();
	});
}

export default vueHydrator;
