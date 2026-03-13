/**
 * Enhanced Framework Detection System
 *
 * This module provides advanced framework detection with multi-evidence analysis,
 * confidence scoring, and JSX import source parsing to accurately identify
 * component frameworks and prevent cross-framework conflicts.
 */

export interface FrameworkDetectionResult {
	framework: 'preact' | 'solid' | 'vue' | 'svelte' | 'react' | 'lit' | 'qwik' | 'unknown';
	confidence: 'high' | 'medium' | 'low';
	evidence: string[];
	warnings: string[];
}

export interface DetectionCriteria {
	fileExtension: string;
	jsxImportSource?: string;
	imports: string[];
	content: string;
}

export interface FrameworkConfig {
	name: string;
	fileExtensions: string[];
	jsxImportSources: string[];
	ssrModules: string[];
	hydrationModules: string[];
	detectionPatterns: {
		imports: RegExp[];
		content: RegExp[];
		jsxPragmas: string[];
	};
}

/**
 * Enhanced Framework Detector with multi-evidence analysis
 */
export class EnhancedFrameworkDetector {
	private readonly frameworkRegistry: Map<string, FrameworkConfig>;

	constructor(frameworkConfigs?: Record<string, FrameworkConfig>) {
		this.frameworkRegistry = new Map();

		// Initialize with provided configs or defaults
		const configs = frameworkConfigs || this.getDefaultFrameworkConfigs();
		Object.entries(configs).forEach(([name, config]) => {
			this.frameworkRegistry.set(name, config);
		});
	}

	/**
	 * Detects framework with multi-evidence analysis
	 */
	detectFramework(filePath: string, content: string): FrameworkDetectionResult {
		const criteria = this.extractDetectionCriteria(filePath, content);
		const evidence: string[] = [];
		const warnings: string[] = [];

		// Check for explicit naming conventions first (highest priority)
		if (filePath.includes('.solid.')) {
			evidence.push('Explicit Solid naming convention (.solid.tsx/.solid.jsx)');
			return {
				framework: 'solid',
				confidence: 'high',
				evidence,
				warnings,
			};
		}

		if (filePath.includes('.preact.')) {
			evidence.push('Explicit Preact naming convention (.preact.tsx/.preact.jsx)');
			return {
				framework: 'preact',
				confidence: 'high',
				evidence,
				warnings,
			};
		}

		if (filePath.includes('.react.')) {
			evidence.push('Explicit React naming convention (.react.tsx/.react.jsx)');
			return {
				framework: 'react',
				confidence: 'high',
				evidence,
				warnings,
			};
		}

		if (filePath.includes('.lit.')) {
			evidence.push('Explicit Lit naming convention (.lit.ts/.lit.js)');
			return {
				framework: 'lit',
				confidence: 'high',
				evidence,
				warnings,
			};
		}

		if (filePath.includes('.qwik.')) {
			evidence.push('Explicit Qwik naming convention (.qwik.tsx/.qwik.jsx)');
			return {
				framework: 'qwik',
				confidence: 'high',
				evidence,
				warnings,
			};
		}

		// Score each framework based on evidence
		const frameworkScores = new Map<string, number>();

		for (const [frameworkName, config] of this.frameworkRegistry) {
			const score = this.calculateFrameworkScore(criteria, config, evidence);
			frameworkScores.set(frameworkName, score);
		}

		// Find the highest scoring framework
		const sortedFrameworks = Array.from(frameworkScores.entries()).sort(([, a], [, b]) => b - a);

		const [topFramework, topScore] = sortedFrameworks[0] || ['unknown', 0];
		const [secondFramework, secondScore] = sortedFrameworks[1] || ['unknown', 0];

		// Determine confidence based on score and evidence
		let confidence: FrameworkDetectionResult['confidence'];
		if (topScore >= 3 && topScore - secondScore >= 2) {
			confidence = 'high';
		} else if (topScore >= 2) {
			confidence = 'medium';
		} else {
			confidence = 'low';
			warnings.push(
				'Framework detection has low confidence - consider adding explicit JSX import source or use naming convention (.solid.tsx, .preact.tsx)'
			);
		}

		// Handle ambiguous cases
		if (topScore === secondScore && topScore > 0) {
			warnings.push(
				`Ambiguous detection between ${topFramework} and ${secondFramework} - consider using naming convention`
			);
			confidence = 'low';
		}

		return {
			framework: topScore > 0 ? (topFramework as FrameworkDetectionResult['framework']) : 'unknown',
			confidence,
			evidence,
			warnings,
		};
	}

	/**
	 * Extracts detection criteria from file path and content
	 */
	private extractDetectionCriteria(filePath: string, content: string): DetectionCriteria {
		const fileExtension = this.getFileExtension(filePath);
		const jsxImportSource = this.parseJSXImportSource(content);
		const imports = this.extractImportStatements(content);

		return {
			fileExtension,
			jsxImportSource,
			imports,
			content,
		};
	}

	/**
	 * Calculates framework score based on multiple evidence points
	 */
	private calculateFrameworkScore(criteria: DetectionCriteria, config: FrameworkConfig, evidence: string[]): number {
		let score = 0;

		// JSX Import Source (highest priority - 3 points)
		if (criteria.jsxImportSource && config.jsxImportSources.includes(criteria.jsxImportSource)) {
			score += 3;
			evidence.push(`JSX import source: @jsxImportSource ${criteria.jsxImportSource}`);
		}

		// Import statements (2 points each)
		for (const importPattern of config.detectionPatterns.imports) {
			if (criteria.imports.some(imp => importPattern.test(imp))) {
				score += 2;
				evidence.push(`Framework import detected: ${importPattern.source}`);
			}
		}

		// Content patterns (1 point each)
		for (const contentPattern of config.detectionPatterns.content) {
			if (contentPattern.test(criteria.content)) {
				score += 1;
				evidence.push(`Framework-specific content pattern: ${contentPattern.source}`);
			}
		}

		// File extension (0.5 points - lowest priority)
		if (config.fileExtensions.includes(criteria.fileExtension)) {
			score += 0.5;
			evidence.push(`File extension: ${criteria.fileExtension}`);
		}

		return score;
	}

	/**
	 * Parses JSX import source from content
	 */
	private parseJSXImportSource(content: string): string | undefined {
		// Look for @jsxImportSource pragma (handles both // and /** */ comment styles)
		const jsxImportSourceRegex = /@jsxImportSource\s+([^\s*]+)/;
		const match = jsxImportSourceRegex.exec(content);

		if (match) {
			return match[1];
		}

		return undefined;
	}

	/**
	 * Extracts import statements from content
	 */
	private extractImportStatements(content: string): string[] {
		const imports: string[] = [];

		// Match ES6 import specifiers: import ... from 'module'
		const importFromRegex = /from\s+['"]([^'"]+)['"]/g;
		// Match side-effect imports: import 'module'
		const sideEffectRegex = /import\s+['"]([^'"]+)['"]/g;
		// Match require statements: require('module')
		const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

		let match;
		while ((match = importFromRegex.exec(content)) !== null) {
			imports.push(match[1]);
		}
		while ((match = sideEffectRegex.exec(content)) !== null) {
			imports.push(match[1]);
		}
		while ((match = requireRegex.exec(content)) !== null) {
			imports.push(match[1]);
		}

		return imports;
	}

	/**
	 * Gets file extension from path, handling framework-specific naming conventions
	 */
	private getFileExtension(filePath: string): string {
		// Handle framework-specific naming conventions first
		if (filePath.includes('.solid.')) {
			return '.solid.tsx'; // Treat as special Solid extension
		}
		if (filePath.includes('.preact.')) {
			return '.preact.tsx'; // Treat as special Preact extension
		}
		if (filePath.includes('.react.')) {
			return '.react.tsx'; // Treat as special React extension
		}
		if (filePath.includes('.lit.')) {
			return '.lit.ts'; // Treat as special Lit extension
		}

		const lastDot = filePath.lastIndexOf('.');
		return lastDot === -1 ? '' : filePath.substring(lastDot);
	}

	/**
	 * Gets default framework configurations
	 */
	private getDefaultFrameworkConfigs(): Record<string, FrameworkConfig> {
		return {
			preact: {
				name: 'preact',
				fileExtensions: ['.tsx', '.jsx', '.preact.tsx', '.preact.jsx'],
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
						/from\s+['"]preact['"]/,
					],
					jsxPragmas: ['@jsxImportSource preact'],
				},
			},
			solid: {
				name: 'solid',
				fileExtensions: ['.tsx', '.jsx', '.solid.tsx', '.solid.jsx'],
				jsxImportSources: ['solid-js'],
				ssrModules: ['solid-js/web'],
				hydrationModules: ['solid-js/web'],
				detectionPatterns: {
					imports: [/^solid-js$/, /^solid-js\//, /solid-js\/web/],
					content: [
						/\bcreateSignal\b/,
						/\bcreateEffect\b/,
						/\bcreateMemo\b/,
						/\bcreateResource\b/,
						/\bonMount\b/,
						/\bonCleanup\b/,
						/from\s+['"]solid-js['"]/,
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
					imports: [/^vue$/, /^@vue\//, /vue\/server-renderer/],
					content: [
						/<template>/,
						/<script>/,
						/<style>/,
						/\bref\b/,
						/\breactive\b/,
						/\bcomputed\b/,
						/\bwatchEffect\b/,
						/from\s+['"]vue['"]/,
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
					imports: [/^svelte$/, /^svelte\//, /svelte\/store/],
					content: [
						/<script>/,
						/<style>/,
						/\$:/,
						/\bonMount\b/,
						/\bafterUpdate\b/,
						/\bbeforeUpdate\b/,
						/from\s+['"]svelte['"]/,
					],
					jsxPragmas: ['@jsxImportSource svelte'],
				},
			},
			react: {
				name: 'react',
				fileExtensions: ['.jsx', '.tsx', '.react.jsx', '.react.tsx'],
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
				fileExtensions: ['.ts', '.js', '.lit.ts', '.lit.js'],
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
			qwik: {
				name: 'qwik',
				fileExtensions: ['.tsx', '.jsx', '.qwik.tsx', '.qwik.jsx'],
				jsxImportSources: ['@builder.io/qwik'],
				ssrModules: ['@builder.io/qwik/server'],
				hydrationModules: ['@builder.io/qwik'],
				detectionPatterns: {
					imports: [
						/^@builder\.io\/qwik$/,
						/^@builder\.io\/qwik\//,
						/from\s+['"]@builder\.io\/qwik['"]/,
						/from\s+['"]@builder\.io\/qwik\/[^'"]+['"]/,
					],
					content: [
						/\bcomponent\$/,
						/\buseSignal\b/,
						/\buseStore\b/,
						/\buseTask\$/,
						/\buseVisibleTask\$/,
						/\buseResource\$/,
						/\buseContext\b/,
						/\buseContextProvider\b/,
						/\$\(\s*\(/,
						/from\s+['"]@builder\.io\/qwik['"]/,
						/import\s+.*\s+from\s+['"]@builder\.io\/qwik['"]/,
					],
					jsxPragmas: ['@jsxImportSource @builder.io/qwik'],
				},
			},
		};
	}

	/**
	 * Adds or updates a framework configuration
	 */
	addFrameworkConfig(name: string, config: FrameworkConfig): void {
		this.frameworkRegistry.set(name, config);
	}

	/**
	 * Gets all registered framework configurations
	 */
	getFrameworkConfigs(): Map<string, FrameworkConfig> {
		return new Map(this.frameworkRegistry);
	}

	/**
	 * Validates framework configuration completeness
	 */
	validateFrameworkConfig(config: FrameworkConfig): string[] {
		const errors: string[] = [];

		if (!config.name || config.name.trim() === '') {
			errors.push('Framework name is required');
		}

		if (!config.fileExtensions || config.fileExtensions.length === 0) {
			errors.push('At least one file extension is required');
		}

		if (!config.detectionPatterns.imports || config.detectionPatterns.imports.length === 0) {
			errors.push('At least one import pattern is required for detection');
		}

		if (!config.ssrModules || config.ssrModules.length === 0) {
			errors.push('At least one SSR module is required');
		}

		if (!config.hydrationModules || config.hydrationModules.length === 0) {
			errors.push('At least one hydration module is required');
		}

		return errors;
	}
}
