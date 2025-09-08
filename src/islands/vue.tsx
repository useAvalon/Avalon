import type { JSX } from 'preact';
import { createCleanupObserver, createIslandElement } from '../functions/createIslandElement.ts';

import { createImportStatements } from '../functions/createImportStatements.ts';
import { createIslandId } from '../functions/createIslandId.ts';
import type {
	VueComponentWithMetadata,
	VueIslandProps,
	VueProps,
	VueSFCPath,
	ComponentMetadata,
} from '../schemas/index.ts';
import { validateVueIslandProps } from '../schemas/frameworks.ts';

export default function Vue<ComponentProps extends VueProps = VueProps>(
	props: VueIslandProps<ComponentProps>
): JSX.Element {
	const originalComponent = props.component;

	// Validate props at runtime using Zod schema
	const validatedProps = validateVueIslandProps(props);

	const { props: componentProps = {} as ComponentProps, imports = [] } = validatedProps;

	const id = createIslandId();
	// Vue is client-only
	const conditionAttr = `data-island="on:client"`;

	// Check if this is an SFC reference
	const isSFC = typeof originalComponent === 'object' && '__vueSFC' in originalComponent;

	const metadataImports = isSFC
		? (originalComponent as VueSFCPath & { imports?: ComponentMetadata['imports'] }).imports || []
		: (originalComponent as VueComponentWithMetadata).imports || [];
	const allImports = [...imports, ...metadataImports];
	const componentName = !isSFC
		? (originalComponent as VueComponentWithMetadata).displayName || 'AnonymousComponent'
		: `SFC_${id}`;

	// Serialize props for client-side hydration
	const serializedProps = JSON.stringify(componentProps);

	// Handle SFC vs function component differently
	const componentSource = isSFC
		? JSON.stringify((originalComponent as VueSFCPath).path)
		: JSON.stringify(originalComponent.toString());

	const userImportedNames = Array.from(new Set(allImports.flatMap(i => i.names)));
	const userScopeDecl = userImportedNames.length
		? `const __user = { ${userImportedNames.join(', ')} };`
		: `const __user = {};`;

	const scriptContent = isSFC
		? `
    import * as _vue from "vue";
    ${createImportStatements(allImports)}
    ${userScopeDecl}

    // Vue SFC Runtime Compilation
    const sfcPath = ${componentSource};
    const container = document.querySelector('#${id}');
    const props = ${serializedProps};
    
    if (container) {
      try {
        const existingApp = container.__vue_app__;
        if (existingApp) {
          existingApp.unmount();
        }

        // Load vue3-sfc-loader dynamically (cached)
        if (!window.__vue_sfc_loader_cache) {
          window.__vue_sfc_loader_cache = import('https://cdn.jsdelivr.net/npm/vue3-sfc-loader@0.9.5/dist/vue3-sfc-loader.esm.js');
        }
        const { loadModule } = await window.__vue_sfc_loader_cache;
        
        // Create global module cache if it doesn't exist
        if (!window.__vue_module_cache) {
          window.__vue_module_cache = { vue: _vue, ...__user };
        }
        
        // Create global file cache if it doesn't exist
        if (!window.__vue_file_cache) {
          window.__vue_file_cache = new Map();
        }
        
        const options = {
          moduleCache: window.__vue_module_cache,
          async getFile(url) {
            if (window.__vue_file_cache.has(url)) {
              return window.__vue_file_cache.get(url);
            }
            
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(\`Failed to load SFC: \${url}\`);
            }
            const content = await response.text();
            window.__vue_file_cache.set(url, content);
            return content;
          },
          addStyle(styleStr) {
            // Create a unique identifier for this style block
            const styleId = 'vue-sfc-style-' + btoa(styleStr).slice(0, 16);
            
            // Check if this style is already in the document
            if (document.getElementById(styleId)) {
              return; // Style already exists, skip injection
            }
            
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = styleStr;
            const head = document.head;
            head.insertBefore(style, head.firstChild);
          },
        };

        // Check if component is already cached
        const cacheKey = \`component_\${sfcPath}\`;
        if (!window.__vue_component_cache) {
          window.__vue_component_cache = new Map();
        }
        
        let componentDefinition;
        if (window.__vue_component_cache.has(cacheKey)) {
          componentDefinition = window.__vue_component_cache.get(cacheKey);
        } else {
          componentDefinition = await loadModule(sfcPath, options);
          window.__vue_component_cache.set(cacheKey, componentDefinition);
        }
        
        const app = _vue.createApp({
          components: {
            '${componentName}': componentDefinition
          },
          setup() {
            return { props };
          },
          template: \`<${componentName} v-bind="props" />\`
        });
        
        container.replaceChildren();
        app.mount(container);
        
        container.__vue_app__ = app;

        ${createCleanupObserver(
					'container',
					`
          if (container.__vue_app__) {
            container.__vue_app__.unmount();
          }
          `
				)}
      } catch (e) {
        console.error('Error loading Vue SFC:', e);
        container.innerHTML = \`<div style="color: red; padding: 1rem; border: 1px solid red;">
          <strong>Error loading Vue SFC:</strong><br>
          \${e.message || 'Unknown error'}
        </div>\`;
      }
    }
  `
		: `
    import * as _vue from "vue";
    ${createImportStatements(allImports)}
    ${userScopeDecl}

    const __componentSource = ${componentSource};
    const __scope = Object.assign({}, _vue, __user);
    const __factory = new Function('scope', 'with(scope) { return (' + __componentSource + '); }');
    const ${componentName} = __factory(__scope);

    const container = document.querySelector('#${id}');
    const props = ${serializedProps};
    
    if (container) {
      try {
        const existingApp = container.__vue_app__;
        if (existingApp) {
          existingApp.unmount();
        }

        const componentDefinition = ${componentName}();
        const { setup, template } = componentDefinition;
        
        const app = _vue.createApp({
          setup() {
            return setup(props);
          },
          template,
          compatConfig: { MODE: 3 }
        });
        
        container.replaceChildren();
        app.mount(container);
        
        container.__vue_app__ = app;

        ${createCleanupObserver(
					'container',
					`
          if (container.__vue_app__) {
            container.__vue_app__.unmount();
          }
          `
				)}
      } catch (e) {
        console.error('Error rendering Vue component:', e);
        container.textContent = 'Error rendering component';
      }
    }
  `;

	const islandHtml = createIslandElement(id, conditionAttr, '', scriptContent);

	return <div dangerouslySetInnerHTML={{ __html: islandHtml }} />;
}
