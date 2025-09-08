import type { JSX } from 'preact';
import { h } from 'preact';
import { createImportStatements } from '../functions/createImportStatements.ts';
import { createIslandId } from '../functions/createIslandId.ts';
import { createCleanupObserver, createIslandElement } from '../functions/createIslandElement.ts';
import type { VanillaComponentWithMetadata, VanillaIslandProps, VanillaProps } from '../schemas/index.ts';
import { validateVanillaIslandProps } from '../schemas/frameworks.ts';

/**
 * Vanilla Island component that renders a vanilla JS component with
 * server-side rendering support and client-side hydration
 *
 * @param props - Island configuration including the component, props, and render conditions
 * @returns A JSX element containing the island
 *
 * @example
 * ```tsx
 * <Vanilla
 *   component={Counter}
 *   props={{ initialCount: 0 }}
 *   condition="on:visible"
 * />
 * ```
 */
export default function Vanilla<ComponentProps extends VanillaProps = VanillaProps>(
	props: VanillaIslandProps<ComponentProps>
): JSX.Element {
	const originalComponent = props.component;

	// Validate props at runtime using Zod schema
	const validatedProps = validateVanillaIslandProps(props);

	const { props: componentProps = {} as ComponentProps, condition, imports = [] } = validatedProps;

	// If no condition is provided, render as static HTML only
	if (!condition) {
		// Return just the static HTML without any island infrastructure
		const staticContent = (originalComponent as VanillaComponentWithMetadata).template?.(
			componentProps as ComponentProps
		);

		if (!staticContent) {
			throw new Error(
				`Vanilla component ${
					(originalComponent as VanillaComponentWithMetadata).displayName || 'Unknown'
				} is missing a template function for static rendering`
			);
		}

		return h('div', { dangerouslySetInnerHTML: { __html: staticContent } });
	}

	// Generate unique ID for this island instance
	const id = createIslandId();

	// Create condition attribute for lazy loading
	const conditionAttr = `data-island="${condition}"`;
	const clientOnly = condition === 'on:client';

	// Serialize props for client-side hydration
	const serializedProps = JSON.stringify(componentProps);

	const metadataImports = (originalComponent as VanillaComponentWithMetadata).imports || [];
	const allImports = [...imports, ...metadataImports];

	// Get component name, fallback to a default if none provided
	const componentName = (originalComponent as VanillaComponentWithMetadata).displayName || 'AnonymousComponent';

	// Generate server-rendered content using the component's template function
	const ssrContent = clientOnly
		? ''
		: (originalComponent as VanillaComponentWithMetadata).template?.(componentProps as ComponentProps) ||
		  `<div>Loading ${componentName}...</div>`;

	// Generate client-side hydration script
	const scriptContent = `
    ${createImportStatements(allImports)}
    
    const container = document.getElementById('${id}');
    if (!container) throw new Error('Container not found');

    const ${componentName} = ${originalComponent.toString()};
    const props = ${serializedProps};
    
    const cleanup = ${componentName}(container, props);

    if (cleanup) {
      ${createCleanupObserver('container', 'cleanup()')}
    }
  `;

	// Create the island HTML with SSR content and hydration script
	const islandHtml = createIslandElement(id, conditionAttr, ssrContent, scriptContent);

	return <div dangerouslySetInnerHTML={{ __html: islandHtml }} />;
}
