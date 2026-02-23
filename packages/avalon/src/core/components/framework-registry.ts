/**
 * Framework Registry and Configuration System
 *
 * This module provides a centralized registry for framework configurations,
 * validation utilities, and management of framework-specific detection patterns.
 */

import type { FrameworkConfig } from './enhanced-framework-detector.ts';

export interface FrameworkRegistryConfig {
	enableValidation: boolean;
	allowCustomFrameworks: boolean;
	defaultFramework: string;
}

export interface FrameworkValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Centralized framework registry with validation and management
 */
export class FrameworkRegistry {
	private readonly frameworks: Map<string, FrameworkConfig>;
	private readonly config: FrameworkRegistryConfig;

	constructor(config: Partial<FrameworkRegistryConfig> = {}) {
		this.frameworks = new Map();
		this.config = {
			enableValidation: true,
			allowCustomFrameworks: true,
			defaultFramework: 'unknown',
			...config,
		};

		// Initialize with default frameworks
		this.initializeDefaultFrameworks();
	}

	/**
	 * Registers a new framework configuration
	 */
	registerFramework(name: string, config: FrameworkConfig): FrameworkValidationResult {
		const validation = this.validateFrameworkConfig(config);

		if (this.config.enableValidation && !validation.isValid) {
			return validation;
		}

		if (!this.config.allowCustomFrameworks && !this.isDefaultFramework(name)) {
			return {
				isValid: false,
				errors: [`Custom framework '${name}' not allowed`],
				warnings: [],
			};
		}

		this.frameworks.set(name, { ...config });

		return {
			isValid: true,
			errors: [],
			warnings: validation.warnings,
		};
	}

	/**
	 * Gets a framework configuration by name
	 */
	getFramework(name: string): FrameworkConfig | undefined {
		return this.frameworks.get(name);
	}

	/**
	 * Gets all registered frameworks
	 */
	getAllFrameworks(): Map<string, FrameworkConfig> {
		return new Map(this.frameworks);
	}

	/**
	 * Gets framework names that support a specific file extension
	 */
	getFrameworksByExtension(extension: string): string[] {
		const frameworks: string[] = [];

		for (const [name, config] of this.frameworks) {
			if (config.fileExtensions.includes(extension)) {
				frameworks.push(name);
			}
		}

		return frameworks;
	}

	/**
	 * Gets frameworks that use a specific JSX import source
	 */
	getFrameworksByJSXImportSource(importSource: string): string[] {
		const frameworks: string[] = [];

		for (const [name, config] of this.frameworks) {
			if (config.jsxImportSources.includes(importSource)) {
				frameworks.push(name);
			}
		}

		return frameworks;
	}

	/**
	 * Removes a framework from the registry
	 */
	unregisterFramework(name: string): boolean {
		if (this.isDefaultFramework(name)) {
			return false; // Cannot remove default frameworks
		}

		return this.frameworks.delete(name);
	}

	/**
	 * Updates an existing framework configuration
	 */
	updateFramework(name: string, updates: Partial<FrameworkConfig>): FrameworkValidationResult {
		const existing = this.frameworks.get(name);
		if (!existing) {
			return {
				isValid: false,
				errors: [`Framework '${name}' not found`],
				warnings: [],
			};
		}

		const updated = { ...existing, ...updates };
		const validation = this.validateFrameworkConfig(updated);

		if (this.config.enableValidation && !validation.isValid) {
			return validation;
		}

		this.frameworks.set(name, updated);

		return {
			isValid: true,
			errors: [],
			warnings: validation.warnings,
		};
	}

	/**
	 * Validates a framework configuration
	 */
	validateFrameworkConfig(config: FrameworkConfig): FrameworkValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Required fields validation
		if (!config.name || config.name.trim() === '') {
			errors.push('Framework name is required and cannot be empty');
		}

		if (!config.fileExtensions || config.fileExtensions.length === 0) {
			errors.push('At least one file extension is required');
		} else {
			// Validate file extensions format
			for (const ext of config.fileExtensions) {
				if (!ext.startsWith('.')) {
					errors.push(`File extension '${ext}' must start with a dot`);
				}
			}
		}

		if (!config.jsxImportSources || config.jsxImportSources.length === 0) {
			warnings.push('No JSX import sources defined - detection may be less accurate');
		}

		if (!config.ssrModules || config.ssrModules.length === 0) {
			errors.push('At least one SSR module is required');
		}

		if (!config.hydrationModules || config.hydrationModules.length === 0) {
			errors.push('At least one hydration module is required');
		}

		// Detection patterns validation
		if (config.detectionPatterns) {
			if (!config.detectionPatterns.imports || config.detectionPatterns.imports.length === 0) {
				errors.push('At least one import pattern is required for detection');
			}

			if (!config.detectionPatterns.content || config.detectionPatterns.content.length === 0) {
				warnings.push('No content patterns defined - detection may be less accurate');
			}

			if (!config.detectionPatterns.jsxPragmas || config.detectionPatterns.jsxPragmas.length === 0) {
				warnings.push('No JSX pragmas defined - detection may be less accurate');
			}
		} else {
			errors.push('Detection patterns are required');
		}

		// Cross-validation checks
		this.validateCrossFrameworkConflicts(config, warnings);

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		};
	}

	/**
	 * Checks for potential conflicts with other registered frameworks
	 */
	private validateCrossFrameworkConflicts(config: FrameworkConfig, warnings: string[]): void {
		// Skip validation if config is incomplete
		if (!config.fileExtensions || !config.jsxImportSources) {
			return;
		}

		for (const [existingName, existingConfig] of this.frameworks) {
			if (existingName === config.name) continue;

			// Check for overlapping file extensions
			if (existingConfig.fileExtensions) {
				const overlappingExtensions = config.fileExtensions.filter(ext => existingConfig.fileExtensions.includes(ext));

				if (overlappingExtensions.length > 0) {
					warnings.push(`File extensions ${overlappingExtensions.join(', ')} overlap with framework '${existingName}'`);
				}
			}

			// Check for overlapping JSX import sources
			if (existingConfig.jsxImportSources) {
				const overlappingImportSources = config.jsxImportSources.filter(source =>
					existingConfig.jsxImportSources.includes(source)
				);

				if (overlappingImportSources.length > 0) {
					warnings.push(
						`JSX import sources ${overlappingImportSources.join(', ')} overlap with framework '${existingName}'`
					);
				}
			}
		}
	}

	/**
	 * Checks if a framework is a default framework
	 */
	private isDefaultFramework(name: string): boolean {
		return ['preact', 'solid', 'vue', 'svelte', 'react', 'lit'].includes(name);
	}

	/**
	 * Initializes the registry with default framework configurations
	 */
	private initializeDefaultFrameworks(): void {
		const defaultFrameworks = this.getDefaultFrameworkConfigs();

		for (const [name, config] of Object.entries(defaultFrameworks)) {
			this.frameworks.set(name, config);
		}
	}

	/**
	 * Gets default framework configurations
	 */
	private getDefaultFrameworkConfigs(): Record<string, FrameworkConfig> {
		return {
			preact: {
				name: 'preact',
				fileExtensions: ['.tsx', '.jsx'],
				jsxImportSources: ['preact'],
				ssrModules: ['preact-render-to-string'],
				hydrationModules: ['preact'],
				detectionPatterns: {
					imports: [/^preact$/, /^preact\//, /preact-render-to-string/],
					content: [
						/\buseState\b/,
						/\buseEffect\b/,
						/\buseCallback\b/,
						/\buseMemo\b/,
						/\buseRef\b/,
						/\buseContext\b/,
						/\buseReducer\b/,
						/from\s+['"]preact['"]/,
						/import\s+.*\s+from\s+['"]preact['"]/,
					],
					jsxPragmas: ['@jsxImportSource preact'],
				},
			},
			solid: {
				name: 'solid',
				fileExtensions: ['.tsx', '.jsx'],
				jsxImportSources: ['solid-js'],
				ssrModules: ['solid-js/web'],
				hydrationModules: ['solid-js/web'],
				detectionPatterns: {
					imports: [/^solid-js$/, /^solid-js\//, /solid-js\/web/, /solid-js\/store/],
					content: [
						/\bcreateSignal\b/,
						/\bcreateEffect\b/,
						/\bcreateMemo\b/,
						/\bcreateResource\b/,
						/\bcreateStore\b/,
						/\bonMount\b/,
						/\bonCleanup\b/,
						/\bShow\b/,
						/\bFor\b/,
						/from\s+['"]solid-js['"]/,
						/import\s+.*\s+from\s+['"]solid-js['"]/,
					],
					jsxPragmas: ['@jsxImportSource solid-js'],
				},
			},
			vue: {
				name: 'vue',
				fileExtensions: ['.vue'],
				jsxImportSources: ['vue'],
				ssrModules: ['vue/server-renderer'],
				hydrationModules: ['vue'],
				detectionPatterns: {
					imports: [/^vue$/, /^@vue\//, /vue\/server-renderer/, /vue\/composition-api/],
					content: [
						/<template>/,
						/<script>/,
						/<style>/,
						/\bref\b/,
						/\breactive\b/,
						/\bcomputed\b/,
						/\bwatchEffect\b/,
						/\bwatch\b/,
						/\bonMounted\b/,
						/\bonUnmounted\b/,
						/from\s+['"]vue['"]/,
						/import\s+.*\s+from\s+['"]vue['"]/,
					],
					jsxPragmas: ['@jsxImportSource vue'],
				},
			},
			svelte: {
				name: 'svelte',
				fileExtensions: ['.svelte'],
				jsxImportSources: ['svelte'],
				ssrModules: ['svelte/server'],
				hydrationModules: ['svelte'],
				detectionPatterns: {
					imports: [/^svelte$/, /^svelte\//, /svelte\/store/, /svelte\/motion/, /svelte\/transition/],
					content: [
						/<script>/,
						/<style>/,
						/\$:/,
						/\bonMount\b/,
						/\bafterUpdate\b/,
						/\bbeforeUpdate\b/,
						/\bonDestroy\b/,
						/\btick\b/,
						/from\s+['"]svelte['"]/,
						/import\s+.*\s+from\s+['"]svelte['"]/,
					],
					jsxPragmas: ['@jsxImportSource svelte'],
				},
			},
			react: {
				name: 'react',
				fileExtensions: ['.jsx', '.tsx'],
				jsxImportSources: ['react'],
				ssrModules: ['react-dom/server'],
				hydrationModules: ['react-dom/client'],
				detectionPatterns: {
					imports: [
						/^react$/,
						/^react\//,
						/^react-dom$/,
						/^react-dom\//,
						/from\s+['"]react['"]/,
						/from\s+['"]react\/[^'"]+['"]/,
						/from\s+['"]react-dom['"]/,
					],
					content: [
						/\buseState\b/,
						/\buseEffect\b/,
						/\buseContext\b/,
						/\buseReducer\b/,
						/\buseCallback\b/,
						/\buseMemo\b/,
						/\buseRef\b/,
						/\buseTransition\b/,
						/\buseDeferredValue\b/,
						/\buseId\b/,
						/\buseImperativeHandle\b/,
						/\buseLayoutEffect\b/,
						/["']use client["']/,
						/["']use server["']/,
						/from\s+['"]react['"]/,
						/import\s+.*\s+from\s+['"]react['"]/,
					],
					jsxPragmas: ['@jsxImportSource react'],
				},
			},
			lit: {
				name: 'lit',
				fileExtensions: ['.ts', '.js'],
				jsxImportSources: ['lit'],
				ssrModules: ['@lit-labs/ssr'],
				hydrationModules: ['lit'],
				detectionPatterns: {
					imports: [
						/^lit$/,
						/^lit\//,
						/^@lit\//,
						/^@lit-labs\/ssr/,
						/from\s+['"]lit['"]/,
						/from\s+['"]lit\/[^'"]+['"]/,
						/from\s+['"]@lit\/[^'"]+['"]/,
					],
					content: [
						/\bLitElement\b/,
						/\bcustomElement\b/,
						/@customElement/,
						/@property/,
						/@state/,
						/@query/,
						/@queryAll/,
						/\bhtml`/,
						/\bcss`/,
						/extends\s+LitElement/,
						/from\s+['"]lit['"]/,
						/import\s+.*\s+from\s+['"]lit['"]/,
					],
					jsxPragmas: ['@jsxImportSource lit'],
				},
			},
		};
	}

	/**
	 * Exports the current registry configuration
	 */
	exportConfig(): Record<string, FrameworkConfig> {
		const config: Record<string, FrameworkConfig> = {};

		for (const [name, frameworkConfig] of this.frameworks) {
			config[name] = { ...frameworkConfig };
		}

		return config;
	}

	/**
	 * Imports a registry configuration
	 */
	importConfig(config: Record<string, FrameworkConfig>): FrameworkValidationResult[] {
		const results: FrameworkValidationResult[] = [];

		for (const [name, frameworkConfig] of Object.entries(config)) {
			const result = this.registerFramework(name, frameworkConfig);
			results.push(result);
		}

		return results;
	}

	/**
	 * Resets the registry to default frameworks only
	 */
	reset(): void {
		this.frameworks.clear();
		this.initializeDefaultFrameworks();
	}

	/**
	 * Gets registry statistics
	 */
	getStats(): {
		totalFrameworks: number;
		defaultFrameworks: number;
		customFrameworks: number;
		supportedExtensions: string[];
	} {
		const defaultFrameworkNames = new Set(['preact', 'solid', 'vue', 'svelte', 'react', 'lit']);
		const defaultCount = Array.from(this.frameworks.keys()).filter(name => defaultFrameworkNames.has(name)).length;

		const allExtensions = new Set<string>();
		for (const config of this.frameworks.values()) {
			config.fileExtensions.forEach(ext => allExtensions.add(ext));
		}

		return {
			totalFrameworks: this.frameworks.size,
			defaultFrameworks: defaultCount,
			customFrameworks: this.frameworks.size - defaultCount,
			supportedExtensions: Array.from(allExtensions).sort((a, b) => a.localeCompare(b)),
		};
	}
}

/**
 * Default framework registry instance
 */
export const defaultFrameworkRegistry = new FrameworkRegistry();

/**
 * Utility function to create a framework configuration
 */
export function createFrameworkConfig(
	name: string,
	options: {
		fileExtensions: string[];
		jsxImportSources?: string[];
		ssrModules: string[];
		hydrationModules: string[];
		importPatterns: (string | RegExp)[];
		contentPatterns?: (string | RegExp)[];
		jsxPragmas?: string[];
	}
): FrameworkConfig {
	return {
		name,
		fileExtensions: options.fileExtensions,
		jsxImportSources: options.jsxImportSources || [],
		ssrModules: options.ssrModules,
		hydrationModules: options.hydrationModules,
		detectionPatterns: {
			imports: options.importPatterns.map(pattern => (typeof pattern === 'string' ? new RegExp(pattern) : pattern)),
			content: (options.contentPatterns || []).map(pattern =>
				typeof pattern === 'string' ? new RegExp(pattern) : pattern
			),
			jsxPragmas: options.jsxPragmas || [],
		},
	};
}
