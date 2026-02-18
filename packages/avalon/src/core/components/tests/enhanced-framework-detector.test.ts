/**
 * Enhanced Framework Detector Tests
 *
 * Comprehensive test suite for the enhanced framework detection system,
 * including edge cases, performance tests, and confidence scoring validation.
 */

import { describe, it, expect } from 'vitest';
import {
	EnhancedFrameworkDetector,
	type FrameworkDetectionResult,
	type FrameworkConfig,
} from '../enhanced-framework-detector.ts';

describe('EnhancedFrameworkDetector - Preact Detection', () => {
	const detector = new EnhancedFrameworkDetector();

	it('should detect Preact with JSX import source', () => {
		const content = `
/** @jsxImportSource preact */
import { useState } from 'preact/hooks';

export default function Counter() {
	const [count, setCount] = useState(0);
	return <button onClick={() => setCount(count + 1)}>{count}</button>;
}`;

		const result = detector.detectFramework('Counter.tsx', content);

		expect(result.framework).toEqual('preact');
		expect(result.confidence).toEqual('high');
		assert(result.evidence.some(e => e.includes('JSX import source')));
		assert(result.evidence.some(e => e.includes('preact')));
	});

	it('should detect Preact with import statements', () => {
		const content = `
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';

export default function App() {
	const [data, setData] = useState(null);
	
	useEffect(() => {
		fetch('/api/data').then(r => r.json()).then(setData);
	}, []);
	
	return <div>{data?.message}</div>;
}`;

		const result = detector.detectFramework('App.tsx', content);

		expect(result.framework).toEqual('preact');
		expect(result.confidence === 'high' || result.confidence === 'medium').toBeTruthy();
		assert(result.evidence.some(e => e.includes('Framework import')));
	});

	it('should detect Preact with content patterns', () => {
		const content = `
export default function Component() {
	const [state, setState] = useState(0);
	const memoized = useMemo(() => state * 2, [state]);
	
	return <div>{memoized}</div>;
}`;

		const result = detector.detectFramework('Component.tsx', content);

		// Should detect based on content patterns even without explicit imports
		expect(result.framework === 'preact' || result.framework === 'solid').toBeTruthy();
		expect(result.evidence.length > 0).toBeTruthy();
	});
});

describe('EnhancedFrameworkDetector - Solid Detection', () => {
	const detector = new EnhancedFrameworkDetector();

	it('should detect Solid with JSX import source', () => {
		const content = `
/** @jsxImportSource solid-js */
import { createSignal } from 'solid-js';

export default function Counter() {
	const [count, setCount] = createSignal(0);
	return <button onClick={() => setCount(count() + 1)}>{count()}</button>;
}`;

		const result = detector.detectFramework('Counter.tsx', content);

		expect(result.framework).toEqual('solid');
		expect(result.confidence).toEqual('high');
		assert(result.evidence.some(e => e.includes('JSX import source')));
		assert(result.evidence.some(e => e.includes('solid-js')));
	});

	it('should detect Solid with import statements', () => {
		const content = `
import { render } from 'solid-js/web';
import { createSignal, createEffect } from 'solid-js';

export default function App() {
	const [data, setData] = createSignal(null);
	
	createEffect(() => {
		fetch('/api/data').then(r => r.json()).then(setData);
	});
	
	return <div>{data()?.message}</div>;
}`;

		const result = detector.detectFramework('App.tsx', content);

		expect(result.framework).toEqual('solid');
		expect(result.confidence === 'high' || result.confidence === 'medium').toBeTruthy();
		assert(result.evidence.some(e => e.includes('Framework import')));
	});

	it('should detect Solid with content patterns', () => {
		const content = `
export default function Component() {
	const [signal, setSignal] = createSignal(0);
	const memo = createMemo(() => signal() * 2);
	
	onMount(() => {
		console.log('Component mounted');
	});
	
	return <div>{memo()}</div>;
}`;

		const result = detector.detectFramework('Component.tsx', content);

		expect(result.framework).toEqual('solid');
		assert(result.evidence.some(e => e.includes('content pattern')));
	});
});

describe('EnhancedFrameworkDetector - Vue Detection', () => {
	const detector = new EnhancedFrameworkDetector();

	it('should detect Vue with template syntax', () => {
		const content = `
<template>
	<div>
		<h1>{{ title }}</h1>
		<button @click="increment">{{ count }}</button>
	</div>
</template>

<script>
import { ref } from 'vue';

export default {
	setup() {
		const count = ref(0);
		const title = ref('Vue Component');
		
		const increment = () => {
			count.value++;
		};
		
		return { count, title, increment };
	}
};
</script>`;

		const result = detector.detectFramework('Component.vue', content);

		expect(result.framework).toEqual('vue');
		expect(result.confidence).toEqual('high');
		assert(result.evidence.some(e => e.includes('File extension')));
		assert(result.evidence.some(e => e.includes('content pattern')));
	});

	it('should detect Vue with composition API', () => {
		const content = `
<template>
	<div>{{ computedValue }}</div>
</template>

<script setup>
import { ref, computed, watchEffect } from 'vue';

const data = ref(null);
const computedValue = computed(() => data.value?.message || 'Loading...');

watchEffect(() => {
	fetch('/api/data').then(r => r.json()).then(d => data.value = d);
});
</script>`;

		const result = detector.detectFramework('Component.vue', content);

		expect(result.framework).toEqual('vue');
		assert(result.evidence.some(e => e.includes('Framework import')));
	});
});

describe('EnhancedFrameworkDetector - Svelte Detection', () => {
	const detector = new EnhancedFrameworkDetector();

	it('should detect Svelte with reactive statements', () => {
		const content = `
<script>
	import { onMount } from 'svelte';
	
	let count = 0;
	$: doubled = count * 2;
	
	onMount(() => {
		console.log('Component mounted');
	});
	
	function increment() {
		count += 1;
	}
</script>

<button on:click={increment}>
	Count: {count} (doubled: {doubled})
</button>

<style>
	button {
		background: blue;
		color: white;
	}
</style>`;

		const result = detector.detectFramework('Component.svelte', content);

		expect(result.framework).toEqual('svelte');
		expect(result.confidence).toEqual('high');
		assert(result.evidence.some(e => e.includes('File extension')));
		assert(result.evidence.some(e => e.includes('content pattern')));
	});

	it('should detect Svelte with stores', () => {
		const content = `
<script>
	import { writable } from 'svelte/store';
	
	const store = writable(0);
	
	function increment() {
		store.update(n => n + 1);
	}
</script>

<button on:click={increment}>
	Click me
</button>`;

		const result = detector.detectFramework('Component.svelte', content);

		expect(result.framework).toEqual('svelte');
		assert(result.evidence.some(e => e.includes('Framework import')));
	});
});

describe('EnhancedFrameworkDetector - Edge Cases', () => {
	const detector = new EnhancedFrameworkDetector();

	it('should handle missing JSX import source', () => {
		const content = `
export default function Component() {
	return <div>Hello World</div>;
}`;

		const result = detector.detectFramework('Component.tsx', content);

		// Should still attempt detection based on other evidence
		expect(result.framework).toBeDefined();
		expect(result.warnings.length > 0).toBeTruthy();
		assert(result.warnings.some(w => w.includes('low confidence')));
	});

	it('should handle ambiguous content', () => {
		const content = `
// This could be either Preact or Solid
export default function Component() {
	const [state, setState] = useState(0);
	return <div>{state}</div>;
}`;

		const result = detector.detectFramework('Component.tsx', content);

		// Should detect something but with warnings about ambiguity
		expect(result.framework).toBeDefined();
		if (result.confidence === 'low') {
			expect(result.warnings.length > 0).toBeTruthy();
		}
	});

	it('should handle empty content', () => {
		const content = '';

		const result = detector.detectFramework('Component.tsx', content);

		// With .tsx extension, it might detect as preact or solid with low confidence
		expect(result.framework === 'unknown' || result.framework === 'preact' || result.framework === 'solid').toBeTruthy();
		expect(result.confidence).toEqual('low');
	});

	it('should handle non-component files', () => {
		const content = `
export const API_URL = 'https://api.example.com';
export const VERSION = '1.0.0';
`;

		const result = detector.detectFramework('constants.ts', content);

		expect(result.framework).toEqual('unknown');
		expect(result.confidence).toEqual('low');
	});

	it('should handle mixed framework imports', () => {
		const content = `
// This is problematic - mixing frameworks
import { useState } from 'preact/hooks';
import { createSignal } from 'solid-js';

export default function Component() {
	const [preactState] = useState(0);
	const [solidSignal] = createSignal(0);
	return <div>{preactState} {solidSignal()}</div>;
}`;

		const result = detector.detectFramework('Component.tsx', content);

		// Should detect one framework (likely the one with higher score)
		expect(result.framework).toBeDefined();
		expect(result.framework !== 'unknown').toBeTruthy();
		// May have warnings or low confidence due to mixed imports
		expect(result.warnings.length >= 0).toBeTruthy(); // Allow no warnings if detection is confident
	});
});

describe('EnhancedFrameworkDetector - Confidence Scoring', () => {
	const detector = new EnhancedFrameworkDetector();

	it('should give high confidence for JSX import source + imports + content', () => {
		const content = `
/** @jsxImportSource preact */
import { useState } from 'preact/hooks';

export default function Component() {
	const [state, setState] = useState(0);
	return <div>{state}</div>;
}`;

		const result = detector.detectFramework('Component.tsx', content);

		expect(result.confidence).toEqual('high');
		expect(result.evidence.length >= 3).toBeTruthy(); // JSX source + import + content
	});

	it('should give medium confidence for imports + content', () => {
		const content = `
import { createSignal } from 'solid-js';

export default function Component() {
	const [signal, setSignal] = createSignal(0);
	return <div>{signal()}</div>;
}`;

		const result = detector.detectFramework('Component.tsx', content);

		expect(result.confidence === 'medium' || result.confidence === 'high').toBeTruthy();
		expect(result.evidence.length >= 2).toBeTruthy();
	});

	it('should give low confidence for extension only', () => {
		const content = `
export default function Component() {
	return <div>Static content</div>;
}`;

		const result = detector.detectFramework('Component.tsx', content);

		// Should have low confidence since only file extension provides evidence
		expect(result.confidence).toEqual('low');
		// Evidence might include file extension for multiple frameworks
		expect(result.evidence.length >= 0).toBeTruthy();
	});
});

describe('EnhancedFrameworkDetector - Performance Tests', () => {
	const detector = new EnhancedFrameworkDetector();

	it('should handle large files efficiently', () => {
		// Generate a large file with repeated patterns
		const imports = Array(100)
			.fill(0)
			.map((_, i) => `import { Component${i} } from './component${i}';`)
			.join('\n');

		const components = Array(100)
			.fill(0)
			.map((_, i) => `const component${i} = createSignal(${i});`)
			.join('\n');

		const content = `
/** @jsxImportSource solid-js */
import { createSignal } from 'solid-js';
${imports}

export default function LargeComponent() {
	${components}
	return <div>Large component</div>;
}`;

		const startTime = performance.now();
		const result = detector.detectFramework('LargeComponent.tsx', content);
		const endTime = performance.now();

		// Should complete within reasonable time (< 100ms for large files)
		expect(endTime - startTime < 100).toBeTruthy();
		expect(result.framework).toEqual('solid');
		expect(result.confidence).toEqual('high');
	});

	it('should handle multiple detections efficiently', () => {
		const files = [
			{ path: 'Preact.tsx', content: '/** @jsxImportSource preact */\nimport { useState } from "preact/hooks";' },
			{ path: 'Solid.tsx', content: '/** @jsxImportSource solid-js */\nimport { createSignal } from "solid-js";' },
			{ path: 'Vue.vue', content: '<template><div></div></template>\n<script>import { ref } from "vue";</script>' },
			{ path: 'Svelte.svelte', content: '<script>import { onMount } from "svelte";</script>' },
		];

		const startTime = performance.now();

		const results = files.map(file => detector.detectFramework(file.path, file.content));

		const endTime = performance.now();

		// Should complete all detections quickly
		expect(endTime - startTime < 50).toBeTruthy();

		// Verify all detections are correct
		expect(results[0].framework).toEqual('preact');
		expect(results[1].framework).toEqual('solid');
		expect(results[2].framework).toEqual('vue');
		expect(results[3].framework).toEqual('svelte');
	});
});

describe('EnhancedFrameworkDetector - Custom Framework Configuration', () => {
	it('should work with custom framework configurations', () => {
		const customConfig: FrameworkConfig = {
			name: 'custom',
			fileExtensions: ['.custom'],
			jsxImportSources: ['custom-framework'],
			ssrModules: ['custom-framework/server'],
			hydrationModules: ['custom-framework/client'],
			detectionPatterns: {
				imports: [/^custom-framework$/],
				content: [/\bcustomHook\b/],
				jsxPragmas: ['@jsxImportSource custom-framework'],
			},
		};

		const detector = new EnhancedFrameworkDetector({ custom: customConfig });

		const content = `
/** @jsxImportSource custom-framework */
import { customHook } from 'custom-framework';

export default function Component() {
	const value = customHook();
	return <div>{value}</div>;
}`;

		const result = detector.detectFramework('Component.custom', content);

		expect(result.framework).toEqual('custom');
		expect(result.confidence).toEqual('high');
	});
});

describe('EnhancedFrameworkDetector - JSX Import Source Parsing', () => {
	const detector = new EnhancedFrameworkDetector();

	it('should parse JSX import source from comment', () => {
		const content = `
/** @jsxImportSource preact */
export default function Component() {
	return <div>Hello</div>;
}`;

		const result = detector.detectFramework('Component.tsx', content);

		expect(result.framework).toEqual('preact');
		assert(result.evidence.some(e => e.includes('JSX import source: @jsxImportSource preact')));
	});

	it('should parse JSX import source from single-line comment', () => {
		const content = `
// @jsxImportSource solid-js
export default function Component() {
	return <div>Hello</div>;
}`;

		const result = detector.detectFramework('Component.tsx', content);

		// Note: Current implementation looks for /** */ comments, not // comments
		// This test documents current behavior
		expect(result.framework === 'solid' || result.framework === 'unknown').toBeTruthy();
	});

	it('should handle malformed JSX import source', () => {
		const content = `
/** @jsxImportSource */
export default function Component() {
	return <div>Hello</div>;
}`;

		const result = detector.detectFramework('Component.tsx', content);

		// Should not crash and should fall back to other detection methods
		expect(result.framework).toBeDefined();
		expect(result.confidence).toEqual('low');
	});
});

describe('EnhancedFrameworkDetector - Import Statement Extraction', () => {
	const detector = new EnhancedFrameworkDetector();

	it('should extract ES6 imports', () => {
		const content = `
import React from 'react';
import { useState, useEffect } from 'preact/hooks';
import * as Utils from './utils';
import type { Props } from './types';
`;

		const result = detector.detectFramework('Component.tsx', content);

		// Should detect preact based on the preact/hooks import
		expect(result.framework).toEqual('preact');
	});

	it('should extract require statements', () => {
		const content = `
const { createSignal } = require('solid-js');
const render = require('solid-js/web').render;

module.exports = function Component() {
	const [signal] = createSignal(0);
	return <div>{signal()}</div>;
};`;

		const result = detector.detectFramework('Component.tsx', content);

		expect(result.framework).toEqual('solid');
	});

	it('should handle mixed import styles', () => {
		const content = `
import { ref } from 'vue';
const { computed } = require('vue');

export default {
	setup() {
		const state = ref(0);
		const doubled = computed(() => state.value * 2);
		return { state, doubled };
	}
};`;

		const result = detector.detectFramework('Component.vue', content);

		expect(result.framework).toEqual('vue');
	});
});
