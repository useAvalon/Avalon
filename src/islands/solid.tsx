import type { JSX } from 'preact';
import { createCleanupObserver, createIslandElement } from '../functions/createIslandElement.ts';
import { createImportStatements } from '../functions/createImportStatements.ts';
import { createIslandId } from '../functions/createIslandId.ts';
import type { SolidComponentWithMetadata, SolidIslandProps } from '../schemas/index.ts';
import { validateSolidIslandProps } from '../schemas/frameworks.ts';

export default function Solid<ComponentProps = Record<string, unknown>>(
	props: SolidIslandProps<ComponentProps>
): JSX.Element {
	const originalComponent = props.component;

	// Validate props at runtime using Zod schema
	const validatedProps = validateSolidIslandProps(props);

	const { props: componentProps = {} as ComponentProps } = validatedProps;
	const id = createIslandId();
	const conditionAttr = `data-island="on:client"`;

	const metadataImports = (originalComponent as SolidComponentWithMetadata).imports || [];
	const allImports = [...metadataImports];
	const componentName = (originalComponent as SolidComponentWithMetadata).displayName || 'AnonymousComponent';

	const serializedProps = JSON.stringify(componentProps);
	const componentSource = JSON.stringify(originalComponent.toString());
	const userImportedNames = Array.from(new Set(allImports.flatMap(i => i.names)));
	const userScopeDecl = userImportedNames.length
		? `const __user = { ${userImportedNames.join(', ')} };`
		: `const __user = {};`;

	const scriptContent = `
    import { render } from "solid-js/web";
    import { jsx } from "solid-js/h";
    import html from "solid-js/html";
    import * as _solid from "solid-js";

    ${createImportStatements(allImports)}
    ${userScopeDecl}

    const __componentSource = ${componentSource};
    const __props = ${serializedProps};
    
    // Create scope with all Solid.js primitives and JSX runtime automatically available
    const __scope = Object.assign({}, _solid, { jsx, html }, __user);
    
    // Add JSX runtime functions that compiled code expects
    __scope._jsx = jsx;
    __scope._jsxs = jsx;
    __scope.h = jsx;
    __scope.jsxs = jsx;
    __scope.Fragment = (props) => props.children;
    const __factory = new Function('scope', 'with(scope) { return (' + __componentSource + '); }');
    const ${componentName} = __factory(__scope);

    const container = document.querySelector('#${id}');
    if (container) {
      const mount = document.createElement('div');
      container.replaceChildren(mount);
      
      let dispose;
      
      try {
        dispose = render(() => {
          const result = ${componentName}(__props);
          return container.isConnected ? result : null;
        }, mount);

        ${createCleanupObserver('container', 'dispose && dispose();')}
      } catch (e) {
        console.error('Error rendering Solid component:', e);
      }
    }
  `;

	const islandHtml = createIslandElement(id, conditionAttr, '', scriptContent);

	return <div dangerouslySetInnerHTML={{ __html: islandHtml }} />;
}
