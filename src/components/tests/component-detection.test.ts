import { assertEquals, assertExists } from 'jsr:@std/assert';
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

Deno.test('Framework Detection', async t => {
	await t.step('should detect Vue framework from file extension', () => {
		const framework = detectFramework('Component.vue', sampleComponents.vueWithScript);
		assertEquals(framework, 'vue');
	});

	await t.step('should detect Svelte framework from file extension', () => {
		const framework = detectFramework('Component.svelte', sampleComponents.svelteWithScript);
		assertEquals(framework, 'svelte');
	});

	await t.step('should detect Solid framework from file extension', () => {
		const framework = detectFramework('Component.tsx', sampleComponents.solidWithHydrate);
		assertEquals(framework, 'solid');
	});

	await t.step('should detect framework from content when extension is ambiguous', () => {
		const vueFramework = detectFramework('Component.js', 'import { ref } from "vue"');
		assertEquals(vueFramework, 'vue');

		const svelteFramework = detectFramework('Component.js', 'import { onMount } from "svelte"');
		assertEquals(svelteFramework, 'svelte');

		const solidFramework = detectFramework('Component.js', 'import { createSignal } from "solid-js"');
		assertEquals(solidFramework, 'solid');
	});

	await t.step('should return unknown for unrecognized patterns', () => {
		const framework = detectFramework('Component.js', 'console.log("hello")');
		assertEquals(framework, 'unknown');
	});
});

Deno.test('Script Section Detection', async t => {
	await t.step('should detect Vue script sections', () => {
		assertEquals(hasScriptSection(sampleComponents.vueWithScript, 'vue'), true);
		assertEquals(hasScriptSection(sampleComponents.vueWithoutScript, 'vue'), false);
	});

	await t.step('should detect Svelte script sections', () => {
		assertEquals(hasScriptSection(sampleComponents.svelteWithScript, 'svelte'), true);
		assertEquals(hasScriptSection(sampleComponents.svelteWithoutScript, 'svelte'), false);
	});

	await t.step('should detect Solid script content', () => {
		assertEquals(hasScriptSection(sampleComponents.solidWithHydrate, 'solid'), true);
		assertEquals(hasScriptSection('<div>Static HTML</div>', 'solid'), false);
	});
});

Deno.test('Hydrate Function Detection', async t => {
	await t.step('should detect Vue hydrate functions', () => {
		assertEquals(hasHydrateFunction(sampleComponents.vueWithScript, 'vue'), true);
		assertEquals(hasHydrateFunction(sampleComponents.vueWithoutScript, 'vue'), false);
	});

	await t.step('should detect Svelte hydrate functions', () => {
		assertEquals(hasHydrateFunction(sampleComponents.svelteWithScript, 'svelte'), true);
		assertEquals(hasHydrateFunction(sampleComponents.svelteWithoutScript, 'svelte'), false);
	});

	await t.step('should detect Solid hydrate functions', () => {
		assertEquals(hasHydrateFunction(sampleComponents.solidWithHydrate, 'solid'), true);
		assertEquals(hasHydrateFunction(sampleComponents.solidWithoutHydrate, 'solid'), false);
	});

	await t.step('should detect explicit hydration patterns', () => {
		assertEquals(hasHydrateFunction('export function hydrate() {}', 'vue'), true);
		assertEquals(hasHydrateFunction('import { hydrate } from "svelte"; hydrate()', 'svelte'), true);
		assertEquals(hasHydrateFunction('import { hydrate } from "solid-js/web"; hydrate()', 'solid'), true);
		assertEquals(hasHydrateFunction('createApp().mount()', 'vue'), true);
	});

	await t.step('should not detect non-hydration patterns', () => {
		assertEquals(hasHydrateFunction('function mount() {}', 'vue'), false);
		assertEquals(hasHydrateFunction('onMount(() => {})', 'svelte'), false);
		assertEquals(hasHydrateFunction('createSignal(0)', 'solid'), false);
	});
});

Deno.test('Script Content Extraction', async t => {
	await t.step('should extract Vue script content', () => {
		const script = extractVueScript(sampleComponents.vueWithScript);
		assertExists(script);
		assertEquals(script.includes('const count = ref(0)'), true);
		assertEquals(script.includes('export function hydrate'), true);
	});

	await t.step('should extract Svelte script content', () => {
		const script = extractSvelteScript(sampleComponents.svelteWithScript);
		assertExists(script);
		assertEquals(script.includes('let count = 0'), true);
		assertEquals(script.includes('export function hydrate'), true);
	});

	await t.step('should extract Solid script content', () => {
		const script = extractSolidScript(sampleComponents.solidWithHydrate);
		assertExists(script);
		assertEquals(script.includes('createSignal'), true);
		assertEquals(script.includes('export function hydrate'), true);
	});

	await t.step('should return empty string for components without scripts', () => {
		assertEquals(extractVueScript(sampleComponents.vueWithoutScript), '');
		assertEquals(extractSvelteScript(sampleComponents.svelteWithoutScript), '');
	});
});

Deno.test('Component Analysis', async t => {
	await t.step('should analyze Vue component with script and hydrate function', () => {
		const analysis = analyzeComponent('Component.vue', sampleComponents.vueWithScript);
		assertEquals(analysis.framework, 'vue');
		assertEquals(analysis.hasScript, true);
		assertEquals(analysis.hasHydrateFunction, true);
		assertEquals(analysis.recommendedStrategy, 'hydrate');
	});

	await t.step('should analyze Vue component without script', () => {
		const analysis = analyzeComponent('Component.vue', sampleComponents.vueWithoutScript);
		assertEquals(analysis.framework, 'vue');
		assertEquals(analysis.hasScript, false);
		assertEquals(analysis.hasHydrateFunction, false);
		assertEquals(analysis.recommendedStrategy, 'ssr-only');
	});

	await t.step('should analyze Svelte component with script and hydrate function', () => {
		const analysis = analyzeComponent('Component.svelte', sampleComponents.svelteWithScript);
		assertEquals(analysis.framework, 'svelte');
		assertEquals(analysis.hasScript, true);
		assertEquals(analysis.hasHydrateFunction, true);
		assertEquals(analysis.recommendedStrategy, 'hydrate');
	});

	await t.step('should analyze Solid component with hydrate function', () => {
		const analysis = analyzeComponent('Component.tsx', sampleComponents.solidWithHydrate);
		assertEquals(analysis.framework, 'solid');
		assertEquals(analysis.hasScript, true);
		assertEquals(analysis.hasHydrateFunction, true);
		assertEquals(analysis.recommendedStrategy, 'hydrate');
	});
});

Deno.test('Hydration Decision Logic', async t => {
	await t.step('should recommend SSR-only for components without scripts', () => {
		const analysis: ComponentAnalysis = {
			hasScript: false,
			hasHydrateFunction: false,
			framework: 'vue',
			recommendedStrategy: 'ssr-only',
		};

		const result = shouldHydrateComponent(analysis);
		assertEquals(result.shouldHydrate, false);
		assertEquals(result.reason, 'No script section detected, using SSR-only rendering');
	});

	await t.step('should recommend hydration for components with hydrate functions', () => {
		const analysis: ComponentAnalysis = {
			hasScript: true,
			hasHydrateFunction: true,
			framework: 'vue',
			recommendedStrategy: 'hydrate',
		};

		const result = shouldHydrateComponent(analysis);
		assertEquals(result.shouldHydrate, true);
		assertEquals(result.reason, 'Component has script section with explicit hydration functions');
	});

	await t.step('should respect forceSSROnly option', () => {
		const analysis: ComponentAnalysis = {
			hasScript: true,
			hasHydrateFunction: true,
			framework: 'vue',
			recommendedStrategy: 'hydrate',
		};

		const result = shouldHydrateComponent(analysis, { forceSSROnly: true });
		assertEquals(result.shouldHydrate, false);
		assertEquals(result.reason, 'Explicitly configured for SSR-only rendering');
	});

	await t.step('should handle components with scripts but no hydrate functions', () => {
		const analysis: ComponentAnalysis = {
			hasScript: true,
			hasHydrateFunction: false,
			framework: 'vue',
			recommendedStrategy: 'ssr-only',
		};

		const result = shouldHydrateComponent(analysis);
		assertEquals(result.shouldHydrate, false);
		assertEquals(result.reason, 'Component has script section but no explicit hydrate function, using SSR-only');
		assertExists(result.warnings);
		assertEquals(result.warnings.length > 0, true);
	});
});

Deno.test('Component Metadata Creation', async t => {
	await t.step('should create metadata with high confidence for clear cases', () => {
		const analysis: ComponentAnalysis = {
			hasScript: true,
			hasHydrateFunction: true,
			framework: 'vue',
			recommendedStrategy: 'hydrate',
		};

		const metadata = createComponentMetadata('Component.vue', sampleComponents.vueWithScript, analysis);
		assertEquals(metadata.framework, 'vue');
		assertEquals(metadata.hasScript, true);
		assertEquals(metadata.hasHydrateFunction, true);
		assertEquals(metadata.renderStrategy, 'hydrate');
		assertEquals(metadata.detectionConfidence, 'high');
	});

	await t.step('should create metadata with high confidence for SSR-only components', () => {
		const analysis: ComponentAnalysis = {
			hasScript: false,
			hasHydrateFunction: false,
			framework: 'vue',
			recommendedStrategy: 'ssr-only',
		};

		const metadata = createComponentMetadata('Component.vue', sampleComponents.vueWithoutScript, analysis);
		assertEquals(metadata.renderStrategy, 'ssr-only');
		assertEquals(metadata.detectionConfidence, 'high');
	});

	await t.step('should create metadata with low confidence for unknown frameworks', () => {
		const analysis: ComponentAnalysis = {
			hasScript: true,
			hasHydrateFunction: false,
			framework: 'unknown',
			recommendedStrategy: 'hydrate',
		};

		const metadata = createComponentMetadata('Component.js', 'some content', analysis);
		assertEquals(metadata.framework, 'vue'); // Default fallback
		assertEquals(metadata.detectionConfidence, 'low');
	});
});
