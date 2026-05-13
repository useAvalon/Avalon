import { describe, it, expect } from 'vitest';
import { generateMainPage } from './pages';
import type { ProjectConfig } from '../types';

describe('generateMainPage', () => {
	const baseConfig: ProjectConfig = {
		projectName: 'my-app',
		integrations: [],
		styling: 'css-modules',
		plugins: [],
		middleware: 'h3',
		deploy: 'none',
	};

	it('exports a default async function', () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain('export default async function HomePage');
	});

	it('includes Avalon in the heading', () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain('<h1');
		expect(result).toContain('Avalon');
	});

	it('does not include the folder name in the heading', () => {
		const config: ProjectConfig = { ...baseConfig, projectName: 'cool-project' };
		const result = generateMainPage(config);
		expect(result).not.toContain('cool-project');
	});

	it('includes metadata export with Avalon title', () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain('export const metadata');
		expect(result).toContain("title: 'Avalon");
	});

	it('includes documentation link to useavalon.dev', () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain('https://useavalon.dev/docs/introduction');
		expect(result).toContain('Documentation');
	});

	it('includes GitHub link', () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain('https://github.com/useAvalon/Avalon');
		expect(result).toContain('GitHub');
	});

	it('includes get-started hint to edit the page', () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain('Edit app/modules/main/pages/index.tsx');
	});

	it('includes Powered by Avalon footer', () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain('Powered by');
		expect(result).toContain('https://useavalon.dev');
	});

	it('uses inline styles regardless of styling option', () => {
		for (const styling of ['css-modules', 'tailwind', 'shadcn'] as const) {
			const config: ProjectConfig = { ...baseConfig, styling };
			const result = generateMainPage(config);
			expect(result).toContain('style={{');
			expect(result).not.toContain('.module.css');
			expect(result).not.toContain('className={styles.');
		}
	});

	it('does not import any CSS modules', () => {
		const result = generateMainPage(baseConfig);
		expect(result).not.toContain('import styles');
	});

	it('includes Islands Architecture label', () => {
		const result = generateMainPage(baseConfig);
		expect(result).toContain('Islands Architecture');
	});
});
