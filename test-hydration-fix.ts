#!/usr/bin/env -S deno run --allow-all

/**
 * Test to verify that Svelte hydration is working
 */

console.log('🔬 Testing Svelte Hydration Fix...\n');

// Simulate the client-side hydration detection logic
function simulateClientHydrationDetection(componentModule, framework, src) {
  try {
    // Framework-specific hydration detection
    if (framework === 'svelte') {
      // Svelte 5 components don't export hydrate functions - they export the component
      const Component = componentModule.default || componentModule.Component || componentModule;
      if (Component) {
        return {
          shouldHydrate: true,
          reason: 'Svelte 5 component detected - using Svelte runtime hydration',
        };
      } else {
        return {
          shouldHydrate: false,
          reason: 'No valid Svelte component found in module',
          warnings: [`Svelte component ${src} has no valid component export`],
        };
      }
    }

    // For other frameworks, check for hydrate function
    if (componentModule.hydrate && typeof componentModule.hydrate === 'function') {
      return {
        shouldHydrate: true,
        reason: 'Component has hydrate function',
      };
    }

    return {
      shouldHydrate: false,
      reason: 'No hydration method detected',
    };
  } catch (error) {
    return {
      shouldHydrate: true,
      reason: 'Unable to analyze component, defaulting to hydration attempt',
      warnings: [`Component analysis failed for ${src}: ${error.message}`],
    };
  }
}

// Test with mock Svelte component modules
const testCases = [
  {
    name: 'Svelte component with default export',
    module: { default: function SvelteComponent() {} },
    framework: 'svelte',
    src: '/islands/SvelteCounter.svelte'
  },
  {
    name: 'Svelte component with Component export',
    module: { Component: function SvelteComponent() {} },
    framework: 'svelte',
    src: '/islands/SimpleSvelteTest.svelte'
  },
  {
    name: 'Svelte component with no valid export',
    module: { someOtherExport: 'value' },
    framework: 'svelte',
    src: '/islands/BrokenSvelte.svelte'
  },
  {
    name: 'Vue component with hydrate function',
    module: { hydrate: function() {}, default: function VueComponent() {} },
    framework: 'vue',
    src: '/islands/VueCounter.vue'
  }
];

console.log('📋 Testing hydration detection logic...\n');

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. ${testCase.name}`);
  const result = simulateClientHydrationDetection(testCase.module, testCase.framework, testCase.src);
  
  console.log(`   Should hydrate: ${result.shouldHydrate ? '✅ YES' : '❌ NO'}`);
  console.log(`   Reason: ${result.reason}`);
  if (result.warnings) {
    result.warnings.forEach(warning => console.log(`   ⚠️ Warning: ${warning}`));
  }
  console.log('');
});

console.log('🏁 Hydration Fix Test Complete!');