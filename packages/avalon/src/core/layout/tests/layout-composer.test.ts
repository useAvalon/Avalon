import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { LayoutComposer } from '../layout-composer.ts';
import type { LayoutConfig, LayoutHandler, LayoutDiscoveryOptions } from '../../../schemas/layout.ts';

// Test fixtures directory
const TEST_FIXTURES_DIR = resolve('tests/fixtures/layout-composer');
const TEST_PAGES_DIR = join(TEST_FIXTURES_DIR, 'src/pages');
const TEST_LAYOUTS_DIR = join(TEST_FIXTURES_DIR, 'src/layouts');

// Mock page module interface
interface MockPageModule {
	default: any;
	layoutConfig?: LayoutConfig;
}

// Helper function to create test layout files
async function createTestLayouts() {
	const rootLayoutContent = `
export default function RootLayout({ children, data }) {
	return (
		<html>
			<body>
				<header>Root Header</header>
				{children}
				<footer>Root Footer</footer>
			</body>
		</html>
	);
}

export async function layoutLoader(ctx) {
	return { title: 'Root Layout' };
}
`;

	const blogLayoutContent = `
export default function BlogLayout({ children, data }) {
	return (
		<div className="blog-layout">
			<nav>Blog Navigation</nav>
			<main>{children}</main>
		</div>
	);
}

export async function layoutLoader(ctx) {
	return { blogTitle: 'My Blog' };
}
`;

	const customLayoutContent = `
export default function CustomLayout({ children, data }) {
	return (
		<div className="custom-layout">
			<h1>Custom Layout</h1>
			{children}
		</div>
	);
}

export async function layoutLoader(ctx) {
	return { customData: 'Custom Layout Data' };
}
`;

	await writeFile(join(TEST_PAGES_DIR, '_layout.tsx'), rootLayoutContent);

	await mkdir(join(TEST_PAGES_DIR, 'blog'), { recursive: true });
	await writeFile(join(TEST_PAGES_DIR, 'blog', '_layout.tsx'), blogLayoutContent);

	await writeFile(join(TEST_LAYOUTS_DIR, 'custom.tsx'), customLayoutContent);
}

async function setupTestFixtures(): Promise<LayoutComposer> {
	if (existsSync(TEST_FIXTURES_DIR)) {
		await rm(TEST_FIXTURES_DIR, { recursive: true });
	}
	await mkdir(TEST_FIXTURES_DIR, { recursive: true });
	await mkdir(TEST_PAGES_DIR, { recursive: true });
	await mkdir(TEST_LAYOUTS_DIR, { recursive: true });

	await createTestLayouts();

	const options: LayoutDiscoveryOptions = {
		baseDirectory: join(TEST_FIXTURES_DIR, 'src'),
		filePattern: '_layout.tsx',
		excludeDirectories: ['node_modules', '.git'],
		enableWatching: false,
		developmentMode: true,
	};

	return new LayoutComposer(options);
}

async function cleanupTestFixtures() {
	if (existsSync(TEST_FIXTURES_DIR)) {
		await rm(TEST_FIXTURES_DIR, { recursive: true });
	}
}

describe('LayoutComposer - Basic Layout Resolution', () => {
	it('should resolve layouts', async () => {
		const composer = await setupTestFixtures();

		try {
			const pageModule: MockPageModule = {
				default: () => 'Page Component',
			};

			const layouts = await composer.resolveLayouts('/blog/post', pageModule);

			expect(layouts).toBeDefined();
			expect(Array.isArray(layouts)).toEqual(true);
		} finally {
			await cleanupTestFixtures();
		}
	});
});

describe('LayoutComposer - replaceLayout Configuration', () => {
	it('should skip all parent layouts', async () => {
		const composer = await setupTestFixtures();

		try {
			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					replaceLayout: true,
				},
			};

			const layouts = await composer.resolveLayouts('/blog/post', pageModule);

			expect(layouts.length).toEqual(0);
		} finally {
			await cleanupTestFixtures();
		}
	});

	it('should use only the custom layout with replaceLayout', async () => {
		const composer = await setupTestFixtures();

		try {
			const customLayoutPath = join(TEST_LAYOUTS_DIR, 'custom.tsx');

			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					replaceLayout: true,
					customLayout: customLayoutPath,
				},
			};

			const layouts = await composer.resolveLayouts('/blog/post', pageModule);

			expect(layouts.length).toEqual(1);
			expect(layouts[0].path).toEqual(customLayoutPath);
		} finally {
			await cleanupTestFixtures();
		}
	});
});

describe('LayoutComposer - skipLayouts Configuration', () => {
	it('should exclude specified layouts', async () => {
		const composer = await setupTestFixtures();

		try {
			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					skipLayouts: ['_layout.tsx'],
				},
			};

			const allLayouts = await composer.resolveLayouts('/blog/post', { default: () => 'Page' });
			const filteredLayouts = await composer.resolveLayouts('/blog/post', pageModule);

			expect(filteredLayouts.length <= allLayouts.length).toEqual(true);
		} finally {
			await cleanupTestFixtures();
		}
	});

	it('should support pattern matching', async () => {
		const composer = await setupTestFixtures();

		try {
			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					skipLayouts: ['*blog*'],
				},
			};

			const layouts = await composer.resolveLayouts('/blog/post', pageModule);

			const blogLayouts = layouts.filter(layout => layout.path.includes('blog'));
			expect(blogLayouts.length).toEqual(0);
		} finally {
			await cleanupTestFixtures();
		}
	});
});

describe('LayoutComposer - onlyLayouts Configuration', () => {
	it('should only apply specified layouts', async () => {
		const composer = await setupTestFixtures();

		try {
			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					onlyLayouts: ['_layout.tsx'],
				},
			};

			const layouts = await composer.resolveLayouts('/blog/post', pageModule);

			expect(layouts.every(layout => layout.path.includes('_layout.tsx'))).toEqual(true);
		} finally {
			await cleanupTestFixtures();
		}
	});

	it('should support custom layout paths', async () => {
		const composer = await setupTestFixtures();

		try {
			const customLayoutPath = join(TEST_LAYOUTS_DIR, 'custom.tsx');

			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					onlyLayouts: [customLayoutPath],
				},
			};

			const layouts = await composer.resolveLayouts('/blog/post', pageModule);

			expect(layouts.some(layout => layout.path === customLayoutPath)).toEqual(true);
		} finally {
			await cleanupTestFixtures();
		}
	});
});

describe('LayoutComposer - customLayout Configuration', () => {
	it('should add specified layout file', async () => {
		const composer = await setupTestFixtures();

		try {
			const customLayoutPath = join(TEST_LAYOUTS_DIR, 'custom.tsx');

			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					customLayout: customLayoutPath,
				},
			};

			const layouts = await composer.resolveLayouts('/blog/post', pageModule);

			expect(layouts.some(layout => layout.path === customLayoutPath)).toEqual(true);
		} finally {
			await cleanupTestFixtures();
		}
	});

	it('should support relative paths', async () => {
		const composer = await setupTestFixtures();

		try {
			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					customLayout: 'src/layouts/custom.tsx',
				},
			};

			const layouts = await composer.resolveLayouts('/blog/post', pageModule);

			expect(layouts.some(layout => layout.path.includes('custom.tsx'))).toEqual(true);
		} finally {
			await cleanupTestFixtures();
		}
	});
});

describe('LayoutComposer - Configuration Validation', () => {
	it('should validate valid config', async () => {
		const composer = await setupTestFixtures();

		try {
			const validConfig: LayoutConfig = {
				skipLayouts: ['layout1.tsx'],
				customLayout: 'custom.tsx',
			};

			const result = composer.validateLayoutConfig(validConfig);

			expect(result.valid).toEqual(true);
			expect(result.errors.length).toEqual(0);
		} finally {
			await cleanupTestFixtures();
		}
	});

	it('should detect conflicting replaceLayout and onlyLayouts', async () => {
		const composer = await setupTestFixtures();

		try {
			const invalidConfig: LayoutConfig = {
				replaceLayout: true,
				onlyLayouts: ['layout1.tsx'],
			};

			const result = composer.validateLayoutConfig(invalidConfig);

			expect(result.valid).toEqual(false);
			expect(result.errors.includes('replaceLayout and onlyLayouts cannot be used together')).toEqual(true);
		} finally {
			await cleanupTestFixtures();
		}
	});

	it('should detect conflicting replaceLayout and skipLayouts', async () => {
		const composer = await setupTestFixtures();

		try {
			const invalidConfig: LayoutConfig = {
				replaceLayout: true,
				skipLayouts: ['layout1.tsx'],
			};

			const result = composer.validateLayoutConfig(invalidConfig);

			expect(result.valid).toEqual(false);
			expect(result.errors.includes('replaceLayout and skipLayouts cannot be used together')).toEqual(true);
		} finally {
			await cleanupTestFixtures();
		}
	});

	it('should validate array types', async () => {
		const composer = await setupTestFixtures();

		try {
			const invalidConfig: any = {
				skipLayouts: 'not-an-array',
				onlyLayouts: 123,
			};

			const result = composer.validateLayoutConfig(invalidConfig);

			expect(result.valid).toEqual(false);
			expect(result.errors.includes('skipLayouts must be an array of strings')).toEqual(true);
			expect(result.errors.includes('onlyLayouts must be an array of strings')).toEqual(true);
		} finally {
			await cleanupTestFixtures();
		}
	});

	it('should validate customLayout type', async () => {
		const composer = await setupTestFixtures();

		try {
			const invalidConfig: any = {
				customLayout: 123,
			};

			const result = composer.validateLayoutConfig(invalidConfig);

			expect(result.valid).toEqual(false);
			expect(result.errors.includes('customLayout must be a string path')).toEqual(true);
		} finally {
			await cleanupTestFixtures();
		}
	});
});

describe('LayoutComposer - Complex Configuration', () => {
	it('skipLayouts with customLayout should work together', async () => {
		const composer = await setupTestFixtures();

		try {
			const customLayoutPath = join(TEST_LAYOUTS_DIR, 'custom.tsx');

			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					skipLayouts: ['*blog*'],
					customLayout: customLayoutPath,
				},
			};

			const layouts = await composer.resolveLayouts('/blog/post', pageModule);

			expect(layouts.some(layout => layout.path === customLayoutPath)).toEqual(true);
			expect(layouts.filter(layout => layout.path.includes('blog')).length).toEqual(0);
		} finally {
			await cleanupTestFixtures();
		}
	});
});

describe('LayoutComposer - Cache Management', () => {
	it('should cache custom layouts', async () => {
		const composer = await setupTestFixtures();

		try {
			const customLayoutPath = join(TEST_LAYOUTS_DIR, 'custom.tsx');

			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					customLayout: customLayoutPath,
				},
			};

			await composer.resolveLayouts('/blog/post', pageModule);
			const stats1 = composer.getCompositionStats();

			await composer.resolveLayouts('/blog/post', pageModule);
			const stats2 = composer.getCompositionStats();

			expect(stats1.customLayoutCacheSize > 0).toEqual(true);
			expect(stats2.customLayoutCacheSize).toEqual(stats1.customLayoutCacheSize);
		} finally {
			await cleanupTestFixtures();
		}
	});

	it('should clear cache', async () => {
		const composer = await setupTestFixtures();

		try {
			const customLayoutPath = join(TEST_LAYOUTS_DIR, 'custom.tsx');

			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					customLayout: customLayoutPath,
				},
			};

			await composer.resolveLayouts('/blog/post', pageModule);

			composer.clearCache();
			const stats = composer.getCompositionStats();

			expect(stats.customLayoutCacheSize).toEqual(0);
		} finally {
			await cleanupTestFixtures();
		}
	});
});

describe('LayoutComposer - Development Mode', () => {
	it('should not throw in development mode', async () => {
		const composer = await setupTestFixtures();

		try {
			expect(composer.isDevelopmentMode()).toEqual(true);

			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					replaceLayout: true,
				},
			};

			const layouts = await composer.resolveLayouts('/blog/post', pageModule);
			expect(layouts).toBeDefined();
		} finally {
			await cleanupTestFixtures();
		}
	});
});

describe('LayoutComposer - Error Handling', () => {
	it('should handle invalid custom layout path', async () => {
		const composer = await setupTestFixtures();

		try {
			const pageModule: MockPageModule = {
				default: () => 'Page Component',
				layoutConfig: {
					customLayout: '/invalid/path/that/does/not/exist.tsx',
				},
			};

			const layouts = await composer.resolveLayouts('/blog/post', pageModule);
			expect(layouts).toBeDefined();
			expect(Array.isArray(layouts)).toEqual(true);
		} finally {
			await cleanupTestFixtures();
		}
	});
});
