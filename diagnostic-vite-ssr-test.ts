#!/usr/bin/env -S deno run --allow-all

/**
 * Diagnostic script to test Vite SSR module loading for Islands
 *
 * This script tests:
 * 1. Vite server setup and global availability
 * 2. SSR module loading for each framework type (Preact, Vue, Svelte, Solid)
 * 3. Module structure and export validation
 * 4. Error scenarios and fallback behavior
 */

import { createServer, type ViteDevServer } from 'vite';
import { join } from '@std/path';

interface TestResult {
	framework: string;
	src: string;
	success: boolean;
	error?: string;
	moduleInfo?: {
		hasDefault: boolean;
		exportKeys: string[];
		defaultType: string;
		moduleSize?: number;
	};
	loadTime?: number;
}

class ViteSSRTester {
	private viteServer: ViteDevServer | null = null;
	private results: TestResult[] = [];

	async setup(): Promise<void> {
		console.log('🚀 Setting up Vite SSR test environment...\n');

		try {
			// Create Vite server similar to the production setup
			this.viteServer = await createServer({
				configFile: 'Avalon/vite.config.ts',
				server: {
					middlewareMode: false,
					port: 5174, // Use different port to avoid conflicts
					strictPort: false,
					cors: true,
				},
				root: join(Deno.cwd(), 'Avalon'),
				logLevel: 'warn', // Reduce noise during testing
			});

			// Start the server
			await this.viteServer.listen();

			// Make it globally available like in production
			globalThis.__viteDevServer = this.viteServer;

			console.log('✅ Vite dev server started successfully');
			console.log(`📍 Server root: ${this.viteServer.config.root}`);
			console.log(`🌐 Server URL: http://localhost:${this.viteServer.config.server.port}\n`);
		} catch (error) {
			console.error('❌ Failed to setup Vite server:', error);
			throw error;
		}
	}

	async testIslandComponent(framework: string, src: string): Promise<TestResult> {
		const startTime = performance.now();
		const result: TestResult = {
			framework,
			src,
			success: false,
		};

		console.log(`🔍 Testing ${framework} component: ${src}`);

		try {
			if (!this.viteServer) {
				throw new Error('Vite server not initialized');
			}

			// Test SSR module loading
			console.log(`  📡 Loading module via viteServer.ssrLoadModule()...`);
			const module = await this.viteServer.ssrLoadModule(src);

			const loadTime = performance.now() - startTime;
			result.loadTime = loadTime;

			// Analyze the loaded module
			const moduleInfo = {
				hasDefault: !!module.default,
				exportKeys: Object.keys(module),
				defaultType: typeof module.default,
				moduleSize: JSON.stringify(module).length,
			};

			result.moduleInfo = moduleInfo;
			result.success = true;

			console.log(`  ✅ Module loaded successfully in ${loadTime.toFixed(2)}ms`);
			console.log(`  📦 Module info:`, {
				hasDefault: moduleInfo.hasDefault,
				exportKeys: moduleInfo.exportKeys,
				defaultType: moduleInfo.defaultType,
			});

			// Framework-specific validation
			await this.validateFrameworkModule(framework, module, src);
		} catch (error) {
			const loadTime = performance.now() - startTime;
			result.loadTime = loadTime;
			result.error = error instanceof Error ? error.message : String(error);

			console.log(`  ❌ Module loading failed after ${loadTime.toFixed(2)}ms`);
			console.log(`  🔍 Error:`, result.error);
		}

		console.log(''); // Add spacing
		return result;
	}

	private async validateFrameworkModule(framework: string, module: any, src: string): Promise<void> {
		console.log(`  🔍 Validating ${framework} module structure...`);

		switch (framework.toLowerCase()) {
			case 'preact':
				await this.validatePreactModule(module, src);
				break;
			case 'vue':
				await this.validateVueModule(module, src);
				break;
			case 'svelte':
				await this.validateSvelteModule(module, src);
				break;
			case 'solid':
				await this.validateSolidModule(module, src);
				break;
			default:
				console.log(`  ⚠️ Unknown framework: ${framework}`);
		}
	}

	private async validatePreactModule(module: any, src: string): Promise<void> {
		const component = module.default || module;

		if (typeof component !== 'function') {
			throw new Error(`Preact component should be a function, got ${typeof component}`);
		}

		console.log(`  ✅ Preact component is a valid function`);

		// Test if we can call the component (basic validation)
		try {
			const result = component({});
			console.log(`  ✅ Component callable, returns:`, typeof result);
		} catch (error) {
			console.log(`  ⚠️ Component call failed:`, error);
		}
	}

	private async validateVueModule(module: any, src: string): Promise<void> {
		const component = module.default || module;

		if (!component || typeof component !== 'object') {
			throw new Error(`Vue component should be an object, got ${typeof component}`);
		}

		console.log(`  ✅ Vue component is a valid object`);
		console.log(`  📋 Vue component keys:`, Object.keys(component));

		// Check for Vue-specific properties
		const hasSetup = 'setup' in component;
		const hasTemplate = 'template' in component;
		const hasRender = 'render' in component;

		console.log(`  🔍 Vue component structure:`, {
			hasSetup,
			hasTemplate,
			hasRender,
		});
	}

	private async validateSvelteModule(module: any, src: string): Promise<void> {
		const component = module.default || module;

		if (!component || typeof component !== 'object') {
			throw new Error(`Svelte component should be an object, got ${typeof component}`);
		}

		console.log(`  ✅ Svelte component is a valid object`);
		console.log(`  📋 Svelte component keys:`, Object.keys(component));

		// Check for Svelte-specific properties
		const hasRender = 'render' in component;
		const hasHydrate = 'hydrate' in module;

		console.log(`  🔍 Svelte component structure:`, {
			hasRender,
			hasHydrate,
		});

		if (hasRender && typeof component.render === 'function') {
			console.log(`  ✅ Svelte component has render function`);
		} else {
			console.log(`  ⚠️ Svelte component missing render function`);
		}
	}

	private async validateSolidModule(module: any, src: string): Promise<void> {
		const component = module.default || module;

		if (typeof component !== 'function') {
			throw new Error(`Solid component should be a function, got ${typeof component}`);
		}

		console.log(`  ✅ Solid component is a valid function`);

		// Test if we can call the component (basic validation)
		try {
			const result = component({});
			console.log(`  ✅ Solid component callable, returns:`, typeof result);
		} catch (error) {
			console.log(`  ⚠️ Solid component call failed:`, error);
		}
	}

	async runAllTests(): Promise<void> {
		console.log('🧪 Running comprehensive Vite SSR module loading tests...\n');

		// Test cases for each framework
		const testCases = [
			{ framework: 'Preact', src: '/src/islands/PreactCounter.tsx' },
			{ framework: 'Vue', src: '/src/islands/VueCounter.vue' },
			{ framework: 'Svelte', src: '/src/islands/SvelteCounter.svelte' },
			{ framework: 'Solid', src: '/src/islands/SolidCounter.tsx' },
		];

		// Run tests for each framework
		for (const testCase of testCases) {
			const result = await this.testIslandComponent(testCase.framework, testCase.src);
			this.results.push(result);
		}

		// Test error scenarios
		await this.testErrorScenarios();
	}

	private async testErrorScenarios(): Promise<void> {
		console.log('🚨 Testing error scenarios...\n');

		const errorCases = [
			{ framework: 'Unknown', src: '/src/islands/NonExistent.tsx' },
			{ framework: 'Invalid', src: '/invalid/path/Component.tsx' },
			{ framework: 'Malformed', src: 'not-a-valid-path' },
		];

		for (const testCase of errorCases) {
			const result = await this.testIslandComponent(testCase.framework, testCase.src);
			this.results.push(result);
		}
	}

	generateReport(): void {
		console.log('📊 VITE SSR MODULE LOADING TEST REPORT');
		console.log('='.repeat(50));
		console.log('');

		const successful = this.results.filter(r => r.success);
		const failed = this.results.filter(r => !r.success);

		console.log(`✅ Successful tests: ${successful.length}`);
		console.log(`❌ Failed tests: ${failed.length}`);
		console.log(`📊 Total tests: ${this.results.length}`);
		console.log('');

		if (successful.length > 0) {
			console.log('✅ SUCCESSFUL TESTS:');
			console.log('-'.repeat(30));
			successful.forEach(result => {
				console.log(`  ${result.framework}: ${result.src}`);
				console.log(`    Load time: ${result.loadTime?.toFixed(2)}ms`);
				if (result.moduleInfo) {
					console.log(`    Has default: ${result.moduleInfo.hasDefault}`);
					console.log(`    Export keys: ${result.moduleInfo.exportKeys.join(', ')}`);
				}
				console.log('');
			});
		}

		if (failed.length > 0) {
			console.log('❌ FAILED TESTS:');
			console.log('-'.repeat(30));
			failed.forEach(result => {
				console.log(`  ${result.framework}: ${result.src}`);
				console.log(`    Error: ${result.error}`);
				console.log(`    Load time: ${result.loadTime?.toFixed(2)}ms`);
				console.log('');
			});
		}

		// Analysis and recommendations
		console.log('🔍 ANALYSIS:');
		console.log('-'.repeat(30));

		const frameworkResults = this.groupResultsByFramework();
		for (const [framework, results] of Object.entries(frameworkResults)) {
			const successCount = results.filter(r => r.success).length;
			const totalCount = results.length;
			console.log(`  ${framework}: ${successCount}/${totalCount} successful`);
		}

		console.log('');
		this.generateRecommendations();
	}

	private groupResultsByFramework(): Record<string, TestResult[]> {
		const grouped: Record<string, TestResult[]> = {};

		for (const result of this.results) {
			if (!grouped[result.framework]) {
				grouped[result.framework] = [];
			}
			grouped[result.framework].push(result);
		}

		return grouped;
	}

	private generateRecommendations(): void {
		console.log('💡 RECOMMENDATIONS:');
		console.log('-'.repeat(30));

		const failed = this.results.filter(r => !r.success);

		if (failed.length === 0) {
			console.log('  🎉 All tests passed! Vite SSR module loading is working correctly.');
			return;
		}

		// Analyze common failure patterns
		const errorPatterns = new Map<string, number>();
		failed.forEach(result => {
			if (result.error) {
				const errorType = this.categorizeError(result.error);
				errorPatterns.set(errorType, (errorPatterns.get(errorType) || 0) + 1);
			}
		});

		for (const [errorType, count] of errorPatterns.entries()) {
			console.log(`  🔧 ${errorType}: ${count} occurrence(s)`);
			console.log(`     ${this.getRecommendationForError(errorType)}`);
			console.log('');
		}
	}

	private categorizeError(error: string): string {
		if (error.includes('Failed to resolve')) {
			return 'Module Resolution Error';
		}
		if (error.includes('ENOENT') || error.includes('not found')) {
			return 'File Not Found';
		}
		if (error.includes('SyntaxError')) {
			return 'Syntax Error';
		}
		if (error.includes('Import')) {
			return 'Import Error';
		}
		return 'Unknown Error';
	}

	private getRecommendationForError(errorType: string): string {
		switch (errorType) {
			case 'Module Resolution Error':
				return 'Check Vite configuration and module resolution settings';
			case 'File Not Found':
				return 'Verify file paths and ensure components exist in expected locations';
			case 'Syntax Error':
				return 'Check component syntax and ensure valid TypeScript/JavaScript';
			case 'Import Error':
				return 'Verify import statements and dependency availability';
			default:
				return 'Review error details and check Vite server configuration';
		}
	}

	async cleanup(): Promise<void> {
		console.log('🧹 Cleaning up test environment...');

		if (this.viteServer) {
			await this.viteServer.close();
			console.log('✅ Vite server closed');
		}

		// Clear global reference
		globalThis.__viteDevServer = undefined;
	}
}

// Main execution
async function main() {
	const tester = new ViteSSRTester();

	try {
		await tester.setup();
		await tester.runAllTests();
		tester.generateReport();
	} catch (error) {
		console.error('💥 Test execution failed:', error);
		Deno.exit(1);
	} finally {
		await tester.cleanup();
	}
}

if (import.meta.main) {
	main();
}
