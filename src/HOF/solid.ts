import type { JSX } from 'preact';
import type { ComponentMetadata } from '../schemas/core.ts';
import type { SolidComponentFunction, SolidComponentWithMetadata } from '../schemas/frameworks.ts';

/**
 * Adds import metadata to a Solid component for island architecture
 *
 * This function annotates Solid components with the imports they need,
 * allowing the island system to load the necessary dependencies when
 * the component is hydrated on the client.
 *
 * @param options - Configuration options including imports and display name
 * @returns A function that wraps a Solid component and adds import metadata
 *
 * @example
 * ```ts
 * // Direct usage
 * const Counter = withImports({
 *   imports: [{ names: ['formatNumber'], from: '../utils/format.ts' }]
 * })(() => {
 *   const [count, setCount] = createSignal(0);
 *   return () => <button onClick={() => setCount(count() + 1)}>Count: {count()}</button>;
 * });
 *
 * // Detached pattern with helper
 * const withStore = (imports: string[]) => withImports({
 *   imports: imports.map(name => from([name], 'store/client-store.ts'))
 * });
 *
 * const UserProfile = withStore(['getUserData'])(() => {
 *   return () => <div>User profile content</div>;
 * });
 * ```
 */
export function withImports(
	options: ComponentMetadata = {}
): <ReturnType extends JSX.Element | string | Element | null, Props = Record<string, unknown>>(
	component: SolidComponentFunction<ReturnType, Props>
) => SolidComponentFunction<ReturnType, Props> & SolidComponentWithMetadata {
	return function <ReturnType extends JSX.Element | string | Element | null, Props = Record<string, unknown>>(
		component: SolidComponentFunction<ReturnType, Props>
	): SolidComponentFunction<ReturnType, Props> & SolidComponentWithMetadata {
		// Add import metadata to the component
		const annotated = component as SolidComponentFunction<ReturnType, Props> & SolidComponentWithMetadata;

		// Add imports from options or use empty array
		annotated.imports = options.imports || [];

		// Use component name or fallback to anonymous
		annotated.displayName = component.name || 'AnonymousComponent';

		return annotated;
	};
}
