/**
 * Solid client-side hydration
 *
 * Solid's hydrate() requires globalThis._$HY to exist (set up by
 * generateHydrationScript in the <head>). In islands architecture,
 * the script may not have executed yet when the island hydrates.
 *
 * We ensure _$HY exists before calling hydrate(), and fall back
 * to render() if hydration fails.
 */

import type { SolidComponent, SolidHydrationOptions } from '../types.ts';

/**
 * Ensure the Solid hydration context exists on globalThis.
 * This mirrors what generateHydrationScript() sets up.
 */
function ensureHydrationContext(): void {
	if (!(globalThis as any)._$HY) {
		(globalThis as any)._$HY = {
			events: [],
			completed: new WeakSet(),
			r: {},
			fe() {},
		};
	}
}

export async function hydrate(
	container: Element,
	Component: SolidComponent,
	props: Record<string, unknown> = {},
	_options: SolidHydrationOptions = {},
): Promise<void> {
	if (!container) {
		throw new Error('Container element is required for hydration');
	}

	if (!Component || typeof Component !== 'function') {
		throw new Error(`Invalid Solid component: expected function, got ${typeof Component}`);
	}

	const element = container as HTMLElement;
	const hasSSRContent = element.innerHTML.trim().length > 0;
	const renderId = element.dataset.solidRenderId || element.dataset.renderId;

	const solidWeb = await import('solid-js/web');
	const { hydrate: solidHydrate, render: solidRender, createComponent } = solidWeb;

	if (hasSSRContent && renderId) {
		// Ensure _$HY exists before calling solidHydrate
		ensureHydrationContext();

		try {
			solidHydrate(() => createComponent(Component, props), element, { renderId });
			return;
		} catch (error) {
			// Hydration failed — fall back to client render
			if (process.env.NODE_ENV !== 'production') {
				console.warn(`Solid hydration failed, falling back to client render:`, error);
			}
		}
	}

	// No SSR content, no renderId, or hydration failed — clean client render
	element.textContent = '';
	solidRender(() => createComponent(Component, props), element);
}

export function getHydrationScript(): string {
	return '';
}
