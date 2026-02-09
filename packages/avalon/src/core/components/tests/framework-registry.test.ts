/**
 * Framework Registry Tests
 *
 * Test suite for the framework registry and configuration system,
 * including validation, management, and configuration operations.
 */

import { assertEquals, assertExists, assert } from '@std/assert';
import { FrameworkRegistry, createFrameworkConfig, defaultFrameworkRegistry } from '../framework-registry.ts';
import type { FrameworkConfig } from '../enhanced-framework-detector.ts';

Deno.test('FrameworkRegistry - Basic Operations', async t => {
	await t.step('should initialize with default frameworks', () => {
		const registry = new FrameworkRegistry();
		const frameworks = registry.getAllFrameworks();

		assert(frameworks.has('preact'));
		assert(frameworks.has('solid'));
		assert(frameworks.has('vue'));
		assert(frameworks.has('svelte'));
		assertEquals(frameworks.size, 4);
	});

	await t.step('should get framework by name', () => {
		const registry = new FrameworkRegistry();
		const preactConfig = registry.getFramework('preact');

		assertExists(preactConfig);
		assertEquals(preactConfig.name, 'preact');
		assert(preactConfig.fileExtensions.includes('.tsx'));
		assert(preactConfig.jsxImportSources.includes('preact'));
	});

	await t.step('should return undefined for non-existent framework', () => {
		const registry = new FrameworkRegistry();
		const config = registry.getFramework('nonexistent');

		assertEquals(config, undefined);
	});
});

Deno.test('FrameworkRegistry - Framework Registration', async t => {
	await t.step('should register valid custom framework', () => {
		const registry = new FrameworkRegistry();
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

		const result = registry.registerFramework('custom', customConfig);

		assertEquals(result.isValid, true);
		assertEquals(result.errors.length, 0);

		const registered = registry.getFramework('custom');
		assertExists(registered);
		assertEquals(registered.name, 'custom');
	});

	await t.step('should reject invalid framework configuration', () => {
		const registry = new FrameworkRegistry();
		const invalidConfig: FrameworkConfig = {
			name: '',
			fileExtensions: [],
			jsxImportSources: [],
			ssrModules: [],
			hydrationModules: [],
			detectionPatterns: {
				imports: [],
				content: [],
				jsxPragmas: [],
			},
		};

		const result = registry.registerFramework('invalid', invalidConfig);

		assertEquals(result.isValid, false);
		assert(result.errors.length > 0);
		assert(result.errors.some(e => e.includes('name is required')));
		assert(result.errors.some(e => e.includes('file extension is required')));
	});

	await t.step('should prevent custom frameworks when disabled', () => {
		const registry = new FrameworkRegistry({ allowCustomFrameworks: false });
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

		const result = registry.registerFramework('custom', customConfig);

		assertEquals(result.isValid, false);
		assert(result.errors.some(e => e.includes('Custom framework')));
	});
});

Deno.test('FrameworkRegistry - Framework Updates', async t => {
	await t.step('should update existing framework', () => {
		const registry = new FrameworkRegistry();

		const result = registry.updateFramework('preact', {
			fileExtensions: ['.tsx', '.jsx', '.preact'],
		});

		assertEquals(result.isValid, true);

		const updated = registry.getFramework('preact');
		assertExists(updated);
		assert(updated.fileExtensions.includes('.preact'));
	});

	await t.step('should reject update for non-existent framework', () => {
		const registry = new FrameworkRegistry();

		const result = registry.updateFramework('nonexistent', {
			fileExtensions: ['.test'],
		});

		assertEquals(result.isValid, false);
		assert(result.errors.some(e => e.includes('not found')));
	});

	await t.step('should validate updates', () => {
		const registry = new FrameworkRegistry();

		const result = registry.updateFramework('preact', {
			fileExtensions: [], // Invalid - empty extensions
		});

		assertEquals(result.isValid, false);
		assert(result.errors.some(e => e.includes('file extension is required')));
	});
});

Deno.test('FrameworkRegistry - Framework Removal', async t => {
	await t.step('should remove custom frameworks', () => {
		const registry = new FrameworkRegistry();

		// First register a custom framework
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

		registry.registerFramework('custom', customConfig);

		// Then remove it
		const removed = registry.unregisterFramework('custom');

		assertEquals(removed, true);
		assertEquals(registry.getFramework('custom'), undefined);
	});

	await t.step('should not remove default frameworks', () => {
		const registry = new FrameworkRegistry();

		const removed = registry.unregisterFramework('preact');

		assertEquals(removed, false);
		assertExists(registry.getFramework('preact'));
	});
});

Deno.test('FrameworkRegistry - Validation', async t => {
	await t.step('should validate framework configuration completeness', () => {
		const registry = new FrameworkRegistry();

		const validConfig: FrameworkConfig = {
			name: 'test',
			fileExtensions: ['.test'],
			jsxImportSources: ['test-framework'],
			ssrModules: ['test-framework/server'],
			hydrationModules: ['test-framework/client'],
			detectionPatterns: {
				imports: [/^test-framework$/],
				content: [/\btestHook\b/],
				jsxPragmas: ['@jsxImportSource test-framework'],
			},
		};

		const result = registry.validateFrameworkConfig(validConfig);

		assertEquals(result.isValid, true);
		assertEquals(result.errors.length, 0);
	});

	await t.step('should detect missing required fields', () => {
		const registry = new FrameworkRegistry();

		const incompleteConfig = {
			name: 'test',
			fileExtensions: ['.test'],
			// Missing required fields
		} as FrameworkConfig;

		const result = registry.validateFrameworkConfig(incompleteConfig);

		assertEquals(result.isValid, false);
		assert(result.errors.length > 0);
	});

	await t.step('should validate file extension format', () => {
		const registry = new FrameworkRegistry();

		const invalidConfig: FrameworkConfig = {
			name: 'test',
			fileExtensions: ['tsx', 'jsx'], // Missing dots
			jsxImportSources: ['test-framework'],
			ssrModules: ['test-framework/server'],
			hydrationModules: ['test-framework/client'],
			detectionPatterns: {
				imports: [/^test-framework$/],
				content: [/\btestHook\b/],
				jsxPragmas: ['@jsxImportSource test-framework'],
			},
		};

		const result = registry.validateFrameworkConfig(invalidConfig);

		assertEquals(result.isValid, false);
		assert(result.errors.some(e => e.includes('must start with a dot')));
	});

	await t.step('should warn about potential conflicts', () => {
		const registry = new FrameworkRegistry();

		// Register a framework that conflicts with existing ones
		const conflictingConfig: FrameworkConfig = {
			name: 'conflicting',
			fileExtensions: ['.tsx'], // Conflicts with preact/solid
			jsxImportSources: ['preact'], // Conflicts with preact
			ssrModules: ['conflicting/server'],
			hydrationModules: ['conflicting/client'],
			detectionPatterns: {
				imports: [/^conflicting$/],
				content: [/\bconflictingHook\b/],
				jsxPragmas: ['@jsxImportSource conflicting'],
			},
		};

		const result = registry.validateFrameworkConfig(conflictingConfig);

		// Should be valid but with warnings
		assertEquals(result.isValid, true);
		assert(result.warnings.length > 0);
		assert(result.warnings.some(w => w.includes('overlap')));
	});
});

Deno.test('FrameworkRegistry - Query Operations', async t => {
	await t.step('should get frameworks by extension', () => {
		const registry = new FrameworkRegistry();

		const tsxFrameworks = registry.getFrameworksByExtension('.tsx');

		assert(tsxFrameworks.includes('preact'));
		assert(tsxFrameworks.includes('solid'));
		assert(!tsxFrameworks.includes('vue'));
		assert(!tsxFrameworks.includes('svelte'));
	});

	await t.step('should get frameworks by JSX import source', () => {
		const registry = new FrameworkRegistry();

		const preactFrameworks = registry.getFrameworksByJSXImportSource('preact');
		const solidFrameworks = registry.getFrameworksByJSXImportSource('solid-js');

		assertEquals(preactFrameworks, ['preact']);
		assertEquals(solidFrameworks, ['solid']);
	});

	await t.step('should return empty array for unknown extension', () => {
		const registry = new FrameworkRegistry();

		const unknownFrameworks = registry.getFrameworksByExtension('.unknown');

		assertEquals(unknownFrameworks, []);
	});
});

Deno.test('FrameworkRegistry - Configuration Management', async t => {
	await t.step('should export configuration', () => {
		const registry = new FrameworkRegistry();

		const config = registry.exportConfig();

		assertExists(config.preact);
		assertExists(config.solid);
		assertExists(config.vue);
		assertExists(config.svelte);
		assertEquals(Object.keys(config).length, 4);
	});

	await t.step('should import configuration', () => {
		const registry = new FrameworkRegistry();

		const customConfig = {
			custom1: createFrameworkConfig('custom1', {
				fileExtensions: ['.c1'],
				ssrModules: ['custom1/server'],
				hydrationModules: ['custom1/client'],
				importPatterns: [/^custom1$/],
			}),
			custom2: createFrameworkConfig('custom2', {
				fileExtensions: ['.c2'],
				ssrModules: ['custom2/server'],
				hydrationModules: ['custom2/client'],
				importPatterns: [/^custom2$/],
			}),
		};

		const results = registry.importConfig(customConfig);

		assertEquals(results.length, 2);
		assert(results.every(r => r.isValid));

		assertExists(registry.getFramework('custom1'));
		assertExists(registry.getFramework('custom2'));
	});

	await t.step('should reset to defaults', () => {
		const registry = new FrameworkRegistry();

		// Add custom framework
		const customConfig = createFrameworkConfig('custom', {
			fileExtensions: ['.custom'],
			ssrModules: ['custom/server'],
			hydrationModules: ['custom/client'],
			importPatterns: [/^custom$/],
		});

		registry.registerFramework('custom', customConfig);
		assertEquals(registry.getAllFrameworks().size, 5);

		// Reset
		registry.reset();
		assertEquals(registry.getAllFrameworks().size, 4);
		assertEquals(registry.getFramework('custom'), undefined);
	});
});

Deno.test('FrameworkRegistry - Statistics', async t => {
	await t.step('should provide accurate statistics', () => {
		const registry = new FrameworkRegistry();

		const stats = registry.getStats();

		assertEquals(stats.totalFrameworks, 4);
		assertEquals(stats.defaultFrameworks, 4);
		assertEquals(stats.customFrameworks, 0);
		assert(stats.supportedExtensions.includes('.tsx'));
		assert(stats.supportedExtensions.includes('.vue'));
		assert(stats.supportedExtensions.includes('.svelte'));
	});

	await t.step('should update statistics after adding custom frameworks', () => {
		const registry = new FrameworkRegistry();

		const customConfig = createFrameworkConfig('custom', {
			fileExtensions: ['.custom'],
			ssrModules: ['custom/server'],
			hydrationModules: ['custom/client'],
			importPatterns: [/^custom$/],
		});

		registry.registerFramework('custom', customConfig);

		const stats = registry.getStats();

		assertEquals(stats.totalFrameworks, 5);
		assertEquals(stats.defaultFrameworks, 4);
		assertEquals(stats.customFrameworks, 1);
		assert(stats.supportedExtensions.includes('.custom'));
	});
});

Deno.test('FrameworkRegistry - createFrameworkConfig Utility', async t => {
	await t.step('should create valid framework configuration', () => {
		const config = createFrameworkConfig('test', {
			fileExtensions: ['.test'],
			ssrModules: ['test/server'],
			hydrationModules: ['test/client'],
			importPatterns: [/^test$/, 'test-framework'],
			contentPatterns: [/\btestHook\b/, 'testFunction'],
			jsxPragmas: ['@jsxImportSource test'],
		});

		assertEquals(config.name, 'test');
		assertEquals(config.fileExtensions, ['.test']);
		assertEquals(config.ssrModules, ['test/server']);
		assertEquals(config.hydrationModules, ['test/client']);
		assertEquals(config.detectionPatterns.imports.length, 2);
		assertEquals(config.detectionPatterns.content.length, 2);
		assertEquals(config.detectionPatterns.jsxPragmas, ['@jsxImportSource test']);
	});

	await t.step('should handle optional parameters', () => {
		const config = createFrameworkConfig('minimal', {
			fileExtensions: ['.min'],
			ssrModules: ['minimal/server'],
			hydrationModules: ['minimal/client'],
			importPatterns: [/^minimal$/],
		});

		assertEquals(config.jsxImportSources, []);
		assertEquals(config.detectionPatterns.content, []);
		assertEquals(config.detectionPatterns.jsxPragmas, []);
	});
});

Deno.test('FrameworkRegistry - Default Registry Instance', async t => {
	await t.step('should provide working default instance', () => {
		const preactConfig = defaultFrameworkRegistry.getFramework('preact');

		assertExists(preactConfig);
		assertEquals(preactConfig.name, 'preact');
	});

	await t.step('should allow modifications to default instance', () => {
		const customConfig = createFrameworkConfig('test-default', {
			fileExtensions: ['.test-default'],
			ssrModules: ['test-default/server'],
			hydrationModules: ['test-default/client'],
			importPatterns: [/^test-default$/],
		});

		const result = defaultFrameworkRegistry.registerFramework('test-default', customConfig);

		assertEquals(result.isValid, true);
		assertExists(defaultFrameworkRegistry.getFramework('test-default'));

		// Clean up
		defaultFrameworkRegistry.unregisterFramework('test-default');
	});
});
