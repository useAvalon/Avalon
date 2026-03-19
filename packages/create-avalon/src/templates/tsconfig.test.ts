import { describe, it, expect } from 'vitest';
import { generateTsConfig, generateEnvDts } from './tsconfig';

describe('generateTsConfig', () => {
	it('returns valid JSON with 2-space indent', () => {
		const result = generateTsConfig();
		expect(() => JSON.parse(result)).not.toThrow();
		expect(result).toContain('  "compilerOptions"');
	});

	it('sets compilerOptions correctly', () => {
		const tsconfig = JSON.parse(generateTsConfig());
		const opts = tsconfig.compilerOptions;
		expect(opts.target).toBe('ESNext');
		expect(opts.module).toBe('ESNext');
		expect(opts.moduleResolution).toBe('bundler');
		expect(opts.strict).toBe(true);
		expect(opts.esModuleInterop).toBe(true);
		expect(opts.skipLibCheck).toBe(true);
		expect(opts.allowArbitraryExtensions).toBe(true);
		expect(opts.allowImportingTsExtensions).toBe(true);
		expect(opts.noEmit).toBe(true);
		expect(opts.jsx).toBe('react-jsx');
	});

	it('does not include types array (uses env.d.ts triple-slash reference instead)', () => {
		const tsconfig = JSON.parse(generateTsConfig());
		expect(tsconfig.compilerOptions.types).toBeUndefined();
	});

	it('includes @shared/* and @modules/* path aliases', () => {
		const tsconfig = JSON.parse(generateTsConfig());
		const paths = tsconfig.compilerOptions.paths;
		expect(paths['@shared/*']).toEqual(['./app/shared/*']);
		expect(paths['@modules/*']).toEqual(['./app/modules/*']);
	});

	it('includes .d.ts files in include array', () => {
		const tsconfig = JSON.parse(generateTsConfig());
		expect(tsconfig.include).toContain('app/**/*.d.ts');
	});

	it('includes all required glob patterns in include array', () => {
		const tsconfig = JSON.parse(generateTsConfig());
		expect(tsconfig.include).toEqual([
			'app/**/*.ts',
			'app/**/*.tsx',
			'app/**/*.d.ts',
			'server/**/*.ts',
			'routes/**/*.ts',
			'middleware/**/*.ts',
		]);
	});

	it('has exactly 2 path aliases', () => {
		const tsconfig = JSON.parse(generateTsConfig());
		expect(Object.keys(tsconfig.compilerOptions.paths)).toHaveLength(2);
	});

	it('has exactly 6 include patterns', () => {
		const tsconfig = JSON.parse(generateTsConfig());
		expect(tsconfig.include).toHaveLength(6);
	});
});

describe('generateEnvDts', () => {
	it('includes triple-slash reference to avalon types', () => {
		const result = generateEnvDts();
		expect(result).toContain('/// <reference types="@useavalon/avalon/types" />');
	});

	it('declares virtual:avalon/config module', () => {
		const result = generateEnvDts();
		expect(result).toContain("declare module 'virtual:avalon/config'");
	});
});
