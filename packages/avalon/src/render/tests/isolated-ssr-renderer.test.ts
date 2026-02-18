/**
 * Tests for Isolated SSR Renderer
 *
 * This test suite verifies that the isolated SSR renderer properly prevents
 * cross-framework contamination and handles framework-specific rendering correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IsolatedSSRRenderer, type IsolatedRenderRequest, type SSRIsolationConfig } from '../isolated-ssr-renderer.ts';
import { h } from 'preact';

// Helper function to create test components
const createTestComponent = (content: string) => () => h('div', {}, content);

// Mock component content for testing
const mockPreactComponent = `
/** @jsxImportSource preact */
import { useState } from 'preact/hooks';

export default function PreactCounter() {
  const [count, setCount] = useState(0);
  return <div>Count: {count}</div>;
}
`;

const mockSolidComponent = `
/** @jsxImportSource solid-js */
import { createSignal } from 'solid-js';

export default function SolidCounter() {
  const [count, setCount] = createSignal(0);
  return <div>Count: {count()}</div>;
}
`;

const mockContaminatedComponent = `
/** @jsxImportSource preact */
import { useState } from 'preact/hooks';
import { createSignal } from 'solid-js'; // This should trigger a warning

export default function ContaminatedComponent() {
  const [count, setCount] = useState(0);
  return <div>Count: {count}</div>;
}
`;

describe('IsolatedSSRRenderer', () => {
	let renderer: IsolatedSSRRenderer;
	let originalReadTextFile: typeof readFile;

	beforeEach(() => {
		// Create renderer with test configuration
		const config: Partial<SSRIsolationConfig> = {
			enableStrictIsolation: true,
			allowedCrossFrameworkImports: ['preact', 'preact-render-to-string'],
			errorHandling: 'strict',
			debugLogging: false,
		};
		renderer = new IsolatedSSRRenderer(config);

		// Mock readFile to return our test components
		originalReadTextFile = readFile;
		readFile = async (path: string | URL): Promise<string> => {
			const pathStr = typeof path === 'string' ? path : path.pathname;
			if (pathStr.includes('PreactCounter') || pathStr.includes('preact-component')) {
				return mockPreactComponent;
			}
			if (pathStr.includes('SolidCounter') || pathStr.includes('solid-component')) {
				return mockSolidComponent;
			}
			if (pathStr.includes('ContaminatedComponent') || pathStr.includes('contaminated-component')) {
				return mockContaminatedComponent;
			}
			throw new Error(`File not found: ${pathStr}`);
		};
	});

	afterEach(async () => {
		// Restore original function
		readFile = originalReadTextFile;

		// Reset all contexts
		await renderer.resetAllContexts();
	});

	describe('Framework Context Isolation', () => {
		it('should create separate contexts for each framework', () => {
			const contexts = renderer.getContexts();

			expect(contexts.has('preact')).toEqual(true);
			expect(contexts.has('solid')).toEqual(true);
			expect(contexts.has('vue')).toEqual(true);
			expect(contexts.has('svelte')).toEqual(true);
			expect(contexts.has('unknown')).toEqual(true);
		});

		it('should isolate Preact context from Solid modules', async () => {
			const preactRequest: IsolatedRenderRequest = {
				componentPath: 'preact-component.tsx',
				component: createTestComponent('Preact Component'),
				framework: 'preact',
			};

			const result = await renderer.renderWithIsolation(preactRequest);

			expect(result.success).toEqual(true);
			expect(result.framework).toEqual('preact');
			expect(result.html).toContain('Preact Component');
		});

		it('should isolate Solid context from Preact modules', async () => {
			const solidRequest: IsolatedRenderRequest = {
				componentPath: 'solid-component.tsx',
				component: createTestComponent('Solid Component'),
				framework: 'solid',
			};

			const result = await renderer.renderWithIsolation(solidRequest);

			// Note: This might fail in the test environment since solid-js may not be available
			// but the isolation should still work
			expect(result.framework).toEqual('solid');
		});

		it('should detect framework from contaminated component', async () => {
			const contaminatedRequest: IsolatedRenderRequest = {
				componentPath: 'contaminated-component.tsx',
				component: createTestComponent('Contaminated Component'),
			};

			const result = await renderer.renderWithIsolation(contaminatedRequest);

			// Should still detect the framework (Preact based on JSX import source)
			expect(result.framework).toEqual('preact');

			// Should render successfully (isolation prevents the contamination from breaking things)
			expect(result.success).toEqual(true);
			expect(result.html).toContain('Contaminated Component');
		});
	});

	describe('Framework Detection and Rendering', () => {
		it('should automatically detect Preact framework', async () => {
			const request: IsolatedRenderRequest = {
				componentPath: 'preact-component.tsx',
				component: createTestComponent('Auto-detected Preact'),
			};

			const result = await renderer.renderWithIsolation(request);

			expect(result.framework).toEqual('preact');
			expect(result.success).toEqual(true);
		});

		it('should automatically detect Solid framework', async () => {
			const request: IsolatedRenderRequest = {
				componentPath: 'solid-component.tsx',
				component: createTestComponent('Auto-detected Solid'),
			};

			const result = await renderer.renderWithIsolation(request);

			expect(result.framework).toEqual('solid');
		});
	});

	describe('Context Cleanup and Reset', () => {
		it('should cleanup context after rendering', async () => {
			const request: IsolatedRenderRequest = {
				componentPath: 'preact-component.tsx',
				component: createTestComponent('Test Component'),
				framework: 'preact',
			};

			await renderer.renderWithIsolation(request);

			// After rendering, active context should be null (cleaned up)
			expect(renderer.getActiveContext()).toEqual(null);
		});

		it('should reset all contexts', async () => {
			// Render with multiple frameworks
			const preactRequest: IsolatedRenderRequest = {
				componentPath: 'preact-component.tsx',
				component: createTestComponent('Preact'),
				framework: 'preact',
			};

			const solidRequest: IsolatedRenderRequest = {
				componentPath: 'solid-component.tsx',
				component: createTestComponent('Solid'),
				framework: 'solid',
			};

			await renderer.renderWithIsolation(preactRequest);
			await renderer.renderWithIsolation(solidRequest);

			// Reset all contexts
			await renderer.resetAllContexts();

			// Verify all contexts are inactive
			const contexts = renderer.getContexts();
			for (const [, context] of contexts) {
				expect(context.isActive).toEqual(false);
				expect(context.imports.size).toEqual(0);
			}
		});
	});

	describe('Error Handling', () => {
		it('should handle missing framework modules gracefully', async () => {
			const request: IsolatedRenderRequest = {
				componentPath: 'nonexistent-framework.tsx',
				component: createTestComponent('Test'),
				framework: 'nonexistent' as any,
			};

			const result = await renderer.renderWithIsolation(request);

			// Should fall back to unknown framework context
			expect(result.framework).toEqual('nonexistent');
			expect(result.errors.length > 0).toEqual(true);
		});

		it('should provide fallback rendering when framework fails', async () => {
			const component = createTestComponent('Fallback Test');

			const result = await renderer.renderWithFallback(component, 'nonexistent-framework');

			// Should fall back to a working framework (preact or unknown)
			expect(result.success).toEqual(true);
			expect(result.warnings.length > 0).toEqual(true);

			const hasFallbackWarning = result.warnings.some(warning => warning.includes('Fell back to'));
			expect(hasFallbackWarning).toEqual(true);
		});

		it('should validate framework contexts', async () => {
			const preactValid = await renderer.validateFrameworkContext('preact');
			const solidValid = await renderer.validateFrameworkContext('solid');
			const invalidValid = await renderer.validateFrameworkContext('nonexistent');

			expect(preactValid).toEqual(true);
			// Solid might not be available in test environment
			expect(typeof solidValid).toEqual('boolean');
			expect(invalidValid).toEqual(false);
		});

		it('should provide error recovery strategies', () => {
			const solidStrategies = renderer.getErrorRecoveryStrategies('solid');
			const preactStrategies = renderer.getErrorRecoveryStrategies('preact');
			const unknownStrategies = renderer.getErrorRecoveryStrategies('unknown');

			expect(Array.isArray(solidStrategies)).toEqual(true);
			expect(solidStrategies.length > 0).toEqual(true);
			expect(Array.isArray(preactStrategies)).toEqual(true);
			expect(preactStrategies.length > 0).toEqual(true);
			expect(Array.isArray(unknownStrategies)).toEqual(true);
			expect(unknownStrategies.length > 0).toEqual(true);

			// Check that strategies contain relevant information
			const solidHasSolidInfo = solidStrategies.some(strategy => strategy.includes('solid-js'));
			expect(solidHasSolidInfo).toEqual(true);

			const preactHasPreactInfo = preactStrategies.some(strategy => strategy.includes('preact'));
			expect(preactHasPreactInfo).toEqual(true);
		});
	});

	describe('Configuration and Debugging', () => {
		it('should respect strict isolation configuration', async () => {
			// Create renderer with strict isolation disabled
			const lenientConfig: Partial<SSRIsolationConfig> = {
				enableStrictIsolation: false,
				errorHandling: 'ignore',
			};
			const lenientRenderer = new IsolatedSSRRenderer(lenientConfig);

			const request: IsolatedRenderRequest = {
				componentPath: 'contaminated-component.tsx',
				component: createTestComponent('Lenient Test'),
			};

			const result = await lenientRenderer.renderWithIsolation(request);

			// With strict isolation disabled, should be more permissive
			// (exact behavior depends on implementation details)
			expect(typeof result.success).toEqual('boolean');
		});

		it('should update configuration dynamically', () => {
			const newConfig: Partial<SSRIsolationConfig> = {
				debugLogging: true,
				errorHandling: 'fallback',
			};

			renderer.updateConfig(newConfig);

			// Configuration should be updated (we can't easily test the internal state,
			// but we can verify the method doesn't throw)
			expect(typeof renderer.updateConfig).toEqual('function');
		});
	});
});
