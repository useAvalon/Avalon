import { describe, it, expect } from 'vitest';
import {
	analyzeComponent,
	detectFramework,
	hasScriptSection,
	hasHydrateFunction,
	shouldHydrateComponent,
	createComponentMetadata,
	extractVueScript,
	extractSvelteScript,
	extractSolidScript,
	type ComponentAnalysis,
} from '../../core/components/component-detection.ts';

// Test data - sample component contents
const sampleComponents = {
	vueWithScript: `
<template>
  <div>{{ count }}</div>
  <button @click="increment">+</button>
</template>

<script setup>
import { ref } from 'vue'
const count = ref(0)
const increment = () => count.value++

// Hydrate function
export function hydrate() {
  console.log('Hydrating Vue component')
}
</script>
`,

	vueWithoutScript: `
<template>
  <div>
    <h1>Static Content</h1>
    <p>This is a static Vue component</p>
  </div>
</template>
`,

	svelteWithScript: `
<script>
  import { onMount } from 'svelte';
  let count = 0;
  
  function increment() {
    count += 1;
  }
  
  onMount(() => {
    console.log('Component mounted');
  });
  
  export function hydrate() {
    console.log('Hydrating Svelte component');
  }
</script>

<div>
  <p>Count: {count}</p>
  <button on:click={increment}>+</button>
</div>
`,

	svelteWithoutScript: `
<div>
  <h1>Static Svelte Component</h1>
  <p>No JavaScript here</p>
</div>
`,

	solidWithHydrate: `
import { createSignal } from 'solid-js';

export default function Counter() {
  const [count, setCount] = createSignal(0);
  
  const increment = () => setCount(count() + 1);
  
  return (
    <div>
      <p>Count: {count()}</p>
      <button onClick={increment}>+</button>
    </div>
  );
}

export function hydrate() {
  console.log('Hydrating Solid component');
}
`,

	solidWithoutHydrate: `
export default function StaticComponent() {
  return (
    <div>
      <h1>Static Solid Component</h1>
      <p>No hydration needed</p>
    </div>
  );
}
`,
};

describe('Framework Detection', () => {
	it('should detect Vue framework from file extension', () => {
		const framework = detectFramework('Component.vue', sampleComponents.vueWithScript);
		expect(framework).toEqual('vue');
	});

	it('should detect Svelte framework from file extension', () => {
		const framework = detectFramework('Component.svelte', sampleComponents.svelteWithScript);
		expect(framework).toEqual('svelte');
	});

	it('should detect Solid framework from file extension', () => {
		const framework = detectFramework('Component.tsx', sampleComponents.solidWithHydrate);
		expect(framework).toEqual('solid');
	});

	it('should detect framework from content when extension is ambiguous', () => {
		const vueFramework = detectFramework('Component.js', 'import { ref } from "vue"');
		expect(vueFramework).toEqual('vue');

		const svelteFramework = detectFramework('Component.js', 'import { onMount } from "svelte"');
		expect(svelteFramework).toEqual('svelte');

		const solidFramework = detectFramework('Component.js', 'import { createSignal } from "solid-js"');
		expect(solidFramework).toEqual('solid');
	});

	it('should return unknown for unrecognized patterns', () => {
		const framework = detectFramework('Component.js', 'console.log("hello")');
		expect(framework).toEqual('unknown');
	});
});

describe('Script Section Detection', () => {
	it('should detect Vue script sections', () => {
		expect(hasScriptSection(sampleComponents.vueWithScript, 'vue')).toEqual(true);
		expect(hasScriptSection(sampleComponents.vueWithoutScript, 'vue')).toEqual(false);
	});

	it('should detect Svelte script sections', () => {
		expect(hasScriptSection(sampleComponents.svelteWithScript, 'svelte')).toEqual(true);
		expect(hasScriptSection(sampleComponents.svelteWithoutScript, 'svelte')).toEqual(false);
	});

	it('should detect Solid script content', () => {
		expect(hasScriptSection(sampleComponents.solidWithHydrate, 'solid')).toEqual(true);
		expect(hasScriptSection('<div>Static HTML</div>', 'solid')).toEqual(false);
	});
});

describe('Hydrate Function Detection', () => {
	it('should detect Vue hydrate functions', () => {
		expect(hasHydrateFunction(sampleComponents.vueWithScript, 'vue')).toEqual(true);
		expect(hasHydrateFunction(sampleComponents.vueWithoutScript, 'vue')).toEqual(false);
	});

	it('should detect Svelte hydrate functions', () => {
		expect(hasHydrateFunction(sampleComponents.svelteWithScript, 'svelte')).toEqual(true);
		expect(hasHydrateFunction(sampleComponents.svelteWithoutScript, 'svelte')).toEqual(false);
	});

	it('should detect Solid hydrate functions', () => {
		expect(hasHydrateFunction(sampleComponents.solidWithHydrate, 'solid')).toEqual(true);
		expect(hasHydrateFunction(sampleComponents.solidWithoutHydrate, 'solid')).toEqual(false);
	});

	it('should detect explicit hydration patterns', () => {
		expect(hasHydrateFunction('export function hydrate() {}', 'vue')).toEqual(true);
		expect(hasHydrateFunction('import { hydrate } from "svelte"; hydrate()', 'svelte')).toEqual(true);
		expect(hasHydrateFunction('import { hydrate } from "solid-js/web"; hydrate()', 'solid')).toEqual(true);
		expect(hasHydrateFunction('createApp().mount()', 'vue')).toEqual(true);
	});

	it('should not detect non-hydration patterns', () => {
		expect(hasHydrateFunction('function mount() {}', 'vue')).toEqual(false);
		expect(hasHydrateFunction('onMount(() => {})', 'svelte')).toEqual(false);
		expect(hasHydrateFunction('createSignal(0)', 'solid')).toEqual(false);
	});
});

describe('Script Content Extraction', () => {
	it('should extract Vue script content', () => {
		const script = extractVueScript(sampleComponents.vueWithScript);
		expect(script).toBeDefined();
		expect(script.includes('const count = ref(0)')).toEqual(true);
		expect(script.includes('export function hydrate')).toEqual(true);
	});

	it('should extract Svelte script content', () => {
		const script = extractSvelteScript(sampleComponents.svelteWithScript);
		expect(script).toBeDefined();
		expect(script.includes('let count = 0')).toEqual(true);
		expect(script.includes('export function hydrate')).toEqual(true);
	});

	it('should extract Solid script content', () => {
		const script = extractSolidScript(sampleComponents.solidWithHydrate);
		expect(script).toBeDefined();
		expect(script.includes('createSignal')).toEqual(true);
		expect(script.includes('export function hydrate')).toEqual(true);
	});

	it('should return empty string for components without scripts', () => {
		expect(extractVueScript(sampleComponents.vueWithoutScript)).toEqual('');
		expect(extractSvelteScript(sampleComponents.svelteWithoutScript)).toEqual('');
	});
});

describe('Component Analysis', () => {
	it('should analyze Vue component with script and hydrate function', () => {
		const analysis = analyzeComponent('Component.vue', sampleComponents.vueWithScript);
		expect(analysis.framework).toEqual('vue');
		expect(analysis.hasScript).toEqual(true);
		expect(analysis.hasHydrateFunction).toEqual(true);
		expect(analysis.recommendedStrategy).toEqual('hydrate');
	});

	it('should analyze Vue component without script', () => {
		const analysis = analyzeComponent('Component.vue', sampleComponents.vueWithoutScript);
		expect(analysis.framework).toEqual('vue');
		expect(analysis.hasScript).toEqual(false);
		expect(analysis.hasHydrateFunction).toEqual(false);
		expect(analysis.recommendedStrategy).toEqual('ssr-only');
	});

	it('should analyze Svelte component with script and hydrate function', () => {
		const analysis = analyzeComponent('Component.svelte', sampleComponents.svelteWithScript);
		expect(analysis.framework).toEqual('svelte');
		expect(analysis.hasScript).toEqual(true);
		expect(analysis.hasHydrateFunction).toEqual(true);
		expect(analysis.recommendedStrategy).toEqual('hydrate');
	});

	it('should analyze Solid component with hydrate function', () => {
		const analysis = analyzeComponent('Component.tsx', sampleComponents.solidWithHydrate);
		expect(analysis.framework).toEqual('solid');
		expect(analysis.hasScript).toEqual(true);
		expect(analysis.hasHydrateFunction).toEqual(true);
		expect(analysis.recommendedStrategy).toEqual('hydrate');
	});
});

describe('Hydration Decision Logic', () => {
	it('should recommend SSR-only for components without scripts', () => {
		const analysis: ComponentAnalysis = {
			hasScript: false,
			hasHydrateFunction: false,
			framework: 'vue',
			recommendedStrategy: 'ssr-only',
		};

		const result = shouldHydrateComponent(analysis);
		expect(result.shouldHydrate).toEqual(false);
		expect(result.reason).toEqual('No script section detected, using SSR-only rendering');
	});

	it('should recommend hydration for components with hydrate functions', () => {
		const analysis: ComponentAnalysis = {
			hasScript: true,
			hasHydrateFunction: true,
			framework: 'vue',
			recommendedStrategy: 'hydrate',
		};

		const result = shouldHydrateComponent(analysis);
		expect(result.shouldHydrate).toEqual(true);
		expect(result.reason).toEqual('Vue component with script section - uses Vue integration system');
	});

	it('should respect forceSSROnly option', () => {
		const analysis: ComponentAnalysis = {
			hasScript: true,
			hasHydrateFunction: true,
			framework: 'vue',
			recommendedStrategy: 'hydrate',
		};

		const result = shouldHydrateComponent(analysis, { forceSSROnly: true });
		expect(result.shouldHydrate).toEqual(false);
		expect(result.reason).toEqual('Explicitly configured for SSR-only rendering');
	});

	it('should handle components with scripts but no hydrate functions', () => {
		const analysis: ComponentAnalysis = {
			hasScript: true,
			hasHydrateFunction: false,
			framework: 'vue',
			recommendedStrategy: 'ssr-only',
		};

		const result = shouldHydrateComponent(analysis);
		// Known frameworks with script sections always hydrate per shouldHydrateComponent logic
		expect(result.shouldHydrate).toEqual(true);
		expect(result.reason).toEqual('Vue component with script section - uses Vue integration system');
	});
});

describe('Component Metadata Creation', () => {
	it('should create metadata with high confidence for clear cases', () => {
		const analysis: ComponentAnalysis = {
			hasScript: true,
			hasHydrateFunction: true,
			framework: 'vue',
			recommendedStrategy: 'hydrate',
		};

		const metadata = createComponentMetadata('Component.vue', sampleComponents.vueWithScript, analysis);
		expect(metadata.framework).toEqual('vue');
		expect(metadata.hasScript).toEqual(true);
		expect(metadata.hasHydrateFunction).toEqual(true);
		expect(metadata.renderStrategy).toEqual('hydrate');
		expect(metadata.detectionConfidence).toEqual('high');
	});

	it('should create metadata with high confidence for SSR-only components', () => {
		const analysis: ComponentAnalysis = {
			hasScript: false,
			hasHydrateFunction: false,
			framework: 'vue',
			recommendedStrategy: 'ssr-only',
		};

		const metadata = createComponentMetadata('Component.vue', sampleComponents.vueWithoutScript, analysis);
		expect(metadata.renderStrategy).toEqual('ssr-only');
		expect(metadata.detectionConfidence).toEqual('high');
	});

	it('should create metadata with low confidence for unknown frameworks', () => {
		const analysis: ComponentAnalysis = {
			hasScript: true,
			hasHydrateFunction: false,
			framework: 'unknown',
			recommendedStrategy: 'hydrate',
		};

		const metadata = createComponentMetadata('Component.js', 'some content', analysis);
		expect(metadata.framework).toEqual('vue'); // Default fallback
		expect(metadata.detectionConfidence).toEqual('low');
	});
});
