import type { ComponentMetadata } from '../schemas/core.ts';
import type { VueComponentWithMetadata, VueSFCPath, VueComponentFunction } from '../schemas/frameworks.ts';

/**
 * Adds import metadata to a Vue component for island architecture
 *
 * This function annotates Vue components with the imports they need,
 * allowing the island system to load the necessary dependencies when
 * the component is hydrated on the client.
 *
 * @param options - Configuration options including imports and display name
 * @returns A function that wraps a Vue component and adds import metadata
 *
 * @example
 * ```ts
 * // Direct usage
 * const Counter = withImports({
 *   imports: [{ names: ['formatNumber'], from: '../utils/format.ts' }]
 * })(() => ({
 *   setup() {
 *     const count = ref(0);
 *     const increment = () => count.value++;
 *     return { count, increment };
 *   },
 *   template: '<button @click="increment">Count: {{count}}</button>'
 * }));
 *
 * // Detached pattern with helper
 * const withStore = (imports: string[]) => withImports({
 *   imports: imports.map(name => from([name], 'store/client-store.ts'))
 * });
 *
 * const ProductList = withStore(['getProducts'])(() => ({
 *   template: '<div>Product list content</div>'
 * }));
 * ```
 */
export function withImports(
	options: ComponentMetadata = {}
): <ComponentType extends VueComponentFunction>(component: ComponentType) => ComponentType & VueComponentWithMetadata {
	return function <ComponentType extends VueComponentFunction>(
		component: ComponentType
	): ComponentType & VueComponentWithMetadata {
		// Add import metadata to the component
		const annotated = component as ComponentType & VueComponentWithMetadata;

		// Add imports from options or use empty array
		annotated.imports = options.imports || [];

		// Use component name or fallback to anonymous
		annotated.displayName = component.name || 'AnonymousComponent';

		return annotated;
	};
}

/**
 * Creates a reference to a Vue Single File Component (.vue file)
 * for runtime compilation and loading
 *
 * @param path - Path to the .vue file (relative to the application root)
 * @param options - Optional metadata including imports for client-side availability
 * @returns A VueSFCPath object that can be used in Vue islands
 *
 * @example
 * ```ts
 * import { vueSFC, Island, from } from '@avalon/islands/vue';
 *
 * // Reference a .vue file without imports
 * const Counter = vueSFC('./components/Counter.vue');
 *
 * // Reference a .vue file with client-side imports
 * const DestinationCard = vueSFC('./components/DestinationCard.vue', {
 *   imports: [from(['addTrackedTrip'], 'store/client-store.ts')]
 * });
 *
 * // Use in island
 * export default function MyPage() {
 *   return <Island component={DestinationCard} props={{ destination: data }} />;
 * }
 * ```
 */
export function vueSFC(
	path: string,
	options: ComponentMetadata = {}
): VueSFCPath & { imports?: ComponentMetadata['imports'] } {
	if (!path.endsWith('.vue')) {
		throw new Error(`vueSFC() requires a .vue file path, got: ${path}`);
	}

	return {
		__vueSFC: true,
		path: path,
		imports: options.imports,
	};
}
