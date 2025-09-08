import type {
	VanillaComponentWithMetadata,
	VanillaComponentOptions,
	VanillaProps,
	TemplatedVanillaComponent,
} from '../schemas/frameworks.ts';

/**
 * Adds import metadata to a vanilla component for island architecture
 *
 * This function annotates vanilla components with the imports they need,
 * allowing the island system to load the necessary dependencies when
 * the component is hydrated on the client.
 *
 * @param options - Configuration options including imports and display name
 * @returns A function that wraps a vanilla component and adds import metadata
 *
 * @example
 * ```ts
 * // Direct usage
 * const Counter = withImports({
 *   imports: [{ names: ['formatNumber'], from: '../utils/format.ts' }]
 * })((container, props) => {
 *   const button = document.createElement('button');
 *   button.textContent = `Count: ${props.count || 0}`;
 *   container.appendChild(button);
 * });
 *
 * // Detached pattern with helper
 * const withUtils = (imports: string[]) => withImports({
 *   imports: imports.map(name => from([name], 'utils/dom.ts'))
 * });
 *
 * const InteractiveWidget = withUtils(['addEventListeners'])((container, props) => {
 *   // widget implementation
 * });
 * ```
 */
export function withImports(
	options: VanillaComponentOptions = {}
): <ComponentProps extends VanillaProps = VanillaProps>(
	vanillaComponent: TemplatedVanillaComponent<ComponentProps>
) => TemplatedVanillaComponent<ComponentProps> & VanillaComponentWithMetadata<ComponentProps> {
	return function <ComponentProps extends VanillaProps = VanillaProps>(
		vanillaComponent: TemplatedVanillaComponent<ComponentProps>
	): TemplatedVanillaComponent<ComponentProps> & VanillaComponentWithMetadata<ComponentProps> {
		// Add import metadata to the component
		const annotated = vanillaComponent as TemplatedVanillaComponent<ComponentProps> &
			VanillaComponentWithMetadata<ComponentProps>;

		// Add imports from options or use empty array
		annotated.imports = options.imports || [];

		// Use component name or fallback to anonymous
		annotated.displayName = vanillaComponent.name || 'AnonymousComponent';

		return annotated;
	};
}
