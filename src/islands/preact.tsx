import 'preact/debug';
import type { JSX } from 'preact';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { createCleanupObserver, createIslandElement } from '../functions/createIslandElement.ts';
import { createImportStatements } from '../functions/createImportStatements.ts';
import { createIslandId } from '../functions/createIslandId.ts';
import type { PreactComponentWithMetadata, PreactIslandProps } from '../schemas/index.ts';
import { validatePreactIslandProps } from '../schemas/frameworks.ts';

export default function Preact<ComponentProps = Record<string, unknown>>(
	props: PreactIslandProps<ComponentProps>
): JSX.Element {
	const originalComponent = props.component;

	// Validate props at runtime using Zod schema
	const validatedProps = validatePreactIslandProps(props);

	const {
		component, // This is the Zod-wrapped version
		props: componentProps = {} as ComponentProps,
		condition,
		imports = [],
	} = validatedProps;

	// If no condition is provided, render as static HTML only
	if (!condition) {
		// Return just the static HTML without any island infrastructure
		const staticHtml = renderToString(h(component, componentProps as Record<string, unknown>));
		return h('div', { dangerouslySetInnerHTML: { __html: staticHtml } });
	}

	const id = createIslandId();
	const conditionAttr = `data-island="${condition}"`;
	const clientOnly = condition === 'on:client';

	const metadataImports = (originalComponent as PreactComponentWithMetadata).imports || [];
	const allImports = [...imports, ...metadataImports];
	const componentName = (originalComponent as PreactComponentWithMetadata).displayName || 'AnonymousComponent';

	const ssrHtml = clientOnly ? '' : renderToString(h(component, componentProps as Record<string, unknown>));
	const serializedProps = JSON.stringify(componentProps);
	const componentSource = JSON.stringify(originalComponent.toString());
	const userImportedNames = Array.from(new Set(allImports.flatMap(i => i.names)));
	const userScopeDecl = userImportedNames.length
		? `const __user = { ${userImportedNames.join(', ')} };`
		: `const __user = {};`;

	const scriptContent = clientOnly
		? `
    import { render, createElement } from "preact";
    import * as _preact from "preact";
    import * as _hooks from "preact/hooks";
    import * as _jsxr from "preact/jsx-runtime";
    
    ${createImportStatements(allImports)}
    ${userScopeDecl}

    const __componentSource = ${componentSource};
    const __scope = Object.assign({}, _preact, _hooks, _jsxr, __user);
    __scope._jsx = _jsxr.jsx;
    __scope._jsxs = _jsxr.jsxs;
    __scope._jsxDEV = _jsxr.jsxDEV;
    __scope.Fragment = _jsxr.Fragment;
    __scope._Fragment = _jsxr.Fragment;
    const __factory = new Function('scope', 'with(scope) { return (' + __componentSource + '); }');
    const ${componentName} = __factory(__scope);
    
    const container = document.querySelector('#${id}');
    const props = ${serializedProps};
    if (container) {      
      const mount = createElement(${componentName}, props);

      requestAnimationFrame(() => {
        render(mount, container);
        
        ${createCleanupObserver('container', 'render(null, container)')}
      });
    }
  `
		: `
    import { hydrate, createElement } from "preact";
    import * as _preact from "preact";
    import * as _hooks from "preact/hooks";
    import * as _jsxr from "preact/jsx-runtime";
    
    ${createImportStatements(allImports)}
    ${userScopeDecl}

    const __componentSource = ${componentSource};
    const __scope = Object.assign({}, _preact, _hooks, _jsxr, __user);
    __scope._jsx = _jsxr.jsx;
    __scope._jsxs = _jsxr.jsxs;
    __scope._jsxDEV = _jsxr.jsxDEV;
    __scope.Fragment = _jsxr.Fragment;
    __scope._Fragment = _jsxr.Fragment;
    const __factory = new Function('scope', 'with(scope) { return (' + __componentSource + '); }');
    const ${componentName} = __factory(__scope);
    
    const container = document.querySelector('#${id}');
    const props = ${serializedProps};
    if (container) {
      const mount = createElement(${componentName}, props);

      requestAnimationFrame(() => {
        hydrate(mount, container);
        
        ${createCleanupObserver('container', 'hydrate(null, container)')}
      });
    }
  `;

	const islandHtml = createIslandElement(id, conditionAttr, ssrHtml, scriptContent);
	return h('div', { dangerouslySetInnerHTML: { __html: islandHtml } });
}
