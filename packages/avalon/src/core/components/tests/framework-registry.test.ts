/**
 * Framework Registry Tests
 *
 * Test suite for the framework registry and configuration system,
 * including validation, management, and configuration operations.
 */

import { describe, it, expect } from 'vitest';
import { FrameworkRegistry, createFrameworkConfig, defaultFrameworkRegistry } from '../framework-registry.ts';
import type { FrameworkConfig } from '../enhanced-framework-detector.ts';

describe('FrameworkRegistry - Basic Operations', () => {
	it('should initialize with default frameworks', () => {
		const registry = new FrameworkRegistry();
		const frameworks = registry.getAllFrameworks();

		assert(frameworks.has('preact'));
		assert(frameworks.has('solid'));
		assert(frameworks.has('vue'));
		assert(frameworks.has('svelte'));
		expect(frameworks.size).toEqual(4);
	});

	it('should get framework by name', () => {
		const registry = new FrameworkRegistry();
		const preactConfig = registry.getFramework('preact');

		expect(preactConfig).toBeDefined();
		expect(preactConfig.name).toEqual('preact');
		assert(preactConfig.fileExtensions.includes('.tsx'));
		assert(preactConfig.jsxImportSources.includes('preact'));
	});

	it('should return undefined for non-existent framework', () => {
		const registry = new FrameworkRegistry();
		const config = registry.getFramework('nonexistent');

		expect(config).toEqual(undefined);
	});
});

describe('FrameworkRegistry - Framework Registration', () => {
	it('should register valid custom framework', () => {
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

		expect(result.isValid).toEqual(true);
		expect(result.errors.length).toEqual(0);

		const registered = registry.getFramework('custom');
		expect(registered).toBeDefined();
		expect(registered.name).toEqual('custom');
	});

	it('should reject invalid framework configuration', () => {
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

		expect(result.isValid).toEqual(false);
		expect(result.errors.length > 0).toBeTruthy();
		assert(result.errors.some(e => e.includes('name is required')));
		assert(result.errors.some(e => e.includes('file extension is required')));
	});

	it('should prevent custom frameworks when disabled', () => {
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

		expect(result.isValid).toEqual(false);
		assert(result.errors.some(e => e.includes('Custom framework')));
	});
});

describe('FrameworkRegistry - Framework Updates', () => {
	it('should update existing framework', () => {
		const registry = new FrameworkRegistry();

		const result = registry.updateFramework('preact', {
			fileExtensions: ['.tsx', '.jsx', '.preact'],
		});

		expect(result.isValid).toEqual(true);

		const updated = registry.getFramework('preact');
		expect(updated).toBeDefined();
		assert(updated.fileExtensions.includes('.preact'));
	});

	it('should reject update for non-existent framework', () => {
		const registry = new FrameworkRegistry();

		const result = registry.updateFramework('nonexistent', {
			fileExtensions: ['.test'],
		});

		expect(result.isValid).toEqual(false);
		assert(result.errors.some(e => e.includes('not found')));
	});

	it('should validate updates', () => {
		const registry = new FrameworkRegistry();

		const result = registry.updateFramework('preact', {
			fileExtensions: [], // Invalid - empty extensions
		});

		expect(result.isValid).toEqual(false);
		assert(result.errors.some(e => e.includes('file extension is required')));
	});
});

describe('FrameworkRegistry - Framework Removal', () => {
	it('should remove custom frameworks', () => {
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

		expect(removed).toEqual(true);
		expect(registry.getFramework('custom')).toEqual(undefined);
	});

	it('should not remove default frameworks', () => {
		const registry = new FrameworkRegistry();

		const removed = registry.unregisterFramework('preact');

		expect(removed).toEqual(false);
		expect(registry.getFramework('preact').toBeDefined());
	});
});

describe('FrameworkRegistry - Validation', () => {
	it('should validate framework configuration completeness', () => {
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

		expect(result.isValid).toEqual(true);
		expect(result.errors.length).toEqual(0);
	});

	it('should detect missing required fields', () => {
		const registry = new FrameworkRegistry();

		const incompleteConfig = {
			name: 'test',
			fileExtensions: ['.test'],
			// Missing required fields
		} as FrameworkConfig;

		const result = registry.validateFrameworkConfig(incompleteConfig);

		expect(result.isValid).toEqual(false);
		expect(result.errors.length > 0).toBeTruthy();
	});

	it('should validate file extension format', () => {
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

		expect(result.isValid).toEqual(false);
		assert(result.errors.some(e => e.includes('must start with a dot')));
	});

	it('should warn about potential conflicts', () => {
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
		expect(result.isValid).toEqual(true);
		expect(result.warnings.length > 0).toBeTruthy();
		assert(result.warnings.some(w => w.includes('overlap')));
	});
});

describe('FrameworkRegistry - Query Operations', () => {
	it('should get frameworks by extension', () => {
		const registry = new FrameworkRegistry();

		const tsxFrameworks = registry.getFrameworksByExtension('.tsx');

		assert(tsxFrameworks.includes('preact'));
		assert(tsxFrameworks.includes('solid'));
		assert(!tsxFrameworks.includes('vue'));
		assert(!tsxFrameworks.includes('svelte'));
	});

	it('should get frameworks by JSX import source', () => {
		const registry = new FrameworkRegistry();

		const preactFrameworks = registry.getFrameworksByJSXImportSource('preact');
		const solidFrameworks = registry.getFrameworksByJSXImportSource('solid-js');

		expect(preactFrameworks).toEqual(['preact']);
		expect(solidFrameworks).toEqual(['solid']);
	});

	it('should return empty array for unknown extension', () => {
		const registry = new FrameworkRegistry();

		const unknownFrameworks = registry.getFrameworksByExtension('.unknown');

		expect(unknownFrameworks).toEqual([]);
	});
});

describe('FrameworkRegistry - Configuration Management', () => {
	it('should export configuration', () => {
		const registry = new FrameworkRegistry();

		const config = registry.exportConfig();

		expect(config.preact).toBeDefined();
		expect(config.solid).toBeDefined();
		expect(config.vue).toBeDefined();
		expect(config.svelte).toBeDefined();
		expect(Object.keys(config).length).toEqual(4);
	});

	it('should import configuration', () => {
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

		expect(results.length).toEqual(2);
		assert(results.every(r => r.isValid));

		expect(registry.getFramework('custom1').toBeDefined());
		expect(registry.getFramework('custom2').toBeDefined());
	});

	it('should reset to defaults', () => {
		const registry = new FrameworkRegistry();

		// Add custom framework
		const customConfig = createFrameworkConfig('custom', {
			fileExtensions: ['.custom'],
			ssrModules: ['custom/server'],
			hydrationModules: ['custom/client'],
			importPatterns: [/^custom$/],
		});

		registry.registerFramework('custom', customConfig);
		expect(registry.getAllFrameworks().size).toEqual(5);

		// Reset
		registry.reset();
		expect(registry.getAllFrameworks().size).toEqual(4);
		expect(registry.getFramework('custom')).toEqual(undefined);
	});
});

describe('FrameworkRegistry - Statistics', () => {
	it('should provide accurate statistics', () => {
		const registry = new FrameworkRegistry();

		const stats = registry.getStats();

		expect(stats.totalFrameworks).toEqual(4);
		expect(stats.defaultFrameworks).toEqual(4);
		expect(stats.customFrameworks).toEqual(0);
		assert(stats.supportedExtensions.includes('.tsx'));
		assert(stats.supportedExtensions.includes('.vue'));
		assert(stats.supportedExtensions.includes('.svelte'));
	});

	it('should update statistics after adding custom frameworks', () => {
		const registry = new FrameworkRegistry();

		const customConfig = createFrameworkConfig('custom', {
			fileExtensions: ['.custom'],
			ssrModules: ['custom/server'],
			hydrationModules: ['custom/client'],
			importPatterns: [/^custom$/],
		});

		registry.registerFramework('custom', customConfig);

		const stats = registry.getStats();

		expect(stats.totalFrameworks).toEqual(5);
		expect(stats.defaultFrameworks).toEqual(4);
		expect(stats.customFrameworks).toEqual(1);
		assert(stats.supportedExtensions.includes('.custom'));
	});
});

describe('FrameworkRegistry - createFrameworkConfig Utility', () => {
	it('should create valid framework configuration', () => {
		const config = createFrameworkConfig('test', {
			fileExtensions: ['.test'],
			ssrModules: ['test/server'],
			hydrationModules: ['test/client'],
			importPatterns: [/^test$/, 'test-framework'],
			contentPatterns: [/\btestHook\b/, 'testFunction'],
			jsxPragmas: ['@jsxImportSource test'],
		});

		expect(config.name).toEqual('test');
		expect(config.fileExtensions).toEqual(['.test']);
		expect(config.ssrModules).toEqual(['test/server']);
		expect(config.hydrationModules).toEqual(['test/client']);
		expect(config.detectionPatterns.imports.length).toEqual(2);
		expect(config.detectionPatterns.content.length).toEqual(2);
		expect(config.detectionPatterns.jsxPragmas).toEqual(['@jsxImportSource test']);
	});

	it('should handle optional parameters', () => {
		const config = createFrameworkConfig('minimal', {
			fileExtensions: ['.min'],
			ssrModules: ['minimal/server'],
			hydrationModules: ['minimal/client'],
			importPatterns: [/^minimal$/],
		});

		expect(config.jsxImportSources).toEqual([]);
		expect(config.detectionPatterns.content).toEqual([]);
		expect(config.detectionPatterns.jsxPragmas).toEqual([]);
	});
});

describe('FrameworkRegistry - Default Registry Instance', () => {
	it('should provide working default instance', () => {
		const preactConfig = defaultFrameworkRegistry.getFramework('preact');

		expect(preactConfig).toBeDefined();
		expect(preactConfig.name).toEqual('preact');
	});

	it('should allow modifications to default instance', () => {
		const customConfig = createFrameworkConfig('test-default', {
			fileExtensions: ['.test-default'],
			ssrModules: ['test-default/server'],
			hydrationModules: ['test-default/client'],
			importPatterns: [/^test-default$/],
		});

		const result = defaultFrameworkRegistry.registerFramework('test-default', customConfig);

		expect(result.isValid).toEqual(true);
		expect(defaultFrameworkRegistry.getFramework('test-default').toBeDefined());

		// Clean up
		defaultFrameworkRegistry.unregisterFramework('test-default');
	});
});
