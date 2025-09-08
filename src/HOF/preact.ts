import type { ComponentMetadata } from '../schemas/core.ts';
import type { PreactComponentFunction, PreactComponentWithMetadata } from '../schemas/frameworks.ts';

/**
 * Adds import metadata to a Preact component for island architecture
 *
 * This function annotates Preact components with the imports they need,
 * allowing the island system to load the necessary dependencies when
 * the component is hydrated on the client.
 *
 * @param options - Configuration options including imports and display name
 * @returns A function that wraps a Preact component and adds import metadata
 *
 * @example
 * ```tsx
 * // Direct usage
 * const Counter = withImports({
 *   imports: [{ names: ['formatNumber'], from: '../utils/format.ts' }]
 * })(() => {
 *   const [count, setCount] = useState(0);
 *   return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
 * });
 *
 * // Detached pattern with helper
 * const withStore = (imports: string[]) => withImports({
 *   imports: imports.map(name => from([name], 'store/client-store.ts'))
 * });
 *
 * const DealAlertsComponent = withStore(['addTrackedTrip'])(() => {
 *   return <div>Deal alerts content</div>;
 * });
 * ```
 */
export function withImports(
	options: ComponentMetadata = {}
): <ComponentType extends PreactComponentFunction>(
	component: ComponentType
) => ComponentType & PreactComponentWithMetadata {
	return function <ComponentType extends PreactComponentFunction>(
		component: ComponentType
	): ComponentType & PreactComponentWithMetadata {
		// Add import metadata to the component
		const annotated = component as ComponentType & PreactComponentWithMetadata;

		// Add imports from options or use empty array
		annotated.imports = options.imports || [];

		// Use component name or fallback to anonymous
		annotated.displayName = component.name || 'AnonymousComponent';

		return annotated;
	};
}
