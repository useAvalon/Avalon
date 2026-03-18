/**
 * Framework HMR Adapters
 *
 * HMR adapters have been moved to their respective integration packages:
 * - @useavalon/react/client/hmr
 * - @useavalon/preact/client/hmr
 * - @useavalon/vue/client/hmr
 * - @useavalon/svelte/client/hmr
 * - @useavalon/solid/client/hmr
 * - @useavalon/lit/client/hmr
 * - @useavalon/qwik/client/hmr
 *
 * This barrel re-exports from the base framework adapter for backward compatibility.
 */

export {
	BaseFrameworkAdapter,
	AdapterRegistry,
	type FrameworkHMRAdapter,
	type StateSnapshot,
} from '../framework-adapter.ts';
