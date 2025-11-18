/**
 * Client-side entry point for SvelteCounter
 * This file provides the hydrate function for client-side hydration
 */

import SvelteCounterComponent from './SvelteCounter.svelte';
import { hydrateSvelteComponent } from '../../../src/client/svelte-hydration.js';

// Export the component as default
export default SvelteCounterComponent;

// Export hydrate function for client-side hydration
export async function hydrate(element: HTMLElement, props: Record<string, unknown> = {}) {
	return await hydrateSvelteComponent(element, SvelteCounterComponent, props);
}
