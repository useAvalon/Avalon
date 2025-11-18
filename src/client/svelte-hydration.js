// Dedicated Svelte client hydration system
// Handles Svelte 5 component hydration with proper mount/hydrate decision logic

import { mount, hydrate } from 'svelte';

/**
 * Hydrate a Svelte component in the given element
 * Automatically decides between mount (empty container) and hydrate (SSR content)
 */
export async function hydrateSvelteComponent(element, Component, props = {}) {
	const src = element.getAttribute('data-hydrate');
	const logPrefix = `🔄 [Svelte:${src}]`;

	console.log(`${logPrefix} Starting Svelte hydration...`, {
		hasProps: !!props,
		propsKeys: Object.keys(props),
		elementId: element.id,
	});

	// Detect if element has existing SSR content or is empty
	const hasSSRContent = detectSSRContent(element);
	console.log(`${logPrefix} SSR content detection:`, {
		hasSSRContent,
		innerHTML: element.innerHTML.length,
	});

	try {
		if (hasSSRContent) {
			// Use Svelte 5's hydrate function for existing SSR content
			console.log(`${logPrefix} Hydrating component (existing SSR content)...`);

			// For Svelte 5, find the actual component container within the island
			let targetElement = element;
			const componentDiv = element.querySelector('[data-svelte-component]');
			if (componentDiv) {
				console.log(`${logPrefix} Found component container, using it as target`);
				targetElement = componentDiv;
			}

			const app = hydrate(Component, {
				target: targetElement,
				props,
			});

			console.log(`${logPrefix} ✅ Hydration successful`);
			return app;
		} else {
			// Use Svelte 5's mount function for empty containers
			console.log(`${logPrefix} Mounting component (empty container)...`);

			const app = mount(Component, {
				target: element,
				props,
			});

			console.log(`${logPrefix} ✅ Mount successful`);
			return app;
		}
	} catch (error) {
		console.error(`${logPrefix} ❌ Primary hydration/mount failed:`, error);

		// If hydration fails, try mounting as fallback
		if (hasSSRContent) {
			console.warn(`${logPrefix} Attempting mount fallback...`);
			try {
				// Clear the element and mount fresh
				element.innerHTML = '';
				const app = mount(Component, {
					target: element,
					props,
				});
				console.log(`${logPrefix} ✅ Mount fallback successful`);
				return app;
			} catch (mountError) {
				console.error(`${logPrefix} ❌ Mount fallback also failed:`, mountError);
				throw mountError;
			}
		} else {
			throw error;
		}
	}
}

/**
 * Detect if an element has existing SSR content vs being an empty container
 */
function detectSSRContent(element) {
	// Check if element has any meaningful content
	const hasTextContent = element.textContent && element.textContent.trim().length > 0;
	const hasChildElements = element.children && element.children.length > 0;
	const hasAttributes = element.hasAttribute('data-ssr-content') || element.hasAttribute('data-svelte-rendered');

	// Consider it SSR content if it has text, child elements, or explicit markers
	return hasTextContent || hasChildElements || hasAttributes;
}

/**
 * Create a hydrate function for a Svelte component
 * This is the function that should be exported from Svelte island components
 */
export function createSvelteHydrate(Component) {
	return async function hydrate(element, props = {}) {
		return await hydrateSvelteComponent(element, Component, props);
	};
}

// Export Svelte runtime functions for direct use if needed
export { mount, hydrate };
