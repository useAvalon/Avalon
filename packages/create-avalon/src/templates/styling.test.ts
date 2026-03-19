import { describe, it, expect } from 'vitest';
import { generateStylingFiles } from './styling';
import type { ProjectConfig } from '../types';

describe('generateStylingFiles', () => {
	const baseConfig: ProjectConfig = {
		projectName: 'my-app',
		integrations: [],
		styling: 'css-modules',
		plugins: [],
		middleware: 'h3',
	};

	// --- Common files ---

	it('always generates main.css', () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.has('app/shared/styles/main.css')).toBe(true);
	});

	it('generates reset.css for css-modules', () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.has('app/shared/styles/reset.css')).toBe(true);
	});

	it('does not generate reset.css for tailwind', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
		const files = generateStylingFiles(config);
		expect(files.has('app/shared/styles/reset.css')).toBe(false);
	});

	it('does not generate reset.css for shadcn', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'shadcn' };
		const files = generateStylingFiles(config);
		expect(files.has('app/shared/styles/reset.css')).toBe(false);
	});

	it('main.css imports reset.css for css-modules', () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.get('app/shared/styles/main.css')).toContain("@import './reset.css'");
	});

	it('main.css does not import reset.css for tailwind', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
		const files = generateStylingFiles(config);
		expect(files.get('app/shared/styles/main.css')).not.toContain("@import './reset.css'");
	});

	// --- CSS Modules ---

	it('generates tokens.css for css-modules', () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.has('app/shared/styles/tokens.css')).toBe(true);
		expect(files.get('app/shared/styles/tokens.css')).toContain('--color-primary');
	});

	it('generates .module.css for shared layout with css-modules', () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.has('app/shared/layouts/_layout.module.css')).toBe(true);
		expect(files.get('app/shared/layouts/_layout.module.css')).toContain('.layout');
	});

	it('generates .module.css for home page with css-modules', () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.has('app/modules/home/pages/index.module.css')).toBe(true);
		expect(files.get('app/modules/home/pages/index.module.css')).toContain('.page');
	});

	it('generates .module.css for home layout with css-modules', () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.has('app/modules/home/layouts/_layout.module.css')).toBe(true);
		expect(files.get('app/modules/home/layouts/_layout.module.css')).toContain('.layout');
	});

	it('main.css imports tokens.css for css-modules', () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.get('app/shared/styles/main.css')).toContain("@import './tokens.css'");
	});

	it('does not generate tailwind files for css-modules', () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.has('tailwind.config.js')).toBe(false);
		expect(files.has('app/shared/styles/global.css')).toBe(false);
		expect(files.has('components.json')).toBe(false);
	});

	// --- Tailwind ---

	it('generates tailwind.config.js for tailwind', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
		const files = generateStylingFiles(config);
		expect(files.has('tailwind.config.js')).toBe(true);
		expect(files.get('tailwind.config.js')).toContain('content');
		expect(files.get('tailwind.config.js')).toContain('app/**/*.{ts,tsx}');
	});

	it('generates global.css with tailwind directive for tailwind', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
		const files = generateStylingFiles(config);
		expect(files.has('app/shared/styles/global.css')).toBe(true);
		expect(files.get('app/shared/styles/global.css')).toContain('@import "tailwindcss"');
	});

	it('main.css imports global.css for tailwind', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
		const files = generateStylingFiles(config);
		expect(files.get('app/shared/styles/main.css')).toContain("@import './global.css'");
	});

	it('does not generate css-modules files for tailwind', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
		const files = generateStylingFiles(config);
		expect(files.has('app/shared/styles/tokens.css')).toBe(false);
		expect(files.has('app/shared/layouts/_layout.module.css')).toBe(false);
		expect(files.has('app/modules/home/pages/index.module.css')).toBe(false);
		expect(files.has('app/modules/home/layouts/_layout.module.css')).toBe(false);
	});

	it('does not generate components.json for tailwind', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'tailwind' };
		const files = generateStylingFiles(config);
		expect(files.has('components.json')).toBe(false);
	});

	// --- shadcn ---

	it('generates tailwind.config.js for shadcn', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'shadcn' };
		const files = generateStylingFiles(config);
		expect(files.has('tailwind.config.js')).toBe(true);
		expect(files.get('tailwind.config.js')).toContain('content');
	});

	it('generates global.css with tailwind directive for shadcn', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'shadcn' };
		const files = generateStylingFiles(config);
		expect(files.has('app/shared/styles/global.css')).toBe(true);
		expect(files.get('app/shared/styles/global.css')).toContain('@import "tailwindcss"');
	});

	it('generates components.json for shadcn', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'shadcn' };
		const files = generateStylingFiles(config);
		expect(files.has('components.json')).toBe(true);
		const json = JSON.parse(files.get('components.json')!);
		expect(json.$schema).toBe('https://ui.shadcn.com/schema.json');
		expect(json.style).toBe('default');
		expect(json.tailwind.config).toBe('tailwind.config.js');
		expect(json.aliases.components).toBe('@shared/components');
	});

	it('does not generate css-modules files for shadcn', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'shadcn' };
		const files = generateStylingFiles(config);
		expect(files.has('app/shared/styles/tokens.css')).toBe(false);
		expect(files.has('app/shared/layouts/_layout.module.css')).toBe(false);
		expect(files.has('app/modules/home/pages/index.module.css')).toBe(false);
		expect(files.has('app/modules/home/layouts/_layout.module.css')).toBe(false);
	});

	it('generates cn utility for shadcn', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'shadcn' };
		const files = generateStylingFiles(config);
		expect(files.has('app/shared/utils/cn.ts')).toBe(true);
		expect(files.get('app/shared/utils/cn.ts')).toContain('twMerge');
		expect(files.get('app/shared/utils/cn.ts')).toContain('clsx');
	});

	it('shadcn global.css includes CSS variables', () => {
		const config: ProjectConfig = { ...baseConfig, styling: 'shadcn' };
		const files = generateStylingFiles(config);
		expect(files.get('app/shared/styles/global.css')).toContain('@theme inline');
		expect(files.get('app/shared/styles/global.css')).toContain('--color-primary');
	});

	// --- Reset CSS content ---

	it('reset.css contains box-sizing reset', () => {
		const files = generateStylingFiles(baseConfig);
		expect(files.get('app/shared/styles/reset.css')).toContain('box-sizing: border-box');
	});
});
