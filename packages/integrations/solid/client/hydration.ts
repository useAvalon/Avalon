/**
 * Solid client-side hydration
 * Handles hydration of server-rendered Solid components
 *
 * Uses hydrate() for SSR content, render() for client-only
 */

import type { SolidComponent, SolidHydrationOptions } from '../types.ts';

/**
 * Hydrate a server-rendered Solid component
 *
 * Checks for SSR content and uses hydrate() or render() accordingly.
 *
 * @param container - DOM element containing the server-rendered HTML
 * @param Component - Solid component to hydrate
 * @param props - Component props
 * @param _options - Hydration options (unused)
 */
export async function hydrate(
	container: Element,
	Component: SolidComponent,
	props: Record<string, unknown> = {},
	_options: SolidHydrationOptions = {},
): Promise<void> {
	// Validate inputs
	if (!container) {
		throw new Error('Container element is required for hydration');
	}

	if (!Component || typeof Component !== 'function') {
		throw new Error(`Invalid Solid component: expected function, got ${typeof Component}`);
	}

	const element = container as HTMLElement;
	const hasSSRContent = element.children.length > 0 || element.innerHTML.trim().length > 0;

	// Get renderId from dataset
	const renderId = element.dataset.solidRenderId || element.dataset.renderId;

	try {
		const [solidWeb] = await Promise.all([import('solid-js/web'), import('solid-js')]);

		const { hydrate: solidHydrate, render: solidRender, createComponent } = solidWeb;

		if (hasSSRContent && renderId) {
			// SSR content exists with a renderId — use hydrate for proper resumption
			solidHydrate(() => createComponent(Component, props), element, { renderId });
		} else if (hasSSRContent) {
			// SSR content but no renderId — clear and do a fresh render to avoid mismatch
			element.textContent = '';
			solidRender(() => createComponent(Component, props), element);
		} else {
			// No SSR content — client-only render
			solidRender(() => createComponent(Component, props), element);
		}
	} catch (error) {
		// Hydration failed — fall back to client-side render
		element.dataset.hydrationStatus = 'failed';
		const errorMsg = error instanceof Error ? error.message : String(error);
		element.dataset.hydrationError = errorMsg;

		if (process.env.NODE_ENV !== 'production') {
			console.warn(`Solid hydration failed, falling back to client render:`, error);
		}

		// Attempt a clean client-side render as fallback
		try {
			const solidWeb = await import('solid-js/web');
			const { render: solidRender, createComponent } = solidWeb;
			element.textContent = '';
			solidRender(() => createComponent(Component, props), element);
		} catch (fallbackError) {
			if (process.env.NODE_ENV !== 'production') {
				console.error(`Solid fallback render also failed:`, fallbackError);
			}
		}
	}
}

/**
 * Get the hydration script for Solid components
 * This script is injected into the page to enable client-side hydration
 */
export function getHydrationScript(): string {
	return '';
}
