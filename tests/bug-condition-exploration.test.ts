/**
 * Bug Condition Exploration Tests
 *
 * These tests verify that the 15 identified defects EXIST in the unfixed codebase.
 * Each test asserts the EXPECTED (correct) behavior — so on unfixed code, they FAIL.
 * Failure confirms the bug exists.
 *
 * Categories:
 *   A — h3 v2 deprecated API usage (event.path, event.node)
 *   B — Windows dynamic import path incompatibility
 *   C — Broken test files (wrong assertions, missing imports, non-existent methods)
 *   D — Type system conflicts (LayoutRule signature, URLPattern)
 *   E — Code quality (replace vs replaceAll, beta vite, duplicated resolveIslandPath)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();

function readSource(relativePath: string): string {
	const fullPath = join(ROOT, relativePath);
	if (!existsSync(fullPath)) {
		throw new Error(`File not found: ${relativePath}`);
	}
	return readFileSync(fullPath, 'utf-8');
}

function findViolationsInFile(file: string): { file: string; line: number; text: string }[] {
	const content = readSource(file);
	const lines = content.split('\n');
	const results: { file: string; line: number; text: string }[] = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
		if (!/\bimport\s*\(/.test(line)) continue;
		if (/import\s*\(\s*["']/.test(line)) continue;
		const context = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
		if (!context.includes('toImportSpecifier') && !context.includes('pathToFileURL')) {
			results.push({ file, line: i + 1, text: trimmed });
		}
	}
	return results;
}

function findDynamicImportViolations(files: string[]): { file: string; line: number; text: string }[] {
	return files.flatMap(findViolationsInFile);
}

// ---------------------------------------------------------------------------
// Test A: h3 v2 Deprecated API Usage
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------
describe('Test A: h3 deprecated API usage', () => {
	const runtimeFiles = [
		'packages/avalon/src/middleware/executor.ts',
		'packages/avalon/src/nitro/middleware-adapter.ts',
		'packages/avalon/src/nitro/renderer.ts',
		'packages/avalon/src/nitro/caching.ts',
		'packages/avalon/src/nitro/api-handler.ts',
		'Avalon/server/middleware.ts',
		'Avalon/middleware/01.security.ts',
		'Avalon/middleware/02.api-cors.ts',
		'Avalon/src/pages/admin/_middleware.ts',
		'Avalon/src/api/_middleware.ts',
		'Avalon/src/pages/_middleware.ts',
	];

	it('should have zero `event.path` usages in runtime source files', () => {
		/**
		 * Validates: Requirements 2.2
		 * On unfixed code, event.path is used in multiple runtime files.
		 * After fix, all usages should be replaced with h3 v2 compatible APIs.
		 */
		const matches: { file: string; line: number; text: string }[] = [];

		for (const file of runtimeFiles) {
			const content = readSource(file);
			const lines = content.split('\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				// Skip comments (both // and block comments)
				const trimmed = line.trim();
				if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
				// Match event.path but not event.pathSomething (word boundary)
				if (/event\.path(?!\w)/.test(line)) {
					matches.push({ file, line: i + 1, text: trimmed });
				}
			}
		}

		const detail = matches.map(m => `  ${m.file}:${m.line} — ${m.text}`).join('\n');
		expect(matches, `Found ${matches.length} event.path usages:\n${detail}`).toHaveLength(0);
	});

	it('should have zero `getNodeEvent` usages in runtime source files', () => {
		/**
		 * Validates: Requirements 2.1
		 * In h3 v2, `getNodeEvent` does not exist. The correct way to access
		 * Node.js request/response objects is via `event.node.{req,res}`.
		 * After fix, all `getNodeEvent` calls should be replaced with `event.node`.
		 */
		const matches: { file: string; line: number; text: string }[] = [];

		for (const file of runtimeFiles) {
			const content = readSource(file);
			const lines = content.split('\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const trimmed = line.trim();
				if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
				if (/getNodeEvent/.test(line)) {
					matches.push({ file, line: i + 1, text: trimmed });
				}
			}
		}

		const detail = matches.map(m => `  ${m.file}:${m.line} — ${m.text}`).join('\n');
		expect(matches, `Found ${matches.length} getNodeEvent usages:\n${detail}`).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Test B: Windows Dynamic Import Path Incompatibility
// Validates: Requirements 2.3
// ---------------------------------------------------------------------------
describe('Test B: Windows dynamic import compatibility', () => {
	const integrationRendererFiles = [
		'packages/integrations/vue/server/renderer.ts',
		'packages/integrations/svelte/server/renderer.ts',
		'packages/integrations/solid/server/utils.ts',
		'packages/integrations/react/server/utils.ts',
		'packages/integrations/preact/server/utils.ts',
		'packages/integrations/lit/server/utils.ts',
		'packages/avalon/src/render/isolated-ssr-renderer.ts',
	];

	it('should use toImportSpecifier() or pathToFileURL() for all dynamic imports', () => {
		/**
		 * Validates: Requirements 2.3
		 * On unfixed code, dynamic import() calls use raw file paths which fail on Windows.
		 * After fix, all dynamic imports should use toImportSpecifier() or pathToFileURL().
		 */
		const violations = findDynamicImportViolations(integrationRendererFiles);

		const detail = violations.map(v => `  ${v.file}:${v.line} — ${v.text}`).join('\n');
		expect(
			violations,
			`Found ${violations.length} dynamic imports without Windows-safe path conversion:\n${detail}`,
		).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Test C: Broken Test Files
// Validates: Requirements 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10
// ---------------------------------------------------------------------------
describe('Test C: broken test files', () => {
	it('framework-registry.test.ts should pass without errors', () => {
		/**
		 * Validates: Requirements 2.8, 2.9, 2.10
		 * On unfixed code, this test fails because:
		 *   - `assert` is not imported
		 *   - `.toBeDefined()` is called as a method on the return value
		 *   - framework count asserts 4 instead of 6
		 */
		try {
			const result = execSync(
				'npx vitest run packages/avalon/src/core/components/tests/framework-registry.test.ts --reporter=verbose 2>&1',
				{ cwd: ROOT, encoding: 'utf-8', timeout: 60000 },
			);
			// If we get here, the test passed — which means the bug is fixed
			expect(result).toContain('pass');
		} catch (error: any) {
			// Test failed — this confirms the bug exists on unfixed code
			// We FAIL this exploration test to document the bug
			const output = error.stdout || error.stderr || error.message;
			expect.fail(
				`framework-registry.test.ts fails on unfixed code (confirms bugs 1.8, 1.9, 1.10):\n${output.slice(0, 2000)}`,
			);
		}
	});

	it('layout-matcher.test.ts should pass without errors', () => {
		/**
		 * Validates: Requirements 2.6
		 * On unfixed code, this test fails because:
		 *   - matches() is called with 2 params instead of 1
		 *   - createCustomRule() is called with 4 args instead of 3
		 */
		try {
			const result = execSync(
				'npx vitest run packages/avalon/src/core/layout/tests/layout-matcher.test.ts --reporter=verbose 2>&1',
				{ cwd: ROOT, encoding: 'utf-8', timeout: 60000 },
			);
			expect(result).toContain('pass');
		} catch (error: any) {
			const output = error.stdout || error.stderr || error.message;
			expect.fail(`layout-matcher.test.ts fails on unfixed code (confirms bugs 1.6):\n${output.slice(0, 2000)}`);
		}
	});

	it('enhanced-layout-resolver.test.ts should pass without errors', () => {
		/**
		 * Validates: Requirements 2.5
		 * On unfixed code, this test fails because:
		 *   - getLayoutStreaming() does not exist
		 *   - getErrorRecovery() does not exist
		 *   - createDevelopmentConfig() does not exist
		 */
		try {
			const result = execSync(
				'npx vitest run packages/avalon/src/core/layout/tests/enhanced-layout-resolver.test.ts --reporter=verbose 2>&1',
				{ cwd: ROOT, encoding: 'utf-8', timeout: 60000 },
			);
			expect(result).toContain('pass');
		} catch (error: any) {
			const output = error.stdout || error.stderr || error.message;
			expect.fail(
				`enhanced-layout-resolver.test.ts fails on unfixed code (confirms bug 1.5):\n${output.slice(0, 2000)}`,
			);
		}
	});

	it('layout-composer.test.ts should pass without errors', () => {
		/**
		 * Validates: Requirements 2.7
		 * On unfixed code, this test may fail because:
		 *   - preact/jsx-dev-runtime dependency is missing
		 */
		try {
			const result = execSync(
				'npx vitest run packages/avalon/src/core/layout/tests/layout-composer.test.ts --reporter=verbose 2>&1',
				{ cwd: ROOT, encoding: 'utf-8', timeout: 60000 },
			);
			expect(result).toContain('pass');
		} catch (error: any) {
			const output = error.stdout || error.stderr || error.message;
			expect.fail(`layout-composer.test.ts fails on unfixed code (confirms bug 1.7):\n${output.slice(0, 2000)}`);
		}
	});
});

// ---------------------------------------------------------------------------
// Test D: Type System Conflicts
// Validates: Requirements 2.11, 2.13
// ---------------------------------------------------------------------------
describe('Test D: type system conflicts', () => {
	it('LayoutRule.matches should have a consistent 1-param signature across all definitions', () => {
		/**
		 * Validates: Requirements 2.11
		 * On unfixed code, layout-system.d.ts defines LayoutRule.matches with 2 params
		 * (layoutPath: string, route: RouteInfo) while layout-types.ts defines it with
		 * 1 param (route: RouteInfo). After fix, all definitions should use 1-param.
		 */
		const layoutSystemDts = readSource('packages/avalon/src/layout-system.d.ts');
		const schemasLayout = readSource('packages/avalon/src/schemas/layout.ts');

		const twoParamSignatures: { file: string; text: string }[] = [];

		// Check layout-system.d.ts for 2-param matches signature
		if (/matches:\s*\(\s*layoutPath\s*:\s*string\s*,\s*route/.test(layoutSystemDts)) {
			twoParamSignatures.push({
				file: 'packages/avalon/src/layout-system.d.ts',
				text: 'matches: (layoutPath: string, route: RouteInfo) => boolean',
			});
		}

		// Check schemas/layout.ts for 2-param LayoutMatcherFunction
		if (/LayoutMatcherFunction\s*=\s*\(\s*layoutPath\s*:\s*string\s*,\s*route/.test(schemasLayout)) {
			twoParamSignatures.push({
				file: 'packages/avalon/src/schemas/layout.ts',
				text: 'LayoutMatcherFunction = (layoutPath: string, route: RouteInfo) => boolean',
			});
		}

		const detail = twoParamSignatures.map(v => `  ${v.file} — ${v.text}`).join('\n');
		expect(
			twoParamSignatures,
			`Found ${twoParamSignatures.length} files with 2-param LayoutRule.matches signature (should be 1-param):\n${detail}`,
		).toHaveLength(0);
	});

	it('URLPattern should be globally declared without per-file workarounds', () => {
		/**
		 * Validates: Requirements 2.13
		 * On unfixed code, layout-discovery.ts has a local `declare const URLPattern`
		 * workaround. After fix, URLPattern should be globally available via tsconfig.
		 */
		const layoutDiscovery = readSource('packages/avalon/src/core/layout/layout-discovery.ts');

		const hasLocalDeclare = /declare\s+(const|var|let|class)\s+URLPattern/.test(layoutDiscovery);

		expect(
			hasLocalDeclare,
			'layout-discovery.ts has a local `declare const URLPattern` workaround — should be globally declared',
		).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Test E: Code Quality Issues
// Validates: Requirements 2.12, 2.14, 2.15
// ---------------------------------------------------------------------------
describe('Test E: code quality issues', () => {
	it('ssr-precompile.ts and island-manifest.ts should use .replaceAll() not .replace()', () => {
		/**
		 * Validates: Requirements 2.12
		 * On unfixed code, .replace('/islands/', '/src/islands/') is used which only
		 * replaces the first occurrence. After fix, .replaceAll() should be used.
		 */
		const files = ['packages/avalon/src/build/ssr-precompile.ts', 'packages/avalon/src/build/island-manifest.ts'];

		const violations: { file: string; line: number; text: string }[] = [];

		for (const file of files) {
			const content = readSource(file);
			const lines = content.split('\n');
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const trimmed = line.trim();
				if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

				// Detect .replace() with string first arg for '/islands/' pattern
				// This should be .replaceAll() to replace all occurrences
				if (/\.replace\s*\(\s*['"]\/islands\/['"]/.test(line) && !/\.replaceAll/.test(line)) {
					violations.push({ file, line: i + 1, text: trimmed });
				}
			}
		}

		const detail = violations.map(v => `  ${v.file}:${v.line} — ${v.text}`).join('\n');
		expect(
			violations,
			`Found ${violations.length} .replace() calls that should be .replaceAll():\n${detail}`,
		).toHaveLength(0);
	});

	it('no package.json should contain beta in vite version', () => {
		/**
		 * Validates: Requirements 2.14
		 * On unfixed code, 9 package.json files pin vite: 8.0.0-beta.10.
		 * After fix, all should reference a stable release.
		 */
		const packageJsonFiles = [
			'package.json',
			'packages/avalon/package.json',
			'packages/integrations/core/package.json',
			'packages/integrations/vue/package.json',
			'packages/integrations/svelte/package.json',
			'packages/integrations/solid/package.json',
			'packages/integrations/react/package.json',
			'packages/integrations/preact/package.json',
			'packages/integrations/lit/package.json',
		];

		const violations: { file: string; version: string }[] = [];

		for (const file of packageJsonFiles) {
			const content = readSource(file);
			const pkg = JSON.parse(content);

			// Check dependencies and devDependencies for vite with beta
			for (const depKey of ['dependencies', 'devDependencies']) {
				const deps = pkg[depKey];
				if (deps && deps.vite && /beta/i.test(deps.vite)) {
					violations.push({ file, version: deps.vite });
				}
			}
		}

		const detail = violations.map(v => `  ${v.file} — vite: ${v.version}`).join('\n');
		expect(violations, `Found ${violations.length} package.json files with beta vite version:\n${detail}`).toHaveLength(
			0,
		);
	});

	it('should have no duplicate resolveIslandPath() in integration renderers', () => {
		/**
		 * Validates: Requirements 2.15
		 * On unfixed code, 6 integration renderers each have their own copy of
		 * resolveIslandPath(). After fix, they should import from the shared location.
		 */
		const integrationFiles = [
			'packages/integrations/vue/server/renderer.ts',
			'packages/integrations/svelte/server/renderer.ts',
			'packages/integrations/solid/server/utils.ts',
			'packages/integrations/react/server/utils.ts',
			'packages/integrations/preact/server/utils.ts',
			'packages/integrations/lit/server/utils.ts',
		];

		const filesWithLocalCopy: string[] = [];

		for (const file of integrationFiles) {
			const content = readSource(file);
			// Check if the file defines its own resolveIslandPath function
			if (/function\s+resolveIslandPath/.test(content)) {
				filesWithLocalCopy.push(file);
			}
		}

		const detail = filesWithLocalCopy.map(f => `  ${f}`).join('\n');
		expect(
			filesWithLocalCopy,
			`Found ${filesWithLocalCopy.length} integration renderers with local resolveIslandPath() copy:\n${detail}`,
		).toHaveLength(0);
	});
});
